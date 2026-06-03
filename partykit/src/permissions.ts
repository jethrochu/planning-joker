export type HostOnlyMessageType = "reveal" | "reset";

const hostOnlyMessages = new Set<string>(["reveal", "reset"]);

export function isHostOnlyMessage(messageType: string): messageType is HostOnlyMessageType {
  return hostOnlyMessages.has(messageType);
}

export function canUseHostAction(
  clientId: string,
  hostId: string | null,
  messageType: string
) {
  return !isHostOnlyMessage(messageType) || clientId === hostId;
}
