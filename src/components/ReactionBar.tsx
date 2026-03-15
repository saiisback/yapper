"use client"

import { useState } from "react"
import { Flame, Skull, Heart, ThumbsDown, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ReactionType = "fire" | "skull" | "love" | "gross" | "cap"

interface ReactionCounts {
  fire: number
  skull: number
  love: number
  gross: number
  cap: number
}

interface ReactionBarProps {
  reviewId: string
  reactions: ReactionCounts
  userReaction?: ReactionType | null
  onReact?: (reviewId: string, reaction: ReactionType) => void
  compact?: boolean
}

const REACTIONS: {
  type: ReactionType
  icon: typeof Flame
  label: string
  activeColor: string
  hoverColor: string
}[] = [
  { type: "fire", icon: Flame, label: "Hot take", activeColor: "text-coral", hoverColor: "hover:text-coral" },
  { type: "skull", icon: Skull, label: "Hilarious", activeColor: "text-cool-gray", hoverColor: "hover:text-cool-gray" },
  { type: "love", icon: Heart, label: "Love it", activeColor: "text-warm-yellow", hoverColor: "hover:text-warm-yellow" },
  { type: "gross", icon: ThumbsDown, label: "Nah", activeColor: "text-[#888888]", hoverColor: "hover:text-[#888888]" },
  { type: "cap", icon: AlertTriangle, label: "Cap", activeColor: "text-lime", hoverColor: "hover:text-lime" },
]

export function ReactionBar({ reviewId, reactions, userReaction, onReact, compact = false }: ReactionBarProps) {
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(userReaction ?? null)

  const handleReact = (type: ReactionType) => {
    if (activeReaction === type) {
      setActiveReaction(null)
    } else {
      setActiveReaction(type)
    }
    onReact?.(reviewId, type)
  }

  if (compact) {
    // Show only top 2-3 reactions with counts
    const sorted = REACTIONS
      .filter((r) => reactions[r.type] > 0)
      .sort((a, b) => reactions[b.type] - reactions[a.type])
      .slice(0, 3)

    if (sorted.length === 0) return null

    return (
      <div className="flex items-center gap-2">
        {sorted.map((r) => {
          const Icon = r.icon
          const isActive = activeReaction === r.type
          return (
            <button
              key={r.type}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all",
                isActive
                  ? `${r.activeColor} bg-white/10`
                  : "text-[#A0A0A0] hover:bg-white/5"
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleReact(r.type)
              }}
              title={r.label}
            >
              <Icon className="size-3" />
              <span>{reactions[r.type]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Full reaction bar — all 5 icons
  return (
    <div className="flex items-center gap-1">
      {REACTIONS.map((r) => {
        const Icon = r.icon
        const isActive = activeReaction === r.type
        const count = reactions[r.type]
        return (
          <button
            key={r.type}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? `${r.activeColor} bg-white/15 scale-110`
                : `text-[#A0A0A0] ${r.hoverColor} hover:bg-white/5`
            )}
            onClick={(e) => {
              e.stopPropagation()
              handleReact(r.type)
            }}
            title={r.label}
          >
            <Icon className={cn("size-4", isActive && "fill-current")} />
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Utility to get total weighted score
export function getReactionScore(reactions: ReactionCounts): number {
  return (
    reactions.fire * 1.5 +
    reactions.love * 1.2 +
    reactions.skull * 1.0 +
    reactions.gross * 0.5 +
    reactions.cap * -1.0
  )
}
