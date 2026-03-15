import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { castVoteOnChain, estimateGasCost } from "@/lib/starkzap";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewId, voteType, voterAddress } = body;

    if (!reviewId || !voteType) {
      return NextResponse.json(
        { error: "reviewId and voteType are required" },
        { status: 400 }
      );
    }

    if (!["up", "down"].includes(voteType)) {
      return NextResponse.json(
        { error: "voteType must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // ── StarkZap: Cast vote on-chain (gasless, uses session key) ──
    // Session keys allow rapid voting without biometric prompt each time
    const gasCost = estimateGasCost("vote");
    console.log(`[StarkZap] Casting ${voteType}vote on-chain (est. $${gasCost.estimatedUSD}, paid by ${gasCost.paidBy} via ${gasCost.paymaster})`);

    const result = await castVoteOnChain(reviewId, voteType);
    console.log("[StarkZap] Vote tx confirmed:", result.txHash);

    // ── Cache in PostgreSQL ──
    const address = voterAddress ?? `0x${Math.random().toString(16).slice(2, 18)}`;

    await prisma.vote.upsert({
      where: {
        reviewId_voterAddress: {
          reviewId,
          voterAddress: address,
        },
      },
      update: { voteType, txHash: result.txHash },
      create: {
        reviewId,
        voterAddress: address,
        voteType,
        txHash: result.txHash,
      },
    });

    // Recalculate vote counts from cache
    const [upvotes, downvotes] = await Promise.all([
      prisma.vote.count({ where: { reviewId, voteType: "up" } }),
      prisma.vote.count({ where: { reviewId, voteType: "down" } }),
    ]);

    await prisma.review.update({
      where: { id: reviewId },
      data: { upvotes, downvotes },
    });

    return NextResponse.json({
      success: true,
      upvotes,
      downvotes,
      onChain: { txHash: result.txHash, paymaster: "AVNU", gasCost: gasCost.estimatedUSD },
    });
  } catch (error) {
    console.error("Error casting vote:", error);
    return NextResponse.json(
      { error: "Failed to cast vote" },
      { status: 500 }
    );
  }
}
