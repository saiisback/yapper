"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { EntityCard } from "@/components/EntityCard";
import { ReviewCard } from "@/components/ReviewCard";
import { MapPin, Users, Package } from "lucide-react";

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
  reactions: { fire: number; skull: number; love: number; gross: number; cap: number };
  createdAt: string;
  hidden: boolean;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [places, setPlaces] = useState<Entity[]>([]);
  const [creators, setCreators] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Entity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("places");

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    async function search() {
      try {
        const [placesRes, reviewsRes] = await Promise.all([
          fetch(`/api/places?q=${encodeURIComponent(query)}`),
          fetch(`/api/reviews?q=${encodeURIComponent(query)}`),
        ]);

        if (placesRes.ok) {
          const data = await placesRes.json();
          const entities: Entity[] = data.entities ?? [];
          setPlaces(entities.filter((e) => e.type === "place"));
          setCreators(entities.filter((e) => e.type === "creator"));
          setProducts(entities.filter((e) => e.type === "product"));
        }

        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setReviews(data.reviews ?? []);
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [query]);

  const totalResults = places.length + creators.length + products.length + reviews.length;

  const tabs = [
    { id: "places", label: "Places", count: places.length, icon: MapPin },
    { id: "creators", label: "Creators", count: creators.length, icon: Users },
    { id: "products", label: "Products", count: products.length, icon: Package },
  ];

  function getActiveEntities() {
    switch (activeTab) {
      case "places": return places;
      case "creators": return creators;
      case "products": return products;
      default: return places;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <SearchBar defaultValue={query} placeholder="Search..." />
      </div>

      {!query ? (
        <div className="rounded-3xl bg-[#222222] p-12 text-center">
          <p className="text-[#A0A0A0]">
            Enter a search term to find places, creators, and products.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
        </div>
      ) : totalResults === 0 ? (
        <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
          <p className="text-lg text-[#A0A0A0]">No results for &quot;{query}&quot;</p>
          <p className="mt-1 text-sm text-[#A0A0A0]/60">Try different keywords or browse places.</p>
        </div>
      ) : (
        <>
          <p className="mb-5 text-sm text-[#A0A0A0]">
            {totalResults} result{totalResults !== 1 ? "s" : ""} for &quot;{query}&quot;
          </p>

          {/* Tabs — pill toggle */}
          <div className="mb-8 flex gap-1 rounded-full bg-[#111111] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-warm-yellow text-[#111111]"
                    : "text-[#A0A0A0]"
                }`}
              >
                <tab.icon className="size-4" />
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="mb-8">
            {getActiveEntities().length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {getActiveEntities().map((e, i) => (
                  <EntityCard key={e.id} entity={e} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[#A0A0A0]">
                No {activeTab} found.
              </p>
            )}
          </div>

          {reviews.length > 0 && (
            <div>
              <h3 className="mb-5 text-xl font-bold tracking-tight text-white">
                Matching Reviews ({reviews.length})
              </h3>
              <div className="space-y-4">
                {reviews.map((r, i) => (
                  <ReviewCard key={r.id} review={r} colorIndex={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
