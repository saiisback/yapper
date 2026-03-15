import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EntityPageClient } from "./client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;

  let entity;
  try {
    entity = await prisma.entity.findUnique({
      where: { slug },
      select: { name: true, description: true, avgRating: true, reviewCount: true },
    });
  } catch {
    // DB not available
  }

  if (!entity) {
    return { title: "Place — Yapper" };
  }

  return {
    title: `${entity.name} — Yapper Reviews`,
    description:
      entity.description ??
      `Read ${entity.reviewCount} reviews of ${entity.name}. Average rating: ${entity.avgRating.toFixed(1)}/5`,
  };
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params;

  let entity;
  let reviews: {
    id: string;
    rating: number;
    contentText: string;
    authorName: string | null;
    identityMode: string;
    upvotes: number;
    downvotes: number;
    createdAt: Date;
    hidden: boolean;
  }[] = [];

  try {
    entity = await prisma.entity.findUnique({
      where: { slug },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (entity) {
      reviews = entity.reviews;
    }
  } catch {
    // DB not ready — show placeholder
    entity = null;
  }

  if (!entity) {
    // Show a placeholder if DB isn't connected yet
    return (
      <EntityPageClient
        entity={{
          id: slug,
          slug,
          type: "place",
          name: slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          category: null,
          description: null,
          address: null,
          imageUrl: null,
          avgRating: 0,
          reviewCount: 0,
        }}
        reviews={[]}
      />
    );
  }

  return (
    <EntityPageClient
      entity={{
        id: entity.id,
        slug: entity.slug,
        type: entity.type,
        name: entity.name,
        category: entity.category,
        description: entity.description,
        address: entity.address,
        imageUrl: entity.imageUrl,
        avgRating: entity.avgRating,
        reviewCount: entity.reviewCount,
      }}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        contentText: r.contentText,
        authorName: r.authorName,
        identityMode: r.identityMode,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        createdAt: r.createdAt.toISOString(),
        hidden: r.hidden,
      }))}
    />
  );
}
