import Link from "next/link"
import { Calendar, Star } from "lucide-react"
import { ShareButton } from "@/components/ShareButton"
import { entityShareUrl } from "@/lib/share"

interface Entity {
  id: string
  slug: string
  type: string
  name: string
  category: string | null
  address: string | null
  imageUrl: string | null
  avgRating: number
  reviewCount: number
}

interface EntityCardProps {
  entity: Entity
}

const CARD_COLORS = [
  "bg-lime",
  "bg-warm-yellow",
  "bg-coral",
  "bg-cool-gray",
]

const AVATAR_COLORS = [
  "bg-amber-600",
  "bg-rose-400",
  "bg-emerald-500",
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getEntityHref(entity: Entity): string {
  switch (entity.type) {
    case "place":
      return `/place/${entity.slug}`
    case "creator":
      return `/creator/${entity.slug}`
    case "product":
      return `/product/${entity.slug}`
    default:
      return `/place/${entity.slug}`
  }
}

export function EntityCard({ entity }: EntityCardProps) {
  const bgColor = CARD_COLORS[hashString(entity.id) % CARD_COLORS.length]

  return (
    <Link href={getEntityHref(entity)} className="block group">
      <div className={`${bgColor} relative overflow-hidden rounded-3xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20`}>
        {/* Dark circular share button */}
        <ShareButton
          title={entity.name}
          text={`Check out ${entity.name} on Yap Me`}
          url={entityShareUrl(entity.type, entity.slug)}
          className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-[#111111] text-white transition-transform group-hover:rotate-12"
          iconSize="size-4"
        />

        {/* Title */}
        <h3 className="mb-4 pr-12 text-xl font-bold leading-tight tracking-tight text-[#111111] line-clamp-2">
          {entity.name}
        </h3>

        {/* Date/info row with icons */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#111111]/60">
            <Calendar className="size-3.5" />
            <span>{entity.reviewCount} review{entity.reviewCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#111111]/60">
            <Star className="size-3.5" />
            <span>{entity.avgRating.toFixed(1)}</span>
          </div>
        </div>

        {/* Bottom row — overlapping avatars + category pill */}
        <div className="flex items-center justify-between gap-2">
          {/* Overlapping avatar group */}
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {AVATAR_COLORS.slice(0, Math.min(entity.reviewCount, 3) || 1).map((color, i) => (
                <div
                  key={i}
                  className={`size-8 rounded-full ${color} ring-2 ring-white/30 flex items-center justify-center text-xs font-bold text-white`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            {entity.reviewCount > 3 && (
              <span className="ml-1.5 text-xs font-medium text-[#111111]/50">
                +{entity.reviewCount - 3}
              </span>
            )}
          </div>

          {entity.category && (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#111111]">
              {entity.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
