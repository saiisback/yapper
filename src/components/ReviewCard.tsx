"use client"

import { useState } from "react"
import { EyeOff, User, Globe, AlertTriangle, ChevronDown, Calendar, ExternalLink } from "lucide-react"

const STARKSCAN_TX_URL = "https://starkscan.co/tx/"
import { StarRating } from "@/components/StarRating"
import { ReactionBar, type ReactionType } from "@/components/ReactionBar"
import { ShareButton } from "@/components/ShareButton"
import { reviewShareUrl } from "@/lib/share"

interface ReactionCounts {
  fire: number
  skull: number
  love: number
  gross: number
  cap: number
}

interface Review {
  id: string
  rating: number
  contentText: string
  authorName: string | null
  identityMode: string
  reactions: ReactionCounts
  createdAt: string
  hidden: boolean
  txHash?: string
  entitySlug?: string
}

interface ReviewCardProps {
  review: Review
  onReact?: (reviewId: string, reaction: ReactionType) => void
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

export function ReviewCard({ review, onReact, colorIndex }: ReviewCardProps) {
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
        <ReactionBar
          reviewId={review.id}
          reactions={review.reactions}
          onReact={onReact}
          compact
        />
        <div className="flex items-center gap-2">
          {review.entitySlug && (
            <ShareButton
              title="Check this review on Yap Me"
              text={review.contentText.slice(0, 100)}
              url={reviewShareUrl(review.entitySlug, review.id)}
              className={`relative flex items-center justify-center rounded-full p-1 ${useColoredStyle ? "text-[#111111]/50 hover:text-[#111111]/80" : "text-[#555555] hover:text-[#A0A0A0]"} transition-colors`}
              iconSize="size-3.5"
            />
          )}
          {review.txHash && (
            <a
              href={`${STARKSCAN_TX_URL}${review.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-[10px] ${useColoredStyle ? "text-[#111111]/50 hover:text-[#111111]/80" : "text-[#555555] hover:text-[#A0A0A0]"} transition-colors`}
            >
              On-chain <ExternalLink className="size-2.5" />
            </a>
          )}
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
    </div>
  )
}
