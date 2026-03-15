"use client"

import { useState } from "react"
import { StarRating } from "@/components/StarRating"
import { IdentityToggle } from "@/components/IdentityToggle"

interface ReviewFormProps {
  entityId: string
  entityName: string
  onSubmit?: (data: {
    rating: number
    text: string
    identityMode: string
  }) => void
  onCancel?: () => void
}

export function ReviewForm({
  entityId,
  entityName,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState("")
  const [identityMode, setIdentityMode] = useState<
    "anonymous" | "pseudonymous" | "public"
  >("anonymous")

  const isValid = rating > 0 && text.trim().length >= 20

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSubmit?.({ rating, text: text.trim(), identityMode })
  }

  return (
    <div className="rounded-3xl bg-coral p-7">
      <form onSubmit={handleSubmit}>
        <h3 className="mb-6 text-2xl font-extrabold tracking-tight text-[#111111]">
          Hey, Write a review
        </h3>

        <div className="space-y-6">
          {/* Rating */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111111]">
              Your Rating
            </label>
            <div>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>
            {rating === 0 && (
              <p className="text-xs text-[#111111]/50">Click a star to rate</p>
            )}
          </div>

          {/* Review text — transparent bg, thin border, pill-shaped */}
          <div className="space-y-2">
            <label
              htmlFor={`review-text-${entityId}`}
              className="text-sm font-semibold text-[#111111]"
            >
              Your Review
            </label>
            <textarea
              id={`review-text-${entityId}`}
              placeholder="Share your experience... (minimum 20 characters)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-3xl border border-[#111111]/15 bg-transparent px-5 py-4 text-sm text-[#111111] placeholder:text-[#111111]/40 outline-none resize-y min-h-28 focus:border-[#111111]/30 transition-colors"
            />
            <p
              className={`text-xs ${
                text.trim().length > 0 && text.trim().length < 20
                  ? "text-[#111111] font-medium"
                  : "text-[#111111]/50"
              }`}
            >
              {text.trim().length}/20 characters minimum
            </p>
          </div>

          <IdentityToggle value={identityMode} onChange={setIdentityMode} />
        </div>

        {/* Action buttons — dark pill */}
        <div className="mt-8 flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-[#111111]/15 bg-transparent px-6 py-3.5 text-sm font-medium text-[#111111]/60 transition-colors hover:bg-[#111111]/10"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!isValid}
            className="flex-1 rounded-full bg-[#111111] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          >
            Submit Review
          </button>
        </div>
      </form>
    </div>
  )
}
