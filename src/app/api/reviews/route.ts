import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitReviewOnChain } from "@/lib/starkzap";
import { ipfsUrl } from "@/lib/ipfs";

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
    const contentType = req.headers.get("content-type") ?? "";

    let entityId: string = "";
    let subject: string | undefined;
    let rating: number;
    let contentText: string;
    let identityMode: string;
    let authorAddress: string | undefined;
    let imageFile: Blob | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData (with optional photo upload)
      const formData = await req.formData();
      entityId = (formData.get("entityId") as string) || "";
      subject = (formData.get("subject") as string) || undefined;
      rating = parseInt(formData.get("rating") as string);
      contentText = formData.get("contentText") as string;
      identityMode = (formData.get("identityMode") as string) ?? "anonymous";
      authorAddress = (formData.get("authorAddress") as string) || undefined;

      const file = formData.get("image") as File | null;
      if (file && file.size > 0) {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json(
            { error: "Image must be JPEG, PNG, WebP, or GIF" },
            { status: 400 }
          );
        }
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Image must be under 10MB" },
            { status: 400 }
          );
        }
        imageFile = file;
      }
    } else {
      // Handle JSON body (no photo)
      const body = await req.json();
      entityId = body.entityId;
      subject = body.subject;
      rating = body.rating;
      contentText = body.contentText;
      identityMode = body.identityMode ?? "anonymous";
      authorAddress = body.authorAddress;
    }

    if (!authorAddress) {
      return NextResponse.json(
        { error: "authorAddress is required" },
        { status: 400 }
      );
    }

    if (!rating || !contentText) {
      return NextResponse.json(
        { error: "rating and contentText are required" },
        { status: 400 }
      );
    }

    if (!entityId && !subject) {
      return NextResponse.json(
        { error: "Either entityId or subject is required" },
        { status: 400 }
      );
    }

    // Auto-create entity from subject if no entityId provided
    if (!entityId && subject) {
      const slug = subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Find existing entity by slug or create a new one
      const existing = await prisma.entity.findUnique({ where: { slug } });
      if (existing) {
        entityId = existing.id;
      } else {
        const newId = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await prisma.entity.create({
          data: {
            id: newId,
            type: "place",
            name: subject.trim(),
            slug,
            source: "user",
          },
        });
        entityId = newId;
      }
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
    // Skip on-chain submission if no private key is configured
    let txHash: string | null = null;
    let contentHash: string | null = null;
    let imageHash: string | null = null;

    if (process.env.STARKNET_PRIVATE_KEY) {
      const onChainResult = await submitReviewOnChain(
        entityId,
        contentText,
        rating,
        (identityMode as "anonymous" | "pseudonymous" | "public") ?? "anonymous",
        imageFile
      );
      txHash = onChainResult.txHash;
      contentHash = onChainResult.contentHash;
      imageHash = onChainResult.imageHash;
      console.log("[StarkZap] Review tx confirmed:", txHash);
      if (imageHash) {
        console.log("[StarkZap] Image pinned to IPFS:", imageHash);
      }
    } else {
      console.warn("[StarkZap] STARKNET_PRIVATE_KEY not set — skipping on-chain submission");
      // Still upload image to IPFS if provided
      if (imageFile) {
        const { uploadFileToIPFS } = await import("@/lib/ipfs");
        imageHash = await uploadFileToIPFS(imageFile, `review_${Date.now()}.jpg`);
      }
    }

    // ── Cache in PostgreSQL for fast reads ──
    // The indexer will also sync this from on-chain events, but we write eagerly
    // for instant UI response (optimistic update pattern)
    const id = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const review = await prisma.review.create({
      data: {
        id,
        entityId,
        contentHash: contentHash ?? undefined,
        contentText,
        rating,
        authorAddress,
        authorName:
          identityMode === "anonymous"
            ? null
            : identityMode === "pseudonymous"
              ? "Reviewer"
              : null,
        identityMode: identityMode ?? "anonymous",
        imageUrl: imageHash ? ipfsUrl(imageHash) : null,
        txHash: txHash ?? undefined,
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
      {
        ...review,
        onChain: {
          txHash,
          contentHash,
          imageHash,
        },
      },
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
