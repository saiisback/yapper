"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Shield, Fingerprint, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, ready, authenticated } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <Loader2 className="h-8 w-8 animate-spin text-warm-yellow" />
      </div>
    );
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
              Welcome to Yap Me.
            </h1>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              Sign in to start reviewing. No passwords needed.
            </p>
          </div>

          <div className="space-y-5">
            <button
              onClick={login}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-warm-yellow px-6 py-4 font-semibold text-[#111111] transition-all hover:brightness-110"
            >
              Sign in
            </button>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-lime/15">
                  <Shield className="size-4 text-lime" />
                </div>
                <span>Sign in with email, wallet, Google, or Apple.</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warm-yellow/15">
                  <Fingerprint className="size-4 text-warm-yellow" />
                </div>
                <span>An embedded wallet is created automatically for you.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
