"use client";

import { useState } from "react";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewForm } from "@/components/ReviewForm";
import { MapPin, PenLine, Eye, EyeOff, ChevronLeft, SlidersHorizontal, ExternalLink } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import Link from "next/link";
import { type ReactionType } from "@/components/ReactionBar";

const STARKSCAN_TX_URL = "https://starkscan.co/tx/";

interface EntityData {
  id: string;
  slug: string;
  type: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  avgRating: number;
  reviewCount: number;
}

interface ReactionCounts {
  fire: number;
  skull: number;
  love: number;
  gross: number;
  cap: number;
}

interface ReviewData {
  id: string;
  rating: number;
  contentText: string;
  authorName: string | null;
  identityMode: string;
  reactions: ReactionCounts;
  createdAt: string;
  hidden: boolean;
  txHash?: string;
}

interface Props {
  entity: EntityData;
  reviews: ReviewData[];
}

export function EntityPageClient({ entity, reviews: initialReviews }: Props) {
  const { user } = usePrivy();
  const [reviews, setReviews] = useState(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState("helpful");

  const visibleReviews = showHidden
    ? reviews
    : reviews.filter((r) => !r.hidden);

  const sortedReviews = [...visibleReviews].sort((a, b) => {
    switch (sortBy) {
      case "helpful": {
        const scoreA = a.reactions.fire * 1.5 + a.reactions.love * 1.2 + a.reactions.skull - a.reactions.cap;
        const scoreB = b.reactions.fire * 1.5 + b.reactions.love * 1.2 + b.reactions.skull - b.reactions.cap;
        return scoreB - scoreA;
      }
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "highest":
        return b.rating - a.rating;
      case "lowest":
        return a.rating - b.rating;
      default:
        return 0;
    }
  });

  const hiddenCount = reviews.filter((r) => r.hidden).length;

  async function handleSubmitReview(data: {
    rating: number;
    text: string;
    identityMode: string;
    image?: File | null;
  }) {
    const authorAddress = user?.wallet?.address ?? user?.id;

    try {
      let res: Response;

      if (data.image) {
        // Use FormData for image uploads — sent as multipart/form-data
        const formData = new FormData();
        formData.append("entityId", entity.id);
        formData.append("rating", data.rating.toString());
        formData.append("contentText", data.text);
        formData.append("identityMode", data.identityMode);
        if (authorAddress) formData.append("authorAddress", authorAddress);
        formData.append("image", data.image);

        res = await fetch("/api/reviews", {
          method: "POST",
          body: formData,
        });
      } else {
        // JSON body when no image
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: entity.id,
            rating: data.rating,
            contentText: data.text,
            identityMode: data.identityMode,
            authorAddress,
          }),
        });
      }

      if (!res.ok) throw new Error("Failed to post review");

      const result = await res.json();
      setReviews((prev) => [result, ...prev]);
      setShowReviewForm(false);
      const txHash = result.onChain?.txHash ?? result.txHash;
      if (txHash) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Review posted on-chain!</span>
            <a
              href={`${STARKSCAN_TX_URL}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              View transaction <ExternalLink className="size-3" />
            </a>
          </div>
        );
      } else {
        toast.success("Review posted successfully!");
      }
    } catch {
      toast.error("Failed to post review. Please try again.");
    }
  }

  async function handleReact(reviewId: string, reaction: ReactionType) {
    const voterAddress = user?.wallet?.address ?? user?.id;

    // Optimistic update
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId) return r;
        return {
          ...r,
          reactions: {
            ...r.reactions,
            [reaction]: r.reactions[reaction] + 1,
          },
        };
      })
    );

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, voteType: reaction, voterAddress }),
      });

      if (!res.ok) throw new Error("Vote failed");

      const result = await res.json();
      if (result.reactions) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, reactions: result.reactions } : r
          )
        );
      }
      const voteTxHash = result.onChain?.txHash ?? result.txHash;
      if (voteTxHash) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Vote recorded on-chain!</span>
            <a
              href={`${STARKSCAN_TX_URL}${voteTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              View transaction <ExternalLink className="size-3" />
            </a>
          </div>
        );
      }
    } catch {
      // Rollback optimistic update
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId) return r;
          return {
            ...r,
            reactions: {
              ...r.reactions,
              [reaction]: Math.max(0, r.reactions[reaction] - 1),
            },
          };
        })
      );
      toast.error("Failed to cast vote");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/explore" className="flex size-11 items-center justify-center rounded-full bg-[#222222] text-[#A0A0A0] hover:text-white transition-colors">
          <ChevronLeft className="size-5" />
        </Link>
        <button
          onClick={() => setShowReviewForm(true)}
          className="flex items-center gap-2 rounded-full bg-[#222222] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#2A2A2A] transition-colors"
        >
          <PenLine className="size-4" />
          Write Review
        </button>
      </div>

      {/* Hero Image */}
      {entity.imageUrl && (
        <div className="mb-6 h-56 overflow-hidden rounded-3xl sm:h-72">
          <img
            src={entity.imageUrl}
            alt={entity.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Entity detail card — lime green like reference */}
      <div className="mb-8 rounded-3xl bg-lime p-6">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-[#111111]">{entity.name}</h1>

        {entity.description && (
          <p className="mb-4 text-sm leading-relaxed text-[#111111]/70">
            {entity.description}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {entity.category && (
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#111111]">
              {entity.category}
            </span>
          )}
          <span className="rounded-full bg-white px-4 py-1.5 text-xs font-medium capitalize text-[#111111]">
            {entity.type}
          </span>
        </div>

        {entity.address && (
          <p className="mb-5 flex items-center gap-1.5 text-sm text-[#111111]/60">
            <MapPin className="h-4 w-4 shrink-0" />
            {entity.address}
          </p>
        )}

        {/* Rating pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2.5">
            <span className="text-lg font-bold text-warm-yellow">
              {entity.avgRating.toFixed(1)}
            </span>
            <StarRating value={entity.avgRating} readonly size="sm" />
          </div>
          <span className="text-sm text-[#111111]/60">
            {entity.reviewCount} review{entity.reviewCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="mb-8">
          <ReviewForm
            entityId={entity.id}
            entityName={entity.name}
            onSubmit={handleSubmitReview}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {/* Reviews section */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-white">Reviews</h2>
        <div className="flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2">
          <SlidersHorizontal className="size-4 text-[#A0A0A0]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-sm font-medium text-white outline-none"
          >
            <option value="helpful" className="bg-[#222222]">Most Helpful</option>
            <option value="newest" className="bg-[#222222]">Newest</option>
            <option value="highest" className="bg-[#222222]">Highest Rated</option>
            <option value="lowest" className="bg-[#222222]">Lowest Rated</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {sortedReviews.length > 0 ? (
          sortedReviews.map((review, i) => (
            <ReviewCard key={review.id} review={review} onReact={handleReact} colorIndex={i} />
          ))
        ) : (
          <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
            <PenLine className="mx-auto mb-3 h-10 w-10 text-[#A0A0A0]/30" />
            <p className="text-[#A0A0A0]">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-6 text-center">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[#222222] px-5 py-2.5 text-sm text-[#A0A0A0] transition-colors hover:text-white"
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? (
              <>
                <EyeOff className="size-4" />
                Hide community-hidden reviews
              </>
            ) : (
              <>
                <Eye className="size-4" />
                Show {hiddenCount} hidden review{hiddenCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
