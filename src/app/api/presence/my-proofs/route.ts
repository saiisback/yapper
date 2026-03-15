import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fixLegacyIpfsUrl } from "@/lib/ipfs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    const proofs = await prisma.proof.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        entity: {
          select: {
            name: true,
            slug: true,
            type: true,
            imageUrl: true,
          },
        },
        event: {
          select: {
            name: true,
            id: true,
          },
        },
      },
    });

    const result = proofs.map((p) => ({
      id: p.id,
      photoUrl: fixLegacyIpfsUrl(p.photoUrl),
      caption: p.caption,
      entityName: p.entity.name,
      entitySlug: p.entity.slug,
      entityType: p.entity.type,
      eventName: p.event?.name ?? null,
      userLatitude: p.userLatitude,
      userLongitude: p.userLongitude,
      txHash: p.txHash,
      createdAt: p.createdAt.toISOString(),
    }));

    // Stats
    const uniquePlaces = await prisma.proof.groupBy({
      by: ["entityId"],
      where: { userId },
    });

    return NextResponse.json({
      proofs: result,
      stats: {
        totalProofs: proofs.length,
        uniquePlaces: uniquePlaces.length,
      },
    });
  } catch (error) {
    console.error("Error fetching user proofs:", error);
    return NextResponse.json({ proofs: [], stats: { totalProofs: 0, uniquePlaces: 0 } });
  }
}
