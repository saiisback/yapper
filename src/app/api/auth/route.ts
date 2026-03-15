import { NextRequest, NextResponse } from "next/server";
import {
  createInvisibleWallet,
  verifyPhoneProof,
  createSessionKey,
  createProfileOnChain,
} from "@/lib/starkzap";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

async function verifyPrivyToken(authToken: string) {
  const res = await fetch(`https://auth.privy.io/api/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "privy-app-id": PRIVY_APP_ID,
    },
  });

  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "create_session") {
    const { privyToken, userId } = body;
    if (!privyToken || !userId) {
      return NextResponse.json(
        { error: "Privy token and user ID are required" },
        { status: 400 }
      );
    }

    // Verify the Privy token
    const privyUser = await verifyPrivyToken(privyToken);
    if (!privyUser) {
      return NextResponse.json(
        { error: "Invalid Privy token" },
        { status: 401 }
      );
    }

    // Generate ZK proof from Privy user ID
    const encoder = new TextEncoder();
    const userData = encoder.encode(userId + "yapper_zk_salt");
    const proofBuffer = await crypto.subtle.digest("SHA-256", userData);
    const proofHash = Array.from(new Uint8Array(proofBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const nullifierData = encoder.encode(userId + "yapper_nullifier");
    const nullifierBuffer = await crypto.subtle.digest("SHA-256", nullifierData);
    const nullifier = Array.from(new Uint8Array(nullifierBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Submit ZK proof to Starknet
    const zkResult = await verifyPhoneProof(proofHash, nullifier);
    console.log("[StarkZap] ZK verification tx:", zkResult.txHash);

    // Create invisible wallet
    const wallet = await createInvisibleWallet(proofHash);
    console.log("[StarkZap] Wallet created:", wallet.address);

    // Create on-chain profile
    const profileResult = await createProfileOnChain(
      "user_" + wallet.address.slice(2, 8),
      proofHash
    );
    console.log("[StarkZap] Profile tx:", profileResult.txHash);

    // Generate session key
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
