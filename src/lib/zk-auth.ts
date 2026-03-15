// Authentication helpers — now backed by Privy
// Session state is managed by Privy SDK; these helpers bridge legacy code.

export interface AuthSession {
  address: string;
  pseudonym: string | null;
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("starkzap_session");
  if (!stored) return null;

  return JSON.parse(stored);
}

export function setSession(session: AuthSession): void {
  localStorage.setItem("starkzap_session", JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem("starkzap_session");
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
