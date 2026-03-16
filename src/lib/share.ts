/**
 * Share a link using the Web Share API (mobile) or copy to clipboard (desktop).
 * Returns true if shared/copied successfully.
 */
export async function share({
  title,
  text,
  url,
}: {
  title: string
  text?: string
  url: string
}): Promise<"shared" | "copied" | "failed"> {
  // Use Web Share API if available (mostly mobile)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return "shared"
    } catch {
      // User cancelled or error — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(url)
    return "copied"
  } catch {
    return "failed"
  }
}

/** Build a shareable URL for a review */
export function reviewShareUrl(entitySlug: string, reviewId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : ""
  return `${base}/place/${entitySlug}?review=${reviewId}`
}

/** Build a shareable URL for an entity */
export function entityShareUrl(type: string, slug: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : ""
  const prefix = type === "creator" ? "creator" : type === "product" ? "product" : "place"
  return `${base}/${prefix}/${slug}`
}
