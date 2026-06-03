const CLIENT_ID_KEY = "planning-joker.client-id";
const DISPLAY_NAME_KEY = "planning-joker.display-name";
const SESSION_ID_KEY = "planning-joker.session-id";

function randomToken(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getClientId() {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;

  const next = randomToken("client");
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}

export function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const next = randomToken("session");
  sessionStorage.setItem(SESSION_ID_KEY, next);
  return next;
}

export function getStoredDisplayName() {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function setStoredDisplayName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}
