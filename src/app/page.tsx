"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { EntityCard } from "@/components/EntityCard";
import { ReviewCard } from "@/components/ReviewCard";
import { MapPin, TrendingUp, Clock, ChevronRight, Plus } from "lucide-react";

interface Entity {
  id: string;
  slug: string;
  type: string;
  name: string;
  category: string | null;
  address: string | null;
  imageUrl: string | null;
  avgRating: number;
  reviewCount: number;
}

interface Review {
  id: string;
  rating: number;
  contentText: string;
  authorName: string | null;
  identityMode: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  hidden: boolean;
}

const CATEGORIES = [
  "All",
  "Restaurants",
  "Cafes",
  "Shops",
  "Creators",
  "Products",
];

export default function HomePage() {
  const [nearbyPlaces, setNearbyPlaces] = useState<Entity[]>([]);
  const [trendingReviews, setTrendingReviews] = useState<Review[]>([]);
  const [recentEntities, setRecentEntities] = useState<Entity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [placesRes, reviewsRes] = await Promise.all([
          fetch("/api/places?limit=8"),
          fetch("/api/reviews?sort=trending&limit=6"),
        ]);

        if (placesRes.ok) {
          const placesData = await placesRes.json();
          setNearbyPlaces(placesData.entities?.slice(0, 4) ?? []);
          setRecentEntities(placesData.entities?.slice(4, 8) ?? []);
        }

        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setTrendingReviews(reviewsData.reviews ?? []);
        }
      } catch {
        // API not ready yet
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
      {/* Top row */}
      <section className="mb-8 flex items-center justify-between">
        <Link
          href="/explore"
          className="flex items-center gap-2 rounded-full bg-warm-yellow px-5 py-2.5 text-sm font-semibold text-[#111111] transition-all hover:brightness-110"
        >
          <Plus className="size-4" />
          Add a Place
        </Link>
        <div className="flex size-11 items-center justify-center rounded-full bg-[#222222]">
          <span className="text-sm font-bold text-white">Y</span>
        </div>
      </section>

      {/* Heading */}
      <section className="mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
          Discover &<br />Review Places
        </h1>
      </section>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-[#A0A0A0]">Find and rate the best spots</p>
        <Link href="/explore" className="text-sm font-medium text-[#A0A0A0] hover:text-warm-yellow transition-colors">
          See all
        </Link>
      </div>

      {/* Category pills — horizontal scroll */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all border ${
              selectedCategory === cat
                ? "bg-warm-yellow text-[#111111] border-warm-yellow"
                : "bg-transparent text-[#A0A0A0] border-[#333333] hover:border-[#A0A0A0]"
            }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-10">
        <SearchBar placeholder="Search restaurants, cafes, creators..." />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Near You */}
          <section className="mb-12">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-coral/20">
                  <MapPin className="h-4 w-4 text-coral" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Near You</h2>
              </div>
              <Link href="/explore" className="flex items-center gap-1 text-sm font-medium text-[#A0A0A0] hover:text-warm-yellow transition-colors">
                See all <ChevronRight className="size-4" />
              </Link>
            </div>
            {nearbyPlaces.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {nearbyPlaces.map((entity, i) => (
                  <EntityCard key={entity.id} entity={entity} colorIndex={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
                <MapPin className="mx-auto mb-3 h-10 w-10 text-[#A0A0A0]/30" />
                <p className="text-[#A0A0A0]">No places found yet. Be the first to add one!</p>
              </div>
            )}
          </section>

          {/* Trending Reviews */}
          <section className="mb-12">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-warm-yellow/20">
                  <TrendingUp className="h-4 w-4 text-warm-yellow" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Trending Reviews</h2>
              </div>
            </div>
            {trendingReviews.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trendingReviews.map((review, i) => (
                  <ReviewCard key={review.id} review={review} colorIndex={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-[#A0A0A0]/30" />
                <p className="text-[#A0A0A0]">No reviews yet. Write the first review!</p>
              </div>
            )}
          </section>

          {/* Recently Added */}
          <section className="mb-12">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-lime/20">
                  <Clock className="h-4 w-4 text-lime" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Recently Added</h2>
              </div>
              <Link href="/explore" className="flex items-center gap-1 text-sm font-medium text-[#A0A0A0] hover:text-warm-yellow transition-colors">
                See all <ChevronRight className="size-4" />
              </Link>
            </div>
            {recentEntities.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recentEntities.map((entity, i) => (
                  <EntityCard key={entity.id} entity={entity} colorIndex={i + 2} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-[#A0A0A0]/30" />
                <p className="text-[#A0A0A0]">Nothing here yet. Start exploring!</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
