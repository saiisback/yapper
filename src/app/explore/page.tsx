"use client";

import { useEffect, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { EntityCard } from "@/components/EntityCard";
import { MapView } from "@/components/MapView";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";

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
  latitude?: number;
  longitude?: number;
}

const CATEGORIES = [
  "All",
  "Restaurants",
  "Cafes",
  "Bars",
  "Shops",
  "Parks",
  "Entertainment",
];

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "reviews", label: "Most Reviewed" },
  { value: "newest", label: "Newest" },
  { value: "distance", label: "Distance" },
];

export default function ExplorePage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("rating");

  useEffect(() => {
    async function fetchEntities() {
      try {
        const params = new URLSearchParams({ sort: sortBy, limit: "50" });
        if (selectedCategory !== "All") {
          params.set("category", selectedCategory);
        }
        const res = await fetch(`/api/places?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEntities(data.entities ?? []);
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }

    fetchEntities();
  }, [selectedCategory, sortBy]);

  const mapPlaces = entities
    .filter((e) => e.latitude && e.longitude)
    .map((e) => ({
      id: e.id,
      name: e.name,
      latitude: e.latitude!,
      longitude: e.longitude!,
      avgRating: e.avgRating,
    }));

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-white">Explore</h1>
        <p className="text-sm text-[#A0A0A0]">Discover amazing places near you</p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <SearchBar placeholder="Search places near you..." />
      </div>

      {/* Controls */}
      <div className="mb-5 flex items-center gap-3">
        {/* View toggle — pill */}
        <div className="flex rounded-full bg-[#111111] p-1">
          <button
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              viewMode === "list" ? "bg-warm-yellow text-[#111111]" : "text-[#A0A0A0]"
            }`}
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
            List
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              viewMode === "map" ? "bg-warm-yellow text-[#111111]" : "text-[#A0A0A0]"
            }`}
            onClick={() => setViewMode("map")}
          >
            <MapIcon className="size-4" />
            Map
          </button>
        </div>

        {/* Sort — pill */}
        <div className="flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2">
          <SlidersHorizontal className="size-4 text-[#A0A0A0]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-sm font-medium text-white outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#222222]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
        </div>
      ) : viewMode === "map" ? (
        <div className="h-[calc(100vh-20rem)] min-h-[400px] overflow-hidden rounded-3xl border border-[#333333]">
          <MapView
            places={mapPlaces}
            center={{ lat: 12.9716, lng: 77.5946 }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entities.length > 0 ? (
            entities.map((entity, i) => (
              <EntityCard key={entity.id} entity={entity} colorIndex={i} />
            ))
          ) : (
            <div className="col-span-full rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
              <p className="text-lg text-[#A0A0A0]">No places found.</p>
              <p className="mt-1 text-sm text-[#A0A0A0]/60">Try adjusting your filters or add a new place.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
