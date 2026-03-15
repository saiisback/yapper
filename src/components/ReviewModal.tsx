"use client"

import { useState, useEffect, useRef } from "react"
import { X, ImagePlus, Camera, EyeOff, User, Globe } from "lucide-react"
import { StarRating } from "@/components/StarRating"
import { toast } from "sonner"

interface ReviewModalProps {
  open: boolean
  onClose: () => void
}

const IDENTITY_MODES = [
  { key: "anonymous" as const, label: "Anon", icon: EyeOff },
  { key: "pseudonymous" as const, label: "Pseudo", icon: User },
  { key: "public" as const, label: "Public", icon: Globe },
]

export function ReviewModal({ open, onClose }: ReviewModalProps) {
  const [subject, setSubject] = useState("")
  const [rating, setRating] = useState(0)
  const [text, setText] = useState("")
  const [identityMode, setIdentityMode] = useState<
    "anonymous" | "pseudonymous" | "public"
  >("anonymous")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSubject("")
      setRating(0)
      setText("")
      setIdentityMode("anonymous")
      setImage(null)
      setImagePreview(null)
      setSubmitting(false)
      setTimeout(() => subjectRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP, or GIF image")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB")
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

  const isValid = subject.trim().length > 0 && rating > 0 && text.trim().length >= 20

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return

    setSubmitting(true)
    const session = localStorage.getItem("starkzap_session")
    const authorAddress = session ? JSON.parse(session).address : undefined

    try {
      let res: Response

      if (image) {
        const formData = new FormData()
        formData.append("subject", subject.trim())
        formData.append("rating", rating.toString())
        formData.append("contentText", text.trim())
        formData.append("identityMode", identityMode)
        if (authorAddress) formData.append("authorAddress", authorAddress)
        formData.append("image", image)

        res = await fetch("/api/reviews", { method: "POST", body: formData })
      } else {
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            rating,
            contentText: text.trim(),
            identityMode,
            authorAddress,
          }),
        })
      }

      if (!res.ok) throw new Error("Failed to post review")

      toast.success("Review posted!")
      onClose()
    } catch {
      toast.error("Failed to post review. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full sm:mx-4 sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#1A1A1A] border border-[#333333] shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
        {/* Drag indicator (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[#444]" />
        </div>

        {/* Header — compact */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-bold text-white">Review anything</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-[#A0A0A0] transition-colors hover:bg-[#333333] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
          {/* Subject */}
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What are you reviewing?"
            className="w-full rounded-xl border border-[#333333] bg-[#111111] px-4 py-2.5 text-sm text-white placeholder:text-[#666] outline-none focus:border-warm-yellow/50 transition-colors"
          />

          {/* Photo + Rating row */}
          <div className="flex items-start gap-3">
            {/* Photo upload — compact */}
            {imagePreview ? (
              <div className="relative shrink-0">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-16 w-16 rounded-xl object-cover border border-[#333333]"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#333] text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#444] bg-[#111111] transition-colors hover:border-warm-yellow/40"
                >
                  <ImagePlus className="size-4 text-[#666]" />
                  <span className="text-[10px] text-[#666]">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute("capture", "environment")
                      fileInputRef.current.click()
                      fileInputRef.current.removeAttribute("capture")
                    }
                  }}
                  className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#444] bg-[#111111] transition-colors hover:border-warm-yellow/40 sm:hidden"
                >
                  <Camera className="size-4 text-[#666]" />
                  <span className="text-[10px] text-[#666]">Camera</span>
                </button>
              </div>
            )}

            {/* Rating */}
            <div className="flex flex-col gap-1 pt-1">
              <StarRating value={rating} onChange={setRating} size="md" />
              {rating === 0 && (
                <p className="text-[10px] text-[#666]">Tap to rate</p>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Review text */}
          <div>
            <textarea
              placeholder="Share your experience... (min 20 chars)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-[#333333] bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-[#666] outline-none resize-none h-20 focus:border-warm-yellow/50 transition-colors"
            />
            {text.trim().length > 0 && text.trim().length < 20 && (
              <p className="text-[10px] text-warm-yellow mt-0.5">
                {text.trim().length}/20 chars
              </p>
            )}
          </div>

          {/* Identity — inline compact */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#666] mr-1">Post as</span>
            {IDENTITY_MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setIdentityMode(key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  identityMode === key
                    ? "bg-warm-yellow text-[#111]"
                    : "bg-[#222] text-[#888] hover:text-white"
                }`}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full rounded-full bg-warm-yellow py-3 text-sm font-bold text-[#111] transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting..." : "Post Review"}
          </button>
        </form>
      </div>
    </div>
  )
}
