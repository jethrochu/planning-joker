import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAverageVote } from "./summary.js";
import type { PublicParticipant } from "./types.js";

function participant(overrides: Partial<PublicParticipant>): PublicParticipant {
  return {
    id: overrides.id ?? "participant",
    name: overrides.name ?? "Participant",
    connected: overrides.connected ?? true,
    isHost: overrides.isHost ?? false,
    voted: overrides.voted ?? false,
    vote: overrides.vote ?? null
  };
}

describe("vote summaries", () => {
  it("averages only participants who have voted", () => {
    const average = getAverageVote([
      participant({ id: "one", voted: true, vote: "3" }),
      participant({ id: "two", voted: false, vote: null })
    ]);

    assert.equal(average, 3);
  });
});
