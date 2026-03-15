"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  onSearch?: (query: string) => void
  placeholder?: string
  defaultValue?: string
  className?: string
}

export function SearchBar({
  onSearch,
  placeholder = "Search places, creators, products...",
  defaultValue = "",
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const router = useRouter()

  function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed) return
    if (onSearch) {
      onSearch(trimmed)
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-[#333333] bg-transparent px-5 py-3",
        className
      )}
    >
      <Search className="size-5 shrink-0 text-[#A0A0A0]" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-white placeholder:text-[#A0A0A0] outline-none"
      />
      <button
        type="button"
        className="shrink-0 rounded-full bg-warm-yellow px-5 py-2 text-sm font-semibold text-[#111111] transition-all hover:brightness-110"
        onClick={handleSearch}
      >
        Search
      </button>
    </div>
  )
}
