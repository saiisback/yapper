"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { Plus, Flame, Clock, Sparkles, TrendingUp } from "lucide-react"
import { ReactionBar, type ReactionType } from "@/components/ReactionBar"
import { ReviewTakeover } from "@/components/ReviewTakeover"
import { FloatingPrompt } from "@/components/FloatingPrompt"
import { StarRating } from "@/components/StarRating"
import { EyeOff, User, Globe } from "lucide-react"

interface ReactionCounts {
  fire: number
  skull: number
  love: number
  gross: number
  cap: number
}

interface FeedReview {
  id: string
  rating: number
  contentText: string
  authorName: string | null
  identityMode: string
  createdAt: string
  hidden: boolean
  entityName: string
  entitySlug: string
  entityType: string
  entityImageUrl: string | null
  entityCategory: string | null
  reactions: ReactionCounts
  tags: string[]
  imageUrl: string | null
}

const TRENDING_TAGS = [
  "OverratedPlaces",
  "HiddenGems",
  "HonestReview",
  "WorstService",
  "Underrated",
  "MustTry",
  "NeverAgain",
  "LocalFavorite",
  "TouristTrap",
  "BestInTown",
]

const FEED_FILTERS = [
  { id: "foryou", label: "For You", icon: Sparkles },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "new", label: "New", icon: Clock },
] as const

const CARD_GRADIENTS = [
  "from-lime/20 to-transparent",
  "from-warm-yellow/20 to-transparent",
  "from-coral/20 to-transparent",
  "from-cool-gray/20 to-transparent",
]

const PLACEHOLDER_IMAGES = [
  "linear-gradient(135deg, #D4E596 0%, #FFD874 100%)",
  "linear-gradient(135deg, #FFD874 0%, #FF6B6B 100%)",
  "linear-gradient(135deg, #FF6B6B 0%, #E0E4E8 100%)",
  "linear-gradient(135deg, #E0E4E8 0%, #D4E596 100%)",
]

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

function getIdentityIcon(mode: string) {
  switch (mode) {
    case "anonymous": return EyeOff
    case "pseudonymous": return User
    case "public": return Globe
    default: return EyeOff
  }
}

function getIdentityLabel(mode: string, name: string | null) {
  switch (mode) {
    case "anonymous": return "Anonymous"
    case "pseudonymous": return name || "Pseudonymous"
    case "public": return name || "Public User"
    default: return "Anonymous"
  }
}

export default function HomePage() {
  const [feed, setFeed] = useState<FeedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>("foryou")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedReview, setSelectedReview] = useState<FeedReview | null>(null)

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "30" })
      if (activeFilter !== "foryou") params.set("filter", activeFilter)
      if (activeTag) params.set("tag", activeTag)

      const res = await fetch(`/api/feed?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFeed(data.feed ?? [])
      }
    } catch {
      // API not ready yet
    } finally {
      setLoading(false)
    }
  }, [activeFilter, activeTag])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  const handleReact = async (reviewId: string, reaction: ReactionType) => {
    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, voteType: reaction }),
      })
      // Optimistic update
      setFeed((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId) return r
          return {
            ...r,
            reactions: {
              ...r.reactions,
              [reaction]: r.reactions[reaction] + 1,
            },
          }
        })
      )
    } catch {
      // silent fail
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Top bar — logo + add button */}
      <section className="mb-5 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight text-warm-yellow">Yap Me.</span>
      </section>

      {/* Trending tags — horizontal scroll */}
      <section className="mb-5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                activeTag === tag
                  ? "bg-warm-yellow text-[#111111]"
                  : "bg-[#222222] text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A]"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>

      {/* Feed filter pills */}
      <section className="mb-6 flex gap-2">
        {FEED_FILTERS.map((f) => {
          const Icon = f.icon
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === f.id
                  ? "bg-white text-[#111111]"
                  : "bg-transparent text-[#A0A0A0] border border-[#333333] hover:border-[#A0A0A0]"
              }`}
            >
              <Icon className="size-3.5" />
              {f.label}
            </button>
          )
        })}
      </section>

      {/* Vertical feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
        </div>
      ) : feed.length > 0 ? (
        <div className="flex flex-col gap-5 max-w-lg mx-auto">
          {feed.map((review, i) => {
            const IdentityIcon = getIdentityIcon(review.identityMode)
            const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
            const placeholderBg = PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]
            const imageUrl = review.imageUrl || review.entityImageUrl

            return (
              <div
                key={review.id}
                className="group cursor-pointer overflow-hidden rounded-2xl bg-[#222222] transition-all duration-200 active:scale-[0.98]"
                onClick={() => setSelectedReview(review)}
              >
                {/* Image or gradient placeholder */}
                <div className="relative w-full overflow-hidden aspect-[4/3]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={review.entityName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = "none"
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = "block"
                      }}
                    />
                  ) : null}
                  <div
                    className="h-full w-full absolute inset-0"
                    style={{
                      background: placeholderBg,
                      display: imageUrl ? "none" : "block",
                    }}
                  />

                  {/* Entity name overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                    <p className="text-sm font-bold text-white drop-shadow-md line-clamp-1">
                      {review.entityName}
                    </p>
                  </div>

                  {/* Rating badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                    <StarRating value={review.rating} size="sm" readonly />
                  </div>
                </div>

                {/* Review content */}
                <div className={`bg-gradient-to-b ${gradient} p-4`}>
                  {/* Review snippet */}
                  <p className="mb-3 text-sm leading-relaxed text-white/80 line-clamp-4">
                    {review.contentText}
                  </p>

                  {/* Tags */}
                  {review.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {review.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-warm-yellow"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer: author + reactions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <IdentityIcon className="size-3.5 text-[#A0A0A0]" />
                      <span className="text-xs text-[#A0A0A0] line-clamp-1 max-w-[100px]">
                        {getIdentityLabel(review.identityMode, review.authorName)}
                      </span>
                      <span className="text-xs text-[#555555]">
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>
                    <ReactionBar
                      reviewId={review.id}
                      reactions={review.reactions}
                      onReact={handleReact}
                      compact
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#222222] mb-4">
            <Flame className="size-7 text-[#A0A0A0]/30" />
          </div>
          <p className="text-[#A0A0A0] text-sm mb-1">No reviews yet</p>
          <p className="text-[#555555] text-xs">Be the first to review something!</p>
        </div>
      )}

      {/* Floating "review anything" prompt */}
      <FloatingPrompt />

      {/* Full-screen takeover */}
      {selectedReview && (
        <ReviewTakeover
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onReact={handleReact}
        />
      )}
    </div>
  )
}
