import type * as Party from "partykit/server";
import { canUseHostAction } from "./permissions";

type DeckType = "fibonacci" | "tshirt" | "powers";

type StoredParticipant = {
  id: string;
  publicId: string;
  memberKey: string;
  name: string;
  connected: boolean;
  vote: string | null;
  lastSeen: number;
};

type StoredRoomState = {
  hostId: string | null;
  storyTitle: string;
  deck: DeckType;
  revealed: boolean;
  participants: Record<string, StoredParticipant>;
  updatedAt: number;
};

type PublicParticipant = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  voted: boolean;
  vote: string | null;
};

type PublicRoomState = {
  roomId: string;
  currentParticipantId: string | null;
  isHost: boolean;
  storyTitle: string;
  deck: DeckType;
  revealed: boolean;
  participants: PublicParticipant[];
  updatedAt: number;
};

type ClientMessage =
  | { type: "join"; memberKey?: string; name: string }
  | { type: "vote"; vote: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "setStoryTitle"; storyTitle: string }
  | { type: "setDeck"; deck: DeckType }
  | { type: "requestState" };

type ConnectionState = {
  participantId?: string;
};

const STATE_KEY = "planning-joker.room-state";
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const decks: Record<DeckType, string[]> = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "?"],
  tshirt: ["XS", "S", "M", "L", "XL", "?"],
  powers: ["1", "2", "4", "8", "16", "32", "?"]
};

const deckTypes = Object.keys(decks) as DeckType[];

