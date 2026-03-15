"use client"

import { useState } from "react"
import { EyeOff, User, Globe, AlertTriangle, ChevronDown, Calendar } from "lucide-react"
import { StarRating } from "@/components/StarRating"
import { VoteButtons } from "@/components/VoteButtons"

interface Review {
  id: string
  rating: number
  contentText: string
  authorName: string | null
  identityMode: string
  upvotes: number
  downvotes: number
  createdAt: string
  hidden: boolean
}

interface ReviewCardProps {
  review: Review
  onVote?: (reviewId: string, voteType: "up" | "down") => void
  colorIndex?: number
}

const REVIEW_COLORS = [
  "bg-lime",
  "bg-warm-yellow",
  "bg-cool-gray",
  "bg-coral",
]

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
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" })
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

export function ReviewCard({ review, onVote, colorIndex }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const identity = getIdentityDisplay(review.identityMode, review.authorName)
  const IdentityIcon = identity.icon

  if (review.hidden && !expanded) {
    return (
      <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-5">
        <button
          className="flex w-full items-center gap-2 text-sm text-[#A0A0A0]"
          onClick={() => setExpanded(true)}
        >
          <AlertTriangle className="size-4 text-warm-yellow" />
          <span>This review has been hidden by the community.</span>
          <ChevronDown className="ml-auto size-4" />
        </button>
      </div>
    )
  }

  const useColoredStyle = colorIndex !== undefined && !review.hidden
  const bgColor = useColoredStyle ? REVIEW_COLORS[colorIndex % REVIEW_COLORS.length] : "bg-[#222222]"
  const textPrimary = useColoredStyle ? "text-[#111111]" : "text-white"
  const textSecondary = useColoredStyle ? "text-[#111111]/60" : "text-[#A0A0A0]"

  return (
    <div className={`${bgColor} rounded-3xl p-5 transition-all ${review.hidden ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-full ${useColoredStyle ? "bg-[#111111]/10" : "bg-[#2A2A2A]"}`}>
            <IdentityIcon className={`size-4 ${textSecondary}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${textPrimary}`}>{identity.label}</p>
            <div className={`flex items-center gap-2 text-xs ${textSecondary}`}>
              <Calendar className="size-3" />
              <span>{formatDate(review.createdAt)}</span>
              <span>{timeAgo(review.createdAt)}</span>
            </div>
          </div>
        </div>
        <StarRating value={review.rating} size="sm" readonly />
      </div>

      {/* Content */}
      <p className={`mb-4 text-sm leading-relaxed ${useColoredStyle ? "text-[#111111]/80" : "text-white/80"}`}>
        {review.contentText}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <VoteButtons
          reviewId={review.id}
          upvotes={review.upvotes}
          downvotes={review.downvotes}
          onVote={onVote}
        />
        {review.hidden && (
          <button
            className={`text-xs ${textSecondary} hover:opacity-70 transition-opacity`}
            onClick={() => setExpanded(false)}
          >
            Hide again
          </button>
        )}
      </div>
    </div>
  )
}
