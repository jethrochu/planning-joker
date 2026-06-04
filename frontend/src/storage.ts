const DISPLAY_NAME_KEY = "planning-joker.display-name";
const SESSION_ID_KEY = "planning-joker.session-id";
const ROOM_MEMBER_KEY_PREFIX = "planning-joker.room-member-key.";

function randomToken(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const next = randomToken("session");
  sessionStorage.setItem(SESSION_ID_KEY, next);
  return next;
}

export function getRoomMemberKey(roomId: string) {
  return localStorage.getItem(`${ROOM_MEMBER_KEY_PREFIX}${roomId}`) ?? undefined;
}

export function setRoomMemberKey(roomId: string, memberKey: string) {
  localStorage.setItem(`${ROOM_MEMBER_KEY_PREFIX}${roomId}`, memberKey);
}

export function getStoredDisplayName() {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function setStoredDisplayName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}
