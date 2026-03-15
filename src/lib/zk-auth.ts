// ZK phone verification and authentication logic

export interface ZKProof {
  proof: string;
  nullifier: string;
  publicInputs: string[];
}

export interface AuthSession {
  address: string;
  pseudonym: string | null;
  sessionExpiry: number;
  sessionKeyPermissions: string[];
}

export async function requestOTP(phoneNumber: string): Promise<{ success: boolean }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request_otp", phoneNumber }),
  });

  if (!res.ok) throw new Error("Failed to send OTP");
  return res.json();
}

export async function verifyOTP(
  phoneNumber: string,
  code: string
): Promise<AuthSession> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify_otp", phoneNumber, code }),
  });

  if (!res.ok) throw new Error("OTP verification failed");
  return res.json();
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
