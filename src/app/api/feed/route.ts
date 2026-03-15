import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Mixed feed: 40% trending, 30% random, 30% new
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);
  const tag = searchParams.get("tag");
  const filter = searchParams.get("filter"); // "trending" | "new" | "foryou" | null

  try {
    const baseWhere: Record<string, unknown> = { hidden: false };
    if (tag) {
      baseWhere.tags = { has: tag };
    }

    const includeEntity = {
      entity: {
        select: {
          name: true,
          slug: true,
          type: true,
          imageUrl: true,
          category: true,
        },
      },
    };

    let reviews;

    if (filter === "trending") {
      // Pure trending — weighted reaction score
      reviews = await prisma.review.findMany({
        where: baseWhere,
        include: includeEntity,
        orderBy: [{ fireCount: "desc" }, { loveCount: "desc" }, { createdAt: "desc" }],
        take: limit,
      });
    } else if (filter === "new") {
      // Pure new
      reviews = await prisma.review.findMany({
        where: baseWhere,
        include: includeEntity,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } else {
      // Mixed feed: blend trending (40%), random (30%), new (30%)
      const trendingCount = Math.ceil(limit * 0.4);
      const newCount = Math.ceil(limit * 0.3);
      const randomCount = limit - trendingCount - newCount;

      const [trending, newest, totalCount] = await Promise.all([
        prisma.review.findMany({
          where: baseWhere,
          include: includeEntity,
          orderBy: [{ fireCount: "desc" }, { loveCount: "desc" }],
          take: trendingCount,
        }),
        prisma.review.findMany({
          where: baseWhere,
          include: includeEntity,
          orderBy: { createdAt: "desc" },
          take: newCount,
        }),
        prisma.review.count({ where: baseWhere }),
      ]);

      // Get random reviews by skipping a random offset
      let random: typeof trending = [];
      if (totalCount > 0 && randomCount > 0) {
        const maxSkip = Math.max(0, totalCount - randomCount);
        const skip = Math.floor(Math.random() * (maxSkip + 1));
        random = await prisma.review.findMany({
          where: baseWhere,
          include: includeEntity,
          skip,
          take: randomCount,
        });
      }

      // Merge and deduplicate
      const seen = new Set<string>();
      const merged: typeof trending = [];

      for (const r of [...trending, ...random, ...newest]) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          merged.push(r);
        }
      }

      // Interleave: trending, random, new, trending, random, new...
      const trendingPool = trending.filter((r) => merged.includes(r));
      const randomPool = random.filter((r) => !trending.some((t) => t.id === r.id));
      const newPool = newest.filter(
        (r) => !trending.some((t) => t.id === r.id) && !random.some((rand) => rand.id === r.id)
      );

      reviews = [];
      const pools = [trendingPool, randomPool, newPool];
      const indices = [0, 0, 0];
      let poolIndex = 0;

      while (reviews.length < limit) {
        let added = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const pi = (poolIndex + attempt) % 3;
          if (indices[pi] < pools[pi].length) {
            reviews.push(pools[pi][indices[pi]]);
            indices[pi]++;
            added = true;
            break;
          }
        }
        if (!added) break;
        poolIndex = (poolIndex + 1) % 3;
      }
    }

    // Transform to feed format
    const feed = (reviews ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      contentText: r.contentText,
      authorName: r.authorName,
      identityMode: r.identityMode,
      createdAt: r.createdAt.toISOString(),
      hidden: r.hidden,
      entityName: r.entity.name,
      entitySlug: r.entity.slug,
      entityType: r.entity.type,
      entityImageUrl: r.entity.imageUrl,
      entityCategory: r.entity.category,
      tags: r.tags,
      imageUrl: r.imageUrl,
      reactions: {
        fire: r.fireCount,
        skull: r.skullCount,
        love: r.loveCount,
        gross: r.grossCount,
        cap: r.capCount,
      },
    }));

    return NextResponse.json({ feed });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return NextResponse.json({ feed: [] });
  }
}
