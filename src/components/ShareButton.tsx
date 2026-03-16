"use client"

import { useState, useCallback } from "react"
import { Share2, Check, X } from "lucide-react"
import { share } from "@/lib/share"

interface ShareButtonProps {
  title: string
  text?: string
  url: string
  className?: string
  iconSize?: string
}

export function ShareButton({ title, text, url, className, iconSize = "size-5" }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const result = await share({ title, text, url })

    if (result === "copied") {
      setStatus("copied")
      setTimeout(() => setStatus("idle"), 2000)
    } else if (result === "failed") {
      setStatus("failed")
      setTimeout(() => setStatus("idle"), 2000)
    }
    // "shared" via native dialog — no toast needed
  }, [title, text, url])

  const Icon = status === "copied" ? Check : status === "failed" ? X : Share2

  return (
    <button
      onClick={handleShare}
      className={className}
      aria-label="Share"
    >
      <Icon className={`${iconSize} ${status === "copied" ? "text-lime" : status === "failed" ? "text-coral" : ""} transition-colors`} />
      {status === "copied" && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#111111] px-2.5 py-1 text-[10px] font-medium text-lime shadow-lg">
          Link copied!
        </span>
      )}
    </button>
  )
}
