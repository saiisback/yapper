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
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fullPhone = `${countryCode}${phoneNumber}`;

  const countryCodes = [
    { code: "+91", flag: "\u{1F1EE}\u{1F1F3}", label: "IN" },
    { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", label: "US" },
    { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", label: "UK" },
    { code: "+61", flag: "\u{1F1E6}\u{1F1FA}", label: "AU" },
    { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", label: "UAE" },
    { code: "+65", flag: "\u{1F1F8}\u{1F1EC}", label: "SG" },
    { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", label: "DE" },
    { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", label: "FR" },
    { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", label: "JP" },
    { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", label: "CN" },
    { code: "+55", flag: "\u{1F1E7}\u{1F1F7}", label: "BR" },
    { code: "+234", flag: "\u{1F1F3}\u{1F1EC}", label: "NG" },
    { code: "+27", flag: "\u{1F1FF}\u{1F1E6}", label: "ZA" },
    { code: "+82", flag: "\u{1F1F0}\u{1F1F7}", label: "KR" },
    { code: "+52", flag: "\u{1F1F2}\u{1F1FD}", label: "MX" },
  ];

  async function handleRequestOTP() {
    const digits = phoneNumber.replace(/\D/g, "");
    if (!digits || digits.length < 7 || digits.length > 15) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", phoneNumber: fullPhone }),
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
        body: JSON.stringify({ action: "verify_otp", phoneNumber: fullPhone, code: otpCode }),
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
              {step === "otp" && `We sent a code to ${fullPhone}`}
              {step === "setup" && "Creating your account..."}
            </p>
          </div>

          {step === "phone" && (
            <div className="space-y-5">
              {/* Country code + phone input */}
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="shrink-0 rounded-full border border-[#333333] bg-[#1a1a1a] px-3 py-4 text-sm text-white outline-none focus:border-warm-yellow/50 transition-colors appearance-none cursor-pointer"
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Smartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A0A0A0]" />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) =>
                      setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 15))
                    }
                    className="w-full rounded-full border border-[#333333] bg-transparent pl-12 pr-5 py-4 text-white placeholder:text-[#A0A0A0] outline-none focus:border-warm-yellow/50 transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleRequestOTP()}
                  />
                </div>
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
