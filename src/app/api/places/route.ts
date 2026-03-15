import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addEntityOnChain } from "@/lib/starkzap";
import { nearbySearch, searchPlaces, mapGoogleCategory } from "@/lib/google-places";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "rating";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");

  try {
    // When location is provided, fetch from Google Places API
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLng = parseFloat(longitude);

      const googlePlaces = query
        ? await searchPlaces(query, { lat: userLat, lng: userLng })
        : await nearbySearch({ lat: userLat, lng: userLng }, 1000);

      const entities = googlePlaces.slice(0, limit).map((place) => ({
        id: `google_${place.place_id}`,
        type: "place",
        name: place.name,
        slug: place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: null,
        address: place.formatted_address,
        category: mapGoogleCategory(place.types),
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        avgRating: place.rating ?? 0,
        reviewCount: place.user_ratings_total ?? 0,
        source: "google_places",
      }));

      return NextResponse.json({ entities });
    }

    // Fallback: query local database when no location provided
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

    const orderBy: Record<string, string> =
      sort === "reviews"
        ? { reviewCount: "desc" }
        : sort === "newest"
          ? { createdAt: "desc" }
          : { avgRating: "desc" };

    const entities = await prisma.entity.findMany({
      where,
      orderBy,
      take: limit,
    });

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
