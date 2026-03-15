import Link from "next/link"
import { MapPin, ArrowUpRight, Calendar, Star } from "lucide-react"

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
  colorIndex?: number
}

const CARD_COLORS = [
  "bg-lime",
  "bg-warm-yellow",
  "bg-coral",
  "bg-cool-gray",
]

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

export function EntityCard({ entity, colorIndex = 0 }: EntityCardProps) {
  const bgColor = CARD_COLORS[colorIndex % CARD_COLORS.length]

  return (
    <Link href={getEntityHref(entity)} className="block group">
      <div className={`${bgColor} relative overflow-hidden rounded-3xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20`}>
        {/* Dark circular share/action button */}
        <div className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-[#111111] text-white transition-transform group-hover:rotate-45">
          <ArrowUpRight className="size-4" />
        </div>

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

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2">
          {entity.address ? (
            <div className="flex items-center gap-1 text-xs text-[#111111]/50 max-w-[60%]">
              <MapPin className="size-3 shrink-0" />
              <span className="line-clamp-1">{entity.address}</span>
            </div>
          ) : <div />}
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
