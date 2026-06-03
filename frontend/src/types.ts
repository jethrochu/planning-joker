export type DeckType = "fibonacci" | "tshirt" | "powers";

export type PublicParticipant = {
  id: string;
  name: string;
  connected: boolean;
  voted: boolean;
  vote: string | null;
};

export type PublicRoomState = {
  roomId: string;
  storyTitle: string;
  deck: DeckType;
  revealed: boolean;
  participants: PublicParticipant[];
  updatedAt: number;
};

export type ClientMessage =
  | { type: "join"; clientId: string; name: string }
  | { type: "vote"; vote: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "setStoryTitle"; storyTitle: string }
  | { type: "setDeck"; deck: DeckType }
  | { type: "requestState" };

export type ServerMessage =
  | { type: "state"; state: PublicRoomState }
  | { type: "error"; message: string };
