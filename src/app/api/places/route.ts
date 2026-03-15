import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addEntityOnChain } from "@/lib/starkzap";

// Haversine distance in meters
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "rating";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");

  try {
    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ];
    }

    if (category && category !== "All") {
      where.category = category;
    }

    // When location is provided, only return entities that have coordinates
    if (latitude && longitude) {
      where.latitude = { not: null };
      where.longitude = { not: null };
    }

    const orderBy: Record<string, string> =
      sort === "distance"
        ? { createdAt: "desc" } // fetch all, sort by distance below
        : sort === "reviews"
          ? { reviewCount: "desc" }
          : sort === "newest"
            ? { createdAt: "desc" }
            : { avgRating: "desc" };

    // Fetch more when sorting by distance so we can filter after
    const fetchLimit = sort === "distance" && latitude && longitude ? 200 : limit;

    let entities = await prisma.entity.findMany({
      where,
      orderBy,
      take: fetchLimit,
    });

    // If location provided, compute distance and sort by it
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLng = parseFloat(longitude);

      const entitiesWithDistance = entities
        .filter((e) => e.latitude != null && e.longitude != null)
        .map((e) => ({
          ...e,
          distance: haversineDistance(userLat, userLng, e.latitude!, e.longitude!),
        }));

      if (sort === "distance") {
        entitiesWithDistance.sort((a, b) => a.distance - b.distance);
      }

      entities = entitiesWithDistance.slice(0, limit);
    }

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("Error fetching places:", error);
    return NextResponse.json({ entities: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, description, address, category, latitude, longitude } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // ── StarkZap: Create entity on-chain ──
    const { txHash, metadataHash } = await addEntityOnChain(
      type as "place" | "creator" | "product",
      { name, description, address, category }
    );

    console.log("[StarkZap] Entity tx confirmed:", txHash);

    // ── Cache in PostgreSQL for fast reads ──
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const id = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const entity = await prisma.entity.create({
      data: {
        id,
        type,
        name,
        slug,
        description,
        address,
        category,
        latitude,
        longitude,
        metadataHash, // IPFS hash from StarkZap flow
        source: "user",
      },
    });

    return NextResponse.json(
      { ...entity, onChain: { txHash, metadataHash } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating entity:", error);
    return NextResponse.json(
      { error: "Failed to create entity" },
      { status: 500 }
    );
  }
}
