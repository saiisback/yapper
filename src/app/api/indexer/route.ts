import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Indexer webhook — receives on-chain events and updates the PostgreSQL cache
// In production, this would be called by Apibara or a custom indexer service

interface OnChainEvent {
  eventType: string;
  data: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.INDEXER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event: OnChainEvent = await req.json();

  try {
    switch (event.eventType) {
      case "EntityAdded": {
        const { entityId, entityType, metadataHash, creator } = event.data as {
          entityId: string;
          entityType: string;
          metadataHash: string;
          creator: string;
        };

        const typeMap: Record<string, string> = {
          "1": "place",
          "2": "creator",
          "3": "product",
        };

        // Fetch metadata from IPFS
        // const metadata = await fetch(ipfsUrl(metadataHash)).then(r => r.json());

        await prisma.entity.upsert({
          where: { id: entityId },
          update: { metadataHash },
          create: {
            id: entityId,
            type: typeMap[entityType] ?? "place",
            name: `Entity ${entityId}`,
            slug: `entity-${entityId}`,
            metadataHash,
            source: "user",
          },
        });
        break;
      }

      case "ReviewPosted": {
        const { reviewId, entityId, contentHash, rating, author, identityMode } =
          event.data as {
            reviewId: string;
            entityId: string;
            contentHash: string;
            rating: number;
            author: string;
            identityMode: string;
          };

        // Fetch review content from IPFS
        // const content = await fetch(ipfsUrl(contentHash)).then(r => r.json());

        await prisma.review.upsert({
          where: { id: reviewId },
          update: {},
          create: {
            id: reviewId,
            entityId,
            contentHash,
            contentText: "", // Populated from IPFS
            rating,
            authorAddress: author,
            identityMode,
            txHash: event.txHash,
          },
        });

        // Update entity aggregate
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
        break;
      }

      case "VoteCast": {
        const { reviewId, voter, voteType } = event.data as {
          reviewId: string;
          voter: string;
          voteType: string;
        };

        await prisma.vote.upsert({
          where: {
            reviewId_voterAddress: {
              reviewId,
              voterAddress: voter,
            },
          },
          update: { voteType },
          create: {
            reviewId,
            voterAddress: voter,
            voteType,
            txHash: event.txHash,
          },
        });

        // Recalculate reaction counts (fire, skull, love, gross, cap)
        const reactionTypes = ["fire", "skull", "love", "gross", "cap"] as const;
        const reactionFieldMap: Record<string, string> = {
          fire: "fireCount",
          skull: "skullCount",
          love: "loveCount",
          gross: "grossCount",
          cap: "capCount",
        };

        const counts = await Promise.all(
          reactionTypes.map(async (reaction) => {
            const count = await prisma.vote.count({
              where: { reviewId, voteType: reaction },
            });
            return [reactionFieldMap[reaction], count] as const;
          })
        );

        await prisma.review.update({
          where: { id: reviewId },
          data: Object.fromEntries(counts),
        });
        break;
      }

      case "ReviewReported": {
        const { reviewId } = event.data as { reviewId: string };

        const review = await prisma.review.update({
          where: { id: reviewId },
          data: { reportCount: { increment: 1 } },
        });

        // Hide if threshold reached
        if (review.reportCount >= 10) {
          await prisma.review.update({
            where: { id: reviewId },
            data: { hidden: true },
          });
        }
        break;
      }

      case "UserVerified": {
        const { address, zkProofHash } = event.data as {
          address: string;
          zkProofHash: string;
        };

        await prisma.userProfile.upsert({
          where: { address },
          update: {},
          create: {
            address,
            zkProofHash,
          },
        });
        break;
      }

      case "ProofRecorded": {
        const { proofId, user, entityId, eventId, photoHash, timestamp } =
          event.data as {
            proofId: string;
            user: string;
            entityId: string;
            eventId: string;
            photoHash: string;
            timestamp: number;
          };

        await prisma.proof.upsert({
          where: { id: proofId },
          update: {},
          create: {
            id: proofId,
            userId: user,
            entityId,
            eventId: eventId !== "0" ? eventId : null,
            photoHash,
            photoUrl: `https://gateway.pinata.cloud/ipfs/${photoHash}`,
            userLatitude: 0,
            userLongitude: 0,
            txHash: event.txHash,
          },
        });

        // Update event proof count if applicable
        if (eventId && eventId !== "0") {
          await prisma.presenceEvent.update({
            where: { id: eventId },
            data: { proofCount: { increment: 1 } },
          }).catch(() => {
            // Event may not exist in cache yet
          });
        }
        break;
      }

      case "EventCreated": {
        const { eventId, entityId, creator, startTime, endTime } =
          event.data as {
            eventId: string;
            entityId: string;
            creator: string;
            startTime: number;
            endTime: number;
          };

        await prisma.presenceEvent.upsert({
          where: { id: eventId },
          update: {},
          create: {
            id: eventId,
            entityId,
            name: `Event ${eventId}`,
            startTime: new Date(startTime * 1000),
            endTime: new Date(endTime * 1000),
            latitude: 0,
            longitude: 0,
            creator,
            txHash: event.txHash,
          },
        });
        break;
      }

      default:
        console.warn(`Unknown event type: ${event.eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Indexer webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process event" },
      { status: 500 }
    );
  }
}
