"use client"

import { ThumbsUp, ThumbsDown } from "lucide-react"

interface VoteButtonsProps {
  reviewId: string
  upvotes: number
  downvotes: number
  onVote?: (reviewId: string, voteType: "up" | "down") => void
}

export function VoteButtons({
  reviewId,
  upvotes,
  downvotes,
  onVote,
}: VoteButtonsProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        className="flex items-center gap-1.5 rounded-full bg-[#111111]/10 px-3 py-1.5 text-xs font-medium transition-all hover:bg-[#111111]/20"
        onClick={() => onVote?.(reviewId, "up")}
      >
        <ThumbsUp className="size-3.5" />
        <span>{upvotes}</span>
      </button>
      <button
        className="flex items-center gap-1.5 rounded-full bg-[#111111]/10 px-3 py-1.5 text-xs font-medium transition-all hover:bg-[#111111]/20"
        onClick={() => onVote?.(reviewId, "down")}
      >
        <ThumbsDown className="size-3.5" />
        <span>{downvotes}</span>
      </button>
    </div>
  )
}
