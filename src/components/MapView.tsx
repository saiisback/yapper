import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface Place {
  id: string
  name: string
  latitude: number
  longitude: number
  avgRating: number
}

interface MapViewProps {
  places?: Place[]
  center?: { lat: number; lng: number }
  onPlaceClick?: (placeId: string) => void
  className?: string
}

export function MapView({ places, center, onPlaceClick, className }: MapViewProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[300px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center",
        className
      )}
    >
      <MapPin className="size-12 text-red-400 mb-3" />
      <h3 className="text-lg font-semibold text-gray-700">
        Map View
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Mapbox integration coming soon
      </p>
      {places && places.length > 0 && (
        <div className="mt-4 w-full max-w-sm space-y-1 px-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {places.length} {places.length === 1 ? "place" : "places"} to show
          </p>
          <ul className="space-y-1">
            {places.slice(0, 5).map((place) => (
              <li key={place.id}>
                <button
                  className="w-full rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                  onClick={() => onPlaceClick?.(place.id)}
                >
                  <span className="font-medium">{place.name}</span>
                  <span className="ml-2 text-amber-500">{place.avgRating.toFixed(1)} stars</span>
                </button>
              </li>
            ))}
            {places.length > 5 && (
              <li className="text-xs text-muted-foreground px-3 py-1">
                +{places.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
