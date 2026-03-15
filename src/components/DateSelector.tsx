"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface DateSelectorProps {
  selected: Date
  onChange: (date: Date) => void
  range?: number
  className?: string
}

function formatDay(date: Date): string {
  return date.getDate().toString().padStart(2, "0")
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" })
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

export function DateSelector({
  selected,
  onChange,
  range = 7,
  className,
}: DateSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Generate date range centered around today
  const today = new Date()
  const dates: Date[] = []
  const halfRange = Math.floor(range / 2)
  for (let i = -halfRange; i <= halfRange; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d)
  }

  // Scroll active date into view on mount
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [selected])

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-2 overflow-x-auto pb-2 scrollbar-none",
        className
      )}
    >
      {dates.map((date) => {
        const active = isSameDay(date, selected)
        const todayLabel = isToday(date)

        return (
          <button
            key={date.toISOString()}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onChange(date)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-0.5 rounded-full px-4 py-2.5 text-xs font-medium transition-all",
              active
                ? "bg-warm-yellow text-[#111111]"
                : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333333]"
            )}
          >
            <span className="text-sm font-bold">
              {formatDay(date)} {formatMonth(date)}
            </span>
            {todayLabel && (
              <span className={cn("text-[10px] font-semibold", active ? "text-[#111111]" : "text-[#A0A0A0]")}>
                Today
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
