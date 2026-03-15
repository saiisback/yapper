"use client"

import { useState, useRef } from "react"
import { StarRating } from "@/components/StarRating"
import { IdentityToggle } from "@/components/IdentityToggle"
import { ImagePlus, X } from "lucide-react"

interface ReviewFormProps {
  entityId: string
  entityName: string
  onSubmit?: (data: {
    rating: number
    text: string
    identityMode: string
    image?: File | null
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
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isValid = rating > 0 && text.trim().length >= 20

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a JPEG, PNG, WebP, or GIF image")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB")
      return
    }

    setImage(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSubmit?.({ rating, text: text.trim(), identityMode, image })
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
              className="w-full rounded-full border border-[#111111]/15 bg-transparent px-5 py-4 text-sm text-[#111111] placeholder:text-[#111111]/40 outline-none resize-y min-h-28 focus:border-[#111111]/30 transition-colors"
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

          {/* Photo upload */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111111]">
              Add a Photo <span className="font-normal text-[#111111]/50">(optional)</span>
            </label>

            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Review photo preview"
                  className="h-32 w-32 rounded-2xl object-cover border border-[#111111]/10"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-white transition-transform hover:scale-110"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#111111]/20 bg-transparent transition-colors hover:border-[#111111]/40 hover:bg-[#111111]/5"
              >
                <ImagePlus className="h-6 w-6 text-[#111111]/40" />
                <span className="text-xs text-[#111111]/40">Upload</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />
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
