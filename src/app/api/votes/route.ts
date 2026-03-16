import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { castVoteOnChain } from "@/lib/starkzap";

const VALID_REACTIONS = ["fire", "skull", "love", "gross", "cap"] as const;
type ReactionType = (typeof VALID_REACTIONS)[number];

const REACTION_FIELD_MAP: Record<ReactionType, string> = {
  fire: "fireCount",
  skull: "skullCount",
  love: "loveCount",
  gross: "grossCount",
  cap: "capCount",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewId, voteType, voterAddress } = body;

    if (!reviewId || !voteType || !voterAddress) {
      return NextResponse.json(
        { error: "reviewId, voteType, and voterAddress are required" },
        { status: 400 }
      );
    }

    if (!VALID_REACTIONS.includes(voteType)) {
      return NextResponse.json(
        { error: `voteType must be one of: ${VALID_REACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await castVoteOnChain(reviewId, voteType as "fire" | "skull" | "love" | "gross" | "cap");
    console.log("[StarkZap] Vote tx confirmed:", result.txHash);

    await prisma.vote.upsert({
      where: {
        reviewId_voterAddress: {
          reviewId,
          voterAddress,
        },
      },
      update: { voteType, txHash: result.txHash },
      create: {
        reviewId,
        voterAddress,
        voteType,
        txHash: result.txHash,
      },
    });

    // Recalculate all reaction counts
    const counts = await Promise.all(
      VALID_REACTIONS.map(async (reaction) => {
        const count = await prisma.vote.count({
          where: { reviewId, voteType: reaction },
        });
        return [REACTION_FIELD_MAP[reaction], count] as const;
      })
    );

    const updateData = Object.fromEntries(counts);
    await prisma.review.update({
      where: { id: reviewId },
      data: updateData,
    });

    const reactionCounts = Object.fromEntries(
      VALID_REACTIONS.map((r) => [
        r,
        counts.find(([field]) => field === REACTION_FIELD_MAP[r])?.[1] ?? 0,
      ])
    );

    return NextResponse.json({
      success: true,
      reactions: reactionCounts,
      onChain: { txHash: result.txHash },
    });
  } catch (error) {
    console.error("Error casting vote:", error);
    return NextResponse.json(
      { error: "Failed to cast vote" },
      { status: 500 }
    );
  }
}
