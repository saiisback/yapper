import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitReviewOnChain, estimateGasCost } from "@/lib/starkzap";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const author = searchParams.get("author");
  const query = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "newest";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  try {
    const where: Record<string, unknown> = {};

    if (entityId) where.entityId = entityId;
    if (author) where.authorAddress = author;
    if (query) {
      where.contentText = { contains: query, mode: "insensitive" };
    }

    const orderBy: Record<string, string> =
      sort === "trending"
        ? { upvotes: "desc" }
        : sort === "rating"
          ? { rating: "desc" }
          : { createdAt: "desc" };

    const reviews = await prisma.review.findMany({
      where,
      orderBy,
      take: limit,
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ reviews: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId, rating, contentText, identityMode, authorAddress } = body;

    if (!entityId || !rating || !contentText) {
      return NextResponse.json(
        { error: "entityId, rating, and contentText are required" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (contentText.length < 20) {
      return NextResponse.json(
        { error: "Review must be at least 20 characters" },
        { status: 400 }
      );
    }

    // ── StarkZap: Submit review on-chain (gasless via AVNU Paymaster) ──
    // This uploads content to IPFS and posts the review to the Starknet Review contract
    const gasCost = estimateGasCost("review");
    console.log(`[StarkZap] Submitting review on-chain (est. $${gasCost.estimatedUSD}, paid by ${gasCost.paidBy} via ${gasCost.paymaster})`);

    const { txHash, contentHash } = await submitReviewOnChain(
      entityId,
      contentText,
      rating,
      (identityMode as "anonymous" | "pseudonymous" | "public") ?? "anonymous"
    );

    console.log("[StarkZap] Review tx confirmed:", txHash);

    // ── Cache in PostgreSQL for fast reads ──
    // The indexer will also sync this from on-chain events, but we write eagerly
    // for instant UI response (optimistic update pattern)
    const id = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const address = authorAddress ?? `0x${Math.random().toString(16).slice(2, 18)}`;

    const review = await prisma.review.create({
      data: {
        id,
        entityId,
        contentHash,
        contentText,
        rating,
        authorAddress: address,
        authorName:
          identityMode === "anonymous"
            ? null
            : identityMode === "pseudonymous"
              ? "Reviewer"
              : null,
        identityMode: identityMode ?? "anonymous",
        txHash, // Real tx hash from StarkZap
      },
    });

    // Update entity aggregate stats in cache
    const stats = await prisma.review.aggregate({
      where: { entityId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.entity.update({
      where: { id: entityId },
      data: {
        avgRating: stats._avg.rating ?? 0,
        reviewCount: stats._count.id,
      },
    });

    return NextResponse.json(
      { ...review, onChain: { txHash, contentHash, paymaster: "AVNU", gasCost: gasCost.estimatedUSD } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
