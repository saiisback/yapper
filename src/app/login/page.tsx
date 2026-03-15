"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Shield, Fingerprint, ArrowRight, Check, Loader2 } from "lucide-react";

type Step = "phone" | "otp" | "setup";

function SetupStep({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {done ? (
        <div className="flex size-7 items-center justify-center rounded-full bg-lime/30">
          <Check className="h-4 w-4 text-lime" />
        </div>
      ) : (
        <div className="flex size-7 items-center justify-center rounded-full bg-warm-yellow/30">
          <Loader2 className="h-4 w-4 animate-spin text-warm-yellow" />
        </div>
      )}
      <span className={done ? "text-[#A0A0A0]" : "text-white"}>
        {label}
      </span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRequestOTP() {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", phoneNumber }),
      });

      if (!res.ok) throw new Error("Failed to send OTP");
      setStep("otp");
    } catch {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", phoneNumber, code: otpCode }),
      });

      if (!res.ok) throw new Error("Invalid code");

      const session = await res.json();
      localStorage.setItem("starkzap_session", JSON.stringify(session));
      setStep("setup");

      setTimeout(() => router.push("/"), 2000);
    } catch {
      setError("Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-[#222222] p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-warm-yellow">
              <span className="text-2xl font-bold text-[#111111]">Y</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {step === "phone" && "Welcome to Yap Me."}
              {step === "otp" && "Verify your phone"}
              {step === "setup" && "Setting up..."}
            </h1>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              {step === "phone" && "Sign in with your phone. No passwords needed."}
              {step === "otp" && `We sent a code to ${phoneNumber}`}
              {step === "setup" && "Creating your account..."}
            </p>
          </div>

          {step === "phone" && (
            <div className="space-y-5">
              {/* Input — transparent bg, thin border, pill-shaped */}
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A0A0A0]" />
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full rounded-full border border-[#333333] bg-transparent px-14 py-4 text-white placeholder:text-[#A0A0A0] outline-none focus:border-warm-yellow/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOTP()}
                />
              </div>

              {error && (
                <p className="text-sm text-coral">{error}</p>
              )}

              <button
                onClick={handleRequestOTP}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-warm-yellow px-6 py-4 font-semibold text-[#111111] transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send verification code"}
                <ArrowRight className="size-4" />
              </button>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-lime/15">
                    <Shield className="size-4 text-lime" />
                  </div>
                  <span>Your phone number is verified securely and never stored.</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warm-yellow/15">
                    <Fingerprint className="size-4 text-warm-yellow" />
                  </div>
                  <span>Use biometrics (FaceID / fingerprint) for quick access.</span>
                </div>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-5">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-full border border-[#333333] bg-transparent px-8 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-warm-yellow/50 transition-colors"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
              />
              {error && (
                <p className="text-sm text-coral">{error}</p>
              )}
              <button
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full rounded-full bg-warm-yellow px-6 py-4 font-semibold text-[#111111] transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
              <button
                onClick={() => {
                  setStep("phone");
                  setOtpCode("");
                  setError("");
                }}
                className="w-full rounded-full py-3 text-sm text-[#A0A0A0] transition-colors hover:text-white"
              >
                Use a different number
              </button>
            </div>
          )}

          {step === "setup" && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
              <div className="w-full space-y-4">
                <SetupStep label="Verifying your identity" done />
                <SetupStep label="Creating your account" done />
                <SetupStep label="Setting up preferences" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
