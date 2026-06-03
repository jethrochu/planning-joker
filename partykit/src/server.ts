import type * as Party from "partykit/server";

type DeckType = "fibonacci" | "tshirt" | "powers";

type StoredParticipant = {
  id: string;
  name: string;
  connected: boolean;
  vote: string | null;
  lastSeen: number;
};

type StoredRoomState = {
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
  voted: boolean;
  vote: string | null;
};

type PublicRoomState = {
  roomId: string;
  storyTitle: string;
  deck: DeckType;
  revealed: boolean;
  participants: PublicParticipant[];
  updatedAt: number;
};

type ClientMessage =
  | { type: "join"; clientId: string; name: string }
  | { type: "vote"; vote: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "setStoryTitle"; storyTitle: string }
  | { type: "setDeck"; deck: DeckType }
  | { type: "requestState" };

type ConnectionState = {
  clientId: string;
};

const STATE_KEY = "planning-joker.room-state";
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const decks: Record<DeckType, string[]> = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "?"],
  tshirt: ["XS", "S", "M", "L", "XL", "?"],
  powers: ["1", "2", "4", "8", "16", "32", "?"]
};

const deckTypes = Object.keys(decks) as DeckType[];

function createInitialState(): StoredRoomState {
  return {
    storyTitle: "",
    deck: "fibonacci",
    revealed: false,
    participants: {},
    updatedAt: Date.now()
  };
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

  async onConnect(connection: Party.Connection<ConnectionState>, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const clientId = cleanText(url.searchParams.get("clientId") || connection.id, 80);
    connection.setState({ clientId });
    await this.sendState(connection);
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
    const clientId = cleanText(
      payload.type === "join" ? payload.clientId : sender.state?.clientId,
      80
    );

    if (!clientId) {
      this.sendError(sender, "Missing participant.");
      return;
    }

    sender.setState({ clientId });

    if (payload.type === "join") {
      const name = cleanText(payload.name, 40);
      if (!name) {
        this.sendError(sender, "Display name is required.");
        return;
      }

      state.participants[clientId] = {
        id: clientId,
        name,
        connected: true,
        vote: state.participants[clientId]?.vote ?? null,
        lastSeen: Date.now()
      };
    }

    if (payload.type !== "join" && !state.participants[clientId]) {
      this.sendError(sender, "Join the room before sending updates.");
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

      state.participants[clientId].vote = payload.vote;
      state.participants[clientId].lastSeen = Date.now();
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
    const clientId = connection.state?.clientId;
    if (!clientId) return;

    const hasOtherConnection = [...this.room.getConnections<ConnectionState>()].some(
      (candidate) => candidate.id !== connection.id && candidate.state?.clientId === clientId
    );

    if (hasOtherConnection) return;

    const state = await this.getState();
    if (!state.participants[clientId]) return;

    state.participants[clientId].connected = false;
    state.participants[clientId].lastSeen = Date.now();
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

    return state;
  }

  private async saveState(state: StoredRoomState) {
    state.updatedAt = Date.now();
    await this.room.storage.put(STATE_KEY, state);
  }

  private publicState(state: StoredRoomState): PublicRoomState {
    const participants = Object.values(state.participants)
      .sort((a, b) => a.lastSeen - b.lastSeen)
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        connected: participant.connected,
        voted: participant.vote !== null,
        vote: state.revealed ? participant.vote : null
      }));

    return {
      roomId: this.room.id,
      storyTitle: state.storyTitle,
      deck: state.deck,
      revealed: state.revealed,
      participants,
      updatedAt: state.updatedAt
    };
  }

  private broadcastState(state: StoredRoomState) {
    this.room.broadcast(
      JSON.stringify({
        type: "state",
        state: this.publicState(state)
      })
    );
  }

  private async sendState(connection: Party.Connection) {
    const state = await this.getState();
    connection.send(
      JSON.stringify({
        type: "state",
        state: this.publicState(state)
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
