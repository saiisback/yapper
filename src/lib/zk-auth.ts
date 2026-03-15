// Authentication helpers — now backed by Privy
// Session state is managed by Privy SDK; these helpers bridge legacy code.

export interface AuthSession {
  address: string;
  pseudonym: string | null;
  sessionExpiry: number;
  sessionKeyPermissions: string[];
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("starkzap_session");
  if (!stored) return null;

  const session: AuthSession = JSON.parse(stored);
  if (Date.now() > session.sessionExpiry) {
    localStorage.removeItem("starkzap_session");
    return null;
  }

  return session;
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
