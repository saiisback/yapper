import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitPresenceProofOnChain } from "@/lib/starkzap";
import { ipfsUrl } from "@/lib/ipfs";
import { getPlaceDetails, mapGoogleCategory } from "@/lib/google-places";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let entityId: string;
    let eventId: string | null = null;
    let caption: string | undefined;
    let userLatitude: number;
    let userLongitude: number;
    let userId: string;
    let photoFile: Blob | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      entityId = formData.get("entityId") as string;
      eventId = (formData.get("eventId") as string) || null;
      caption = (formData.get("caption") as string) || undefined;
      userLatitude = parseFloat(formData.get("userLatitude") as string);
      userLongitude = parseFloat(formData.get("userLongitude") as string);
      userId = formData.get("userId") as string;

      const file = formData.get("photo") as File | null;
      if (file && file.size > 0) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json(
            { error: "Photo must be JPEG, PNG, or WebP" },
            { status: 400 }
          );
        }
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Photo must be under 10MB" },
            { status: 400 }
          );
        }
        photoFile = file;
      }
    } else {
      const body = await req.json();
      entityId = body.entityId;
      eventId = body.eventId || null;
      caption = body.caption;
      userLatitude = body.userLatitude;
      userLongitude = body.userLongitude;
      userId = body.userId;
    }

    if (!entityId || !userId || isNaN(userLatitude) || isNaN(userLongitude)) {
      return NextResponse.json(
        { error: "entityId, userId, userLatitude, and userLongitude are required" },
        { status: 400 }
      );
    }

    // Verify entity exists — if it's a Google Place, auto-create in DB
    let entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity && entityId.startsWith("google_")) {
      const placeId = entityId.replace("google_", "");
      try {
        const gPlace = await getPlaceDetails(placeId);
        const slug = gPlace.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        entity = await prisma.entity.create({
          data: {
            id: entityId,
            type: "place",
            name: gPlace.name,
            slug: `${slug}-${Date.now()}`,
            address: gPlace.formatted_address,
            category: mapGoogleCategory(gPlace.types),
            latitude: gPlace.geometry.location.lat,
            longitude: gPlace.geometry.location.lng,
            avgRating: gPlace.rating ?? 0,
            reviewCount: gPlace.user_ratings_total ?? 0,
            source: "google_places",
          },
        });
      } catch (err) {
        console.error("Failed to fetch Google Place details:", err);
        return NextResponse.json({ error: "Entity not found" }, { status: 404 });
      }
    }
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Client-side GPS validation: check 500m radius
    if (entity.latitude && entity.longitude) {
      const distance = haversineDistance(
        userLatitude,
        userLongitude,
        entity.latitude,
        entity.longitude
      );
      if (distance > 500) {
        return NextResponse.json(
          { error: `Too far from location (${Math.round(distance)}m away, max 500m)` },
          { status: 400 }
        );
      }
    }

    // Check duplicate proof today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existingToday = await prisma.proof.findFirst({
      where: {
        userId,
        entityId,
        createdAt: { gte: startOfDay },
      },
    });
    if (existingToday) {
      return NextResponse.json(
        { error: "Already checked in here today" },
        { status: 409 }
      );
    }

    // If event proof, check duplicate
    if (eventId) {
      const existingEvent = await prisma.proof.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (existingEvent) {
        return NextResponse.json(
          { error: "Already proved presence at this event" },
          { status: 409 }
        );
      }
    }

    // Scale GPS coords for on-chain storage (multiply by 10000)
    const latScaled = Math.round(userLatitude * 10000).toString();
    const lngScaled = Math.round(userLongitude * 10000).toString();

    const { txHash, photoHash } = await submitPresenceProofOnChain(
      entityId,
      eventId || "0",
      photoFile,
      latScaled,
      lngScaled,
      caption
    );

    // Cache in PostgreSQL
    const id = `proof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const proof = await prisma.proof.create({
      data: {
        id,
        userId,
        entityId,
        eventId,
        photoHash,
        photoUrl: ipfsUrl(photoHash),
        caption,
        userLatitude,
        userLongitude,
        txHash,
      },
    });

    // Update event proof count if applicable
    if (eventId) {
      await prisma.presenceEvent.update({
        where: { id: eventId },
        data: { proofCount: { increment: 1 } },
      });
    }

    return NextResponse.json(
      {
        ...proof,
        onChain: {
          txHash,
          photoHash,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting proof:", error);
    return NextResponse.json(
      { error: "Failed to submit proof of presence" },
      { status: 500 }
    );
  }
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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