function randomToken(prefix: string) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const value = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${prefix}-${value}`;
}

function createInitialState(): StoredRoomState {
  return {
    hostId: null,
    storyTitle: "",
    deck: "fibonacci",
    revealed: false,
    participants: {},
    updatedAt: Date.now()
  };
}

function normalizeState(state: StoredRoomState): StoredRoomState {
  const participants = Object.fromEntries(
    Object.entries(state.participants ?? {}).map(([id, participant]) => [
      id,
      {
        ...participant,
        id: participant.id ?? id,
        publicId: participant.publicId ?? randomToken("participant"),
        memberKey: participant.memberKey ?? randomToken("member")
      }
    ])
  );

  return {
    ...state,
    hostId: state.hostId ?? null,
    participants
  };
}

function chooseHostId(participants: Record<string, StoredParticipant>) {
  const [nextHost] = Object.values(participants)
    .filter((participant) => participant.connected)
    .sort((a, b) => a.lastSeen - b.lastSeen);

  return nextHost?.id ?? null;
}

function ensureHost(state: StoredRoomState) {
  const host = state.hostId ? state.participants[state.hostId] : null;

  if (host?.connected) return;

  state.hostId = chooseHostId(state.participants);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function isDeckType(value: unknown): value is DeckType {
  return typeof value === "string" && deckTypes.includes(value as DeckType);
}

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection<ConnectionState>) {
    connection.setState({});
  }

  async onMessage(message: string, sender: Party.Connection<ConnectionState>) {
    let payload: ClientMessage;

    try {
      payload = JSON.parse(message) as ClientMessage;
    } catch {
      this.sendError(sender, "Invalid message.");
      return;
    }

    const state = await this.getState();
    let participantId = sender.state?.participantId;

    if (payload.type === "join") {
      const name = cleanText(payload.name, 40);
      if (!name) {
        this.sendError(sender, "Display name is required.");
        return;
      }

      const suppliedMemberKey = cleanText(payload.memberKey, 120);
      const existingParticipant = suppliedMemberKey
        ? Object.values(state.participants).find(
            (participant) => participant.memberKey === suppliedMemberKey
          )
        : null;

      const participant = existingParticipant ?? {
        id: randomToken("private"),
        publicId: randomToken("participant"),
        memberKey: randomToken("member"),
        name,
        connected: true,
        vote: null,
        lastSeen: Date.now()
      };

      participant.name = name;
      participant.connected = true;
      participant.lastSeen = Date.now();
      state.participants[participant.id] = participant;
      participantId = participant.id;
      sender.setState({ participantId });
      ensureHost(state);
      await this.saveState(state);
      this.sendSession(sender, participant.memberKey);
      this.broadcastState(state);
      return;
    }

    if (!participantId || !state.participants[participantId]) {
      this.sendError(sender, "Join the room before sending updates.");
      return;
    }

    if (!canUseHostAction(participantId, state.hostId, payload.type)) {
      this.sendError(sender, "Only the host can change room controls.");
      return;
    }

    if (payload.type === "vote") {
      if (state.revealed) {
        this.sendError(sender, "Reset before changing votes.");
        return;
      }

      if (!decks[state.deck].includes(payload.vote)) {
        this.sendError(sender, "Card is not in this deck.");
        return;
      }

      state.participants[participantId].vote = payload.vote;
      state.participants[participantId].lastSeen = Date.now();
    }

    if (payload.type === "reveal") {
      state.revealed = true;
    }

    if (payload.type === "reset") {
      state.revealed = false;
      for (const participant of Object.values(state.participants)) {
        participant.vote = null;
      }
    }

    if (payload.type === "setStoryTitle") {
      state.storyTitle = cleanText(payload.storyTitle, 120);
    }

    if (payload.type === "setDeck") {
      if (!isDeckType(payload.deck)) {
        this.sendError(sender, "Unknown deck.");
        return;
      }

      if (state.deck !== payload.deck) {
        state.deck = payload.deck;
        state.revealed = false;
        for (const participant of Object.values(state.participants)) {
          participant.vote = null;
        }
      }
    }

    if (payload.type === "requestState") {
      await this.sendState(sender);
      return;
    }

    await this.saveState(state);
    this.broadcastState(state);
  }

  async onClose(connection: Party.Connection<ConnectionState>) {
    const participantId = connection.state?.participantId;
    if (!participantId) return;

    const hasOtherConnection = [...this.room.getConnections<ConnectionState>()].some(
      (candidate) =>
        candidate.id !== connection.id && candidate.state?.participantId === participantId
    );

    if (hasOtherConnection) return;

    const state = await this.getState();
    if (!state.participants[participantId]) return;

    state.participants[participantId].connected = false;
    state.participants[participantId].lastSeen = Date.now();
    ensureHost(state);
    await this.saveState(state);
    this.broadcastState(state);
  }

  private async getState() {
    const state = await this.room.storage.get<StoredRoomState>(STATE_KEY);

    if (!state || Date.now() - state.updatedAt > ROOM_TTL_MS) {
      const initialState = createInitialState();
      await this.saveState(initialState);
      return initialState;
    }

    return normalizeState(state);
  }

  private async saveState(state: StoredRoomState) {
    state.updatedAt = Date.now();
    await this.room.storage.put(STATE_KEY, state);
  }

  private publicState(
    state: StoredRoomState,
    connection?: Party.Connection<ConnectionState>
  ): PublicRoomState {
    const participantId = connection?.state?.participantId ?? null;
    const currentParticipant = participantId ? state.participants[participantId] : null;
    const participants = Object.values(state.participants)
      .sort((a, b) => a.lastSeen - b.lastSeen)
      .map((participant) => ({
        id: participant.publicId,
        name: participant.name,
        connected: participant.connected,
        isHost: participant.id === state.hostId,
        voted: participant.vote !== null,
        vote: state.revealed ? participant.vote : null
      }));

    return {
      roomId: this.room.id,
      currentParticipantId: currentParticipant?.publicId ?? null,
      isHost: participantId !== null && participantId === state.hostId,
      storyTitle: state.storyTitle,
      deck: state.deck,
      revealed: state.revealed,
      participants,
      updatedAt: state.updatedAt
    };
  }

  private broadcastState(state: StoredRoomState) {
    for (const connection of this.room.getConnections<ConnectionState>()) {
      connection.send(
        JSON.stringify({
          type: "state",
          state: this.publicState(state, connection)
        })
      );
    }
  }

  private async sendState(connection: Party.Connection<ConnectionState>) {
    const state = await this.getState();
    connection.send(
      JSON.stringify({
        type: "state",
        state: this.publicState(state, connection)
      })
    );
  }

  private sendSession(connection: Party.Connection, memberKey: string) {
    connection.send(
      JSON.stringify({
        type: "session",
        memberKey
      })
    );
  }

  private sendError(connection: Party.Connection, message: string) {
    connection.send(
      JSON.stringify({
        type: "error",
        message
      })
    );
  }
}
