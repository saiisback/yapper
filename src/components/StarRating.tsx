"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value: number
  onChange?: (rating: number) => void
  size?: "sm" | "md" | "lg"
  readonly?: boolean
}

const sizeMap = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
}

export function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0)

  const displayValue = hoverValue || value
  const iconSize = sizeMap[size]

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", !readonly && "cursor-pointer")}
      onMouseLeave={() => {
        if (!readonly) setHoverValue(0)
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              "transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm",
              !readonly && "hover:scale-110 transition-transform"
            )}
            onClick={() => {
              if (!readonly && onChange) {
                onChange(star)
              }
            }}
            onMouseEnter={() => {
              if (!readonly) setHoverValue(star)
            }}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                iconSize,
                filled
                  ? "fill-amber-500 text-amber-500"
                  : "fill-transparent text-gray-300"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
