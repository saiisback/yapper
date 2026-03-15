"use client"

import { useEffect } from "react"
import { X, EyeOff, User, Globe, Calendar, ExternalLink, Share2 } from "lucide-react"
import { StarRating } from "@/components/StarRating"
import { ReactionBar, type ReactionType } from "@/components/ReactionBar"

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
}

interface ReviewTakeoverProps {
  review: FeedReview
  onClose: () => void
  onReact?: (reviewId: string, reaction: ReactionType) => void
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getIdentityDisplay(mode: string, name: string | null) {
  switch (mode) {
    case "anonymous":
      return { label: "Anonymous", icon: EyeOff }
    case "pseudonymous":
      return { label: name || "Pseudonymous User", icon: User }
    case "public":
      return { label: name || "Public User", icon: Globe }
    default:
      return { label: "Anonymous", icon: EyeOff }
  }
}

const PLACEHOLDER_IMAGES = [
  "linear-gradient(135deg, #D4E596 0%, #FFD874 100%)",
  "linear-gradient(135deg, #FFD874 0%, #FF6B6B 100%)",
  "linear-gradient(135deg, #FF6B6B 0%, #E0E4E8 100%)",
  "linear-gradient(135deg, #E0E4E8 0%, #D4E596 100%)",
]

export function ReviewTakeover({ review, onClose, onReact }: ReviewTakeoverProps) {
  const identity = getIdentityDisplay(review.identityMode, review.authorName)
  const IdentityIcon = identity.icon
  const placeholderBg = PLACEHOLDER_IMAGES[review.id.charCodeAt(review.id.length - 1) % PLACEHOLDER_IMAGES.length]

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl min-h-screen md:min-h-0 md:my-8 bg-[#1A1A1A] md:rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image / Gradient header */}
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          {review.entityImageUrl ? (
            <img
              src={review.entityImageUrl}
              alt={review.entityName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: placeholderBg }}
            />
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70"
          >
            <X className="size-5" />
          </button>

          {/* Share button */}
          <button
            className="absolute top-4 right-16 flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70"
          >
            <Share2 className="size-5" />
          </button>

          {/* Entity name overlay */}
          <div className="absolute bottom-4 left-5 right-5">
            <a
              href={`/place/${review.entitySlug}`}
              className="group inline-flex items-center gap-2"
            >
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                {review.entityName}
              </h2>
              <ExternalLink className="size-4 text-white/60 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            {review.entityCategory && (
              <span className="mt-1 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                {review.entityCategory}
              </span>
            )}
          </div>
        </div>

        {/* Review content */}
        <div className="p-5 md:p-6">
          {/* Author + rating */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#2A2A2A]">
                <IdentityIcon className="size-4 text-[#A0A0A0]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{identity.label}</p>
                <div className="flex items-center gap-2 text-xs text-[#A0A0A0]">
                  <Calendar className="size-3" />
                  <span>{timeAgo(review.createdAt)}</span>
                </div>
              </div>
            </div>
            <StarRating value={review.rating} size="md" readonly />
          </div>

          {/* Review text */}
          <p className="mb-6 text-base leading-relaxed text-white/90">
            {review.contentText}
          </p>

          {/* Tags */}
          {review.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {review.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#2A2A2A] px-3 py-1 text-xs font-medium text-warm-yellow"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="mb-4 border-t border-[#333333]" />

          {/* Full reaction bar */}
          <ReactionBar
            reviewId={review.id}
            reactions={review.reactions}
            onReact={onReact}
          />
        </div>
      </div>
    </div>
  )
}
