import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all"; // "all" | "month" | "week"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  try {
    const now = new Date();
    let dateFilter: Date | undefined;

    if (period === "week") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const where = dateFilter ? { createdAt: { gte: dateFilter } } : {};

    // Get unique places and total proofs per user
    const userStats = await prisma.proof.groupBy({
      by: ["userId"],
      where,
      _count: { id: true },
    });

    // For each user, get unique entity count
    const leaderboard = await Promise.all(
      userStats.map(async (stat) => {
        const uniqueEntities = await prisma.proof.groupBy({
          by: ["entityId"],
          where: {
            userId: stat.userId,
            ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
          },
        });

        // Get user profile for pseudonym
        const profile = await prisma.userProfile.findUnique({
          where: { address: stat.userId },
          select: { pseudonym: true, avatarUrl: true },
        });

        return {
          userId: stat.userId,
          pseudonym: profile?.pseudonym ?? `Explorer ${stat.userId.slice(0, 6)}`,
          avatarUrl: profile?.avatarUrl ?? null,
          uniquePlaces: uniqueEntities.length,
          totalProofs: stat._count.id,
        };
      })
    );

    // Sort: primary = unique places, tiebreaker = total proofs
    leaderboard.sort((a, b) => {
      if (b.uniquePlaces !== a.uniquePlaces) return b.uniquePlaces - a.uniquePlaces;
      return b.totalProofs - a.totalProofs;
    });

    const ranked = leaderboard.slice(0, limit).map((entry, i) => ({
      rank: i + 1,
      ...entry,
    }));

    return NextResponse.json({ leaderboard: ranked, period });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ leaderboard: [], period });
  }
}
