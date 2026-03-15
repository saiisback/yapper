const GOOGLE_PLACES_API = "https://maps.googleapis.com/maps/api/place";

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

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number }
): Promise<GooglePlace[]> {
  const params = new URLSearchParams({
    query,
    key: process.env.GOOGLE_PLACES_API_KEY!,
  });

  if (location) {
    params.set("location", `${location.lat},${location.lng}`);
    params.set("radius", "5000");
  }

  const res = await fetch(
    `${GOOGLE_PLACES_API}/textsearch/json?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Google Places API error: ${res.statusText}`);
  }

  const data = await res.json();
  return data.results as GooglePlace[];
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "place_id,name,formatted_address,geometry,types,rating,user_ratings_total,photos",
    key: process.env.GOOGLE_PLACES_API_KEY!,
  });

  const res = await fetch(
    `${GOOGLE_PLACES_API}/details/json?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Google Places API error: ${res.statusText}`);
  }

  const data = await res.json();
  return data.result as GooglePlace;
}

export function getPhotoUrl(photoReference: string, maxWidth = 400): string {
  return `${GOOGLE_PLACES_API}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
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
