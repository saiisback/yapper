import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EntityPageClient } from "./client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;

  const entity = await prisma.entity.findUnique({
    where: { slug },
    select: { name: true, description: true, avgRating: true, reviewCount: true },
  });

  if (!entity) {
    return { title: "Place — Yap Me." };
  }

  return {
    title: `${entity.name} — Yap Me. Reviews`,
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

  entity = await prisma.entity.findUnique({
    where: { slug },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!entity) {
    notFound();
  }

  reviews = entity.reviews;

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
