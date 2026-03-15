"use client"

import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { ReviewModal } from "@/components/ReviewModal"

const PROMPTS = [
  "Rate your landlord",
  "Review your ex's cooking",
  "How's your city's tap water?",
  "Rate the campus Wi-Fi",
  "Review your morning commute",
  "Rate the office coffee",
  "Review the local park bench",
  "How's your gym's playlist?",
  "Rate the bathroom graffiti",
  "Review your neighbor's dog",
  "Rate the street food corner",
  "Review your coworker's lunch",
  "How's the airport security?",
  "Rate the library silence",
  "Review the bus driver's vibes",
]

export function FloatingPrompt() {
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrompt((prev) => (prev + 1) % PROMPTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  function handleOpenModal() {
    setShowModal(true)
  }

  if (isDismissed) {
    return (
      <>
        <button
          onClick={handleOpenModal}
          className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8 flex size-14 items-center justify-center rounded-full bg-warm-yellow text-[#111111] shadow-lg shadow-warm-yellow/20 transition-all hover:scale-110 hover:shadow-xl hover:shadow-warm-yellow/30"
        >
          <Plus className="size-6" />
        </button>
        <ReviewModal open={showModal} onClose={() => setShowModal(false)} />
      </>
    )
  }

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8">
        {isExpanded ? (
          <div className="flex items-stretch gap-2 animate-in slide-in-from-right-4 fade-in duration-200">
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-3 rounded-2xl bg-warm-yellow px-5 py-3.5 text-sm font-semibold text-[#111111] shadow-lg shadow-warm-yellow/20 transition-all hover:brightness-110"
            >
              <Plus className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{PROMPTS[currentPrompt]}</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="flex items-center justify-center rounded-2xl bg-[#222222] px-3 text-[#A0A0A0] transition-colors hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-3 rounded-full bg-warm-yellow px-5 py-3.5 text-sm font-semibold text-[#111111] shadow-lg shadow-warm-yellow/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-warm-yellow/30 animate-in zoom-in-90 fade-in duration-300"
          >
            <Plus className="size-5" />
            <span>Review anything</span>
          </button>
        )}
      </div>
      <ReviewModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
