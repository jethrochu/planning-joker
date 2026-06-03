import type { PublicParticipant, PublicRoomState } from "./types";

export function getVotedCount(participants: PublicParticipant[]) {
  return participants.filter((participant) => participant.voted).length;
}

export function getConnectedCount(participants: PublicParticipant[]) {
  return participants.filter((participant) => participant.connected).length;
}

export function getVoteCounts(participants: PublicParticipant[]) {
  return participants.reduce<Record<string, number>>((counts, participant) => {
    if (!participant.vote) return counts;
    counts[participant.vote] = (counts[participant.vote] ?? 0) + 1;
    return counts;
  }, {});
}

export function getAverageVote(participants: PublicParticipant[]) {
  const numericVotes = participants
    .map((participant) => Number(participant.vote))
    .filter((vote) => Number.isFinite(vote));

  if (!numericVotes.length) return null;

  const total = numericVotes.reduce((sum, vote) => sum + vote, 0);
  return total / numericVotes.length;
}

export function getMostCommonVote(participants: PublicParticipant[]) {
  const counts = getVoteCounts(participants);
  const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return winner ?? null;
}

export function getFinalResultText(state: PublicRoomState) {
  const average = getAverageVote(state.participants);
  const mostCommon = getMostCommonVote(state.participants);
  const votes = state.participants
    .filter((participant) => participant.vote)
    .map((participant) => `${participant.name}: ${participant.vote}`)
    .join(", ");

  return [
    `Room: ${state.roomId}`,
    `Story: ${state.storyTitle || "Untitled story"}`,
    `Votes: ${votes || "No votes"}`,
    average === null ? null : `Average: ${average.toFixed(1)}`,
    mostCommon ? `Most common: ${mostCommon[0]} (${mostCommon[1]})` : null
  ]
    .filter(Boolean)
    .join("\n");
}
