const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createRoomId() {
  let id = "";
  const bytes = new Uint8Array(10);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      id += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
    }
    return id;
  }

  for (let index = 0; index < 10; index += 1) {
    id += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return id;
}

export function normalizeRoomId(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

export function getRoomIdFromHash(hash = window.location.hash) {
  const match = hash.match(/^#\/room\/([^/?#]+)/);
  return match ? normalizeRoomId(decodeURIComponent(match[1])) : "";
}

export function setRoomHash(roomId: string) {
  window.location.hash = `/room/${encodeURIComponent(roomId)}`;
}

export function getRoomLink(roomId: string) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/room/${encodeURIComponent(roomId)}`;
}
