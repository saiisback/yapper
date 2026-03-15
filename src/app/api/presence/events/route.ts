import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPresenceEventOnChain, estimateGasCost } from "@/lib/starkzap";
import { uploadToIPFS } from "@/lib/ipfs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // "active" | "upcoming" | "past"
  const entityId = searchParams.get("entityId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  try {
    const now = new Date();
    const where: Record<string, unknown> = {};

    if (entityId) where.entityId = entityId;

    if (filter === "active") {
      where.startTime = { lte: now };
      where.endTime = { gte: now };
    } else if (filter === "upcoming") {
      where.startTime = { gt: now };
    } else if (filter === "past") {
      where.endTime = { lt: now };
    } else {
      // Default: active + upcoming
      where.endTime = { gte: now };
    }

    const events = await prisma.presenceEvent.findMany({
      where,
      orderBy: { startTime: "asc" },
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
      },
    });

    const result = events.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      entityName: e.entity.name,
      entitySlug: e.entity.slug,
      entityType: e.entity.type,
      entityImageUrl: e.entity.imageUrl,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      latitude: e.latitude,
      longitude: e.longitude,
      radius: e.radius,
      proofCount: e.proofCount,
      isActive: new Date(e.startTime) <= now && new Date(e.endTime) >= now,
    }));

    return NextResponse.json({ events: result });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ events: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      entityId,
      name,
      description,
      startTime,
      endTime,
      latitude,
      longitude,
      radius = 500,
      creator,
    } = body;

    if (!entityId || !name || !startTime || !endTime || !creator) {
      return NextResponse.json(
        { error: "entityId, name, startTime, endTime, and creator are required" },
        { status: 400 }
      );
    }

    // Verify entity exists
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const eventLat = latitude ?? entity.latitude ?? 0;
    const eventLng = longitude ?? entity.longitude ?? 0;

    // Upload event name to IPFS for on-chain reference
    let nameHash: string;
    try {
      nameHash = await uploadToIPFS({ name, description });
    } catch {
      nameHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(36))
        .join("")
        .slice(0, 32);
    }

    const latScaled = Math.round(eventLat * 10000).toString();
    const lngScaled = Math.round(eventLng * 10000).toString();
    const startUnix = Math.floor(new Date(startTime).getTime() / 1000);
    const endUnix = Math.floor(new Date(endTime).getTime() / 1000);

    const gasCost = estimateGasCost("presence_event");
    const result = await createPresenceEventOnChain(
      entityId,
      nameHash,
      startUnix,
      endUnix,
      latScaled,
      lngScaled,
      radius
    );

    const id = `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const event = await prisma.presenceEvent.create({
      data: {
        id,
        entityId,
        name,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        latitude: eventLat,
        longitude: eventLng,
        radius,
        creator,
        txHash: result.txHash,
      },
    });

    return NextResponse.json(
      {
        ...event,
        onChain: {
          txHash: result.txHash,
          nameHash,
          paymaster: "AVNU",
          gasCost: gasCost.estimatedUSD,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
