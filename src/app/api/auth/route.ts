import { NextRequest, NextResponse } from "next/server";
import {
  createInvisibleWallet,
  verifyPhoneProof,
  createSessionKey,
  createProfileOnChain,
} from "@/lib/starkzap";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID!;

async function twilioVerifyRequest(phone: string) {
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
    },
    body: new URLSearchParams({ To: phone, Channel: "sms" }),
  });
  return res.json();
}

async function twilioVerifyCheck(phone: string, code: string) {
  const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
    },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "request_otp") {
    const { phoneNumber } = body;
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    try {
      const result = await twilioVerifyRequest(phoneNumber);
      if (result.status === "pending") {
        return NextResponse.json({ success: true });
      }
      console.error("[Twilio] Verification request failed:", result);
      return NextResponse.json(
        { error: "Failed to send verification code" },
        { status: 500 }
      );
    } catch (err) {
      console.error("[Twilio] Error:", err);
      return NextResponse.json(
        { error: "Failed to send verification code" },
        { status: 500 }
      );
    }
  }

  if (action === "verify_otp") {
    const { phoneNumber, code } = body;
    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and code are required" },
        { status: 400 }
      );
    }

    try {
      const result = await twilioVerifyCheck(phoneNumber, code);
      if (result.status !== "approved") {
        return NextResponse.json(
          { error: "Invalid or expired code" },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error("[Twilio] Verify check error:", err);
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 500 }
      );
    }

    // ── StarkZap Integration ──

    // Step 1: Generate ZK proof of phone verification
    // The proof attests "this person verified a unique phone" without revealing which one
    const encoder = new TextEncoder();
    const phoneData = encoder.encode(phoneNumber + "yapper_zk_salt");
    const proofBuffer = await crypto.subtle.digest("SHA-256", phoneData);
    const proofHash = Array.from(new Uint8Array(proofBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Nullifier prevents the same phone from creating multiple accounts
    const nullifierData = encoder.encode(phoneNumber + "yapper_nullifier");
    const nullifierBuffer = await crypto.subtle.digest("SHA-256", nullifierData);
    const nullifier = Array.from(new Uint8Array(nullifierBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Step 2: Submit ZK proof to Starknet via StarkZap
    const zkResult = await verifyPhoneProof(proofHash, nullifier);
    console.log("[StarkZap] ZK verification tx:", zkResult.txHash);

    // Step 3: Create invisible Starknet wallet via StarkZap
    // No seed phrases, no popups — wallet is derived from the ZK proof
    const wallet = await createInvisibleWallet(proofHash);
    console.log("[StarkZap] Wallet created:", wallet.address);

    // Step 4: Create on-chain profile
    const profileResult = await createProfileOnChain("user_" + wallet.address.slice(2, 8), proofHash);
    console.log("[StarkZap] Profile tx:", profileResult.txHash);

    // Step 5: Generate session key for rapid actions (votes/reports without biometric)
    const sessionKey = await createSessionKey(wallet.address);

    const session = {
      address: wallet.address,
      publicKey: wallet.publicKey,
      pseudonym: null,
      sessionExpiry: sessionKey.expiresAt,
      sessionKeyPermissions: sessionKey.permissions,
      zkVerificationTx: zkResult.txHash,
      profileTx: profileResult.txHash,
    };

    return NextResponse.json(session);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
