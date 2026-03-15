import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addEntityOnChain, estimateGasCost } from "@/lib/starkzap";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "rating";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

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

    // ── StarkZap: Create entity on-chain (gasless via AVNU Paymaster) ──
    // This uploads metadata to IPFS and creates the entity on the Starknet Entity contract
    const gasCost = estimateGasCost("entity");
    console.log(`[StarkZap] Creating entity on-chain (est. $${gasCost.estimatedUSD}, paid by ${gasCost.paidBy} via ${gasCost.paymaster})`);

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
      { ...entity, onChain: { txHash, metadataHash, paymaster: "AVNU", gasCost: gasCost.estimatedUSD } },
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
