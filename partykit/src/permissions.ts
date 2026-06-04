export type HostOnlyMessageType = "reveal" | "reset" | "setStoryTitle" | "setDeck";

const hostOnlyMessages = new Set<string>(["reveal", "reset", "setStoryTitle", "setDeck"]);

export function isHostOnlyMessage(messageType: string): messageType is HostOnlyMessageType {
  return hostOnlyMessages.has(messageType);
}

export function canUseHostAction(
  participantId: string,
  hostId: string | null,
  messageType: string
) {
  return !isHostOnlyMessage(messageType) || participantId === hostId;
}
