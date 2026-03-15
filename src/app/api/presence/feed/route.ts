import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fixLegacyIpfsUrl } from "@/lib/ipfs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);
  const cursor = searchParams.get("cursor");

  try {
    const proofs = await prisma.proof.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        entity: {
          select: {
            name: true,
            slug: true,
            type: true,
            imageUrl: true,
            latitude: true,
            longitude: true,
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

    const feed = proofs.map((p) => {
      // Calculate distance between user and entity
      let distanceMeters: number | null = null;
      if (p.entity.latitude && p.entity.longitude) {
        distanceMeters = Math.round(
          haversineDistance(
            p.userLatitude,
            p.userLongitude,
            p.entity.latitude,
            p.entity.longitude
          )
        );
      }

      return {
        id: p.id,
        userId: p.userId,
        photoUrl: fixLegacyIpfsUrl(p.photoUrl),
        caption: p.caption,
        entityName: p.entity.name,
        entitySlug: p.entity.slug,
        entityType: p.entity.type,
        eventName: p.event?.name ?? null,
        eventId: p.event?.id ?? null,
        distanceMeters,
        createdAt: p.createdAt.toISOString(),
      };
    });

    const nextCursor = proofs.length === limit ? proofs[proofs.length - 1].id : null;

    return NextResponse.json({ feed, nextCursor });
  } catch (error) {
    console.error("Error fetching presence feed:", error);
    return NextResponse.json({ feed: [], nextCursor: null });
  }
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
