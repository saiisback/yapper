// Google Places API (New) — uses the newer REST endpoints
const PLACES_API_NEW = "https://places.googleapis.com/v1/places";

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string }[];
}

// Convert Places API (New) response to our GooglePlace format
function mapNewApiPlace(place: Record<string, unknown>): GooglePlace {
  const location = (place.location as Record<string, number>) ?? {};
  const displayName = (place.displayName as Record<string, string>) ?? {};
  return {
    place_id: (place.id as string) ?? "",
    name: displayName.text ?? "",
    formatted_address: (place.formattedAddress as string) ?? "",
    geometry: {
      location: {
        lat: location.latitude ?? 0,
        lng: location.longitude ?? 0,
      },
    },
    types: (place.types as string[]) ?? [],
    rating: place.rating as number | undefined,
    user_ratings_total: place.userRatingCount as number | undefined,
    photos: ((place.photos as Record<string, string>[]) ?? []).map((p) => ({
      photo_reference: p.name ?? "",
    })),
  };
}

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number }
): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
  };

  if (location) {
    body.locationBias = {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: 5000.0,
      },
    };
  }

  const res = await fetch(`${PLACES_API_NEW}:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Google Places] searchText error:", errText);
    throw new Error(`Google Places API error: ${res.status}`);
  }

  const data = await res.json();
  return ((data.places as Record<string, unknown>[]) ?? []).map(mapNewApiPlace);
}

export async function nearbySearch(
  location: { lat: number; lng: number },
  radius = 1000,
  type?: string
): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radius,
      },
    },
    maxResultCount: 20,
  };

  if (type) {
    body.includedTypes = [type];
  }

  const res = await fetch(`${PLACES_API_NEW}:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Google Places] searchNearby error:", errText);
    throw new Error(`Google Places API error: ${res.status}`);
  }

  const data = await res.json();
  return ((data.places as Record<string, unknown>[]) ?? []).map(mapNewApiPlace);
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace> {
  const res = await fetch(`${PLACES_API_NEW}/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,types,rating,userRatingCount,photos",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Google Places] getPlaceDetails error:", errText);
    throw new Error(`Google Places API error: ${res.status}`);
  }

  const place = await res.json();
  return mapNewApiPlace(place);
}

export function getPhotoUrl(photoReference: string, maxWidth = 400): string {
  return `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxWidth}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
}

export function mapGoogleCategory(types: string[]): string {
  const categoryMap: Record<string, string> = {
    restaurant: "Restaurants",
    cafe: "Cafes",
    bar: "Bars",
    store: "Shops",
    shopping_mall: "Shops",
    park: "Parks",
    museum: "Entertainment",
    movie_theater: "Entertainment",
    gym: "Fitness",
    hospital: "Healthcare",
    school: "Education",
  };

  for (const type of types) {
    if (categoryMap[type]) return categoryMap[type];
  }
  return "Other";
}
