import { NextRequest, NextResponse } from "next/server";
import { createProfileOnChain } from "@/lib/starkzap";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

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

    // Use Privy's embedded wallet address
    const walletAddress =
      privyUser.linked_accounts?.find(
        (a: { type: string }) => a.type === "wallet"
      )?.address ?? privyUser.id;

    // Create on-chain profile
    const pseudonym = "user_" + walletAddress.slice(2, 8);
    const profileResult = await createProfileOnChain(pseudonym);
    console.log("[StarkZap] Profile tx:", profileResult.txHash);

    const session = {
      address: walletAddress,
      pseudonym,
      profileTx: profileResult.txHash,
    };

    return NextResponse.json(session);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
