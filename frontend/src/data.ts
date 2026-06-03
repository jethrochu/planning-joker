import type { DeckType } from "./types";

export const decks: Record<DeckType, string[]> = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "?"],
  tshirt: ["XS", "S", "M", "L", "XL", "?"],
  powers: ["1", "2", "4", "8", "16", "32", "?"]
};

export const deckLabels: Record<DeckType, string> = {
  fibonacci: "Fibonacci",
  tshirt: "T-shirt",
  powers: "Powers"
};
