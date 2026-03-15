"use client"

import { EyeOff, User, Globe } from "lucide-react"

type IdentityMode = "anonymous" | "pseudonymous" | "public"

interface IdentityToggleProps {
  value: IdentityMode
  onChange: (mode: IdentityMode) => void
  pseudonym?: string
}

const modes: { key: IdentityMode; label: string; icon: typeof EyeOff; description: string }[] = [
  {
    key: "anonymous",
    label: "Anonymous",
    icon: EyeOff,
    description: "Fully private",
  },
  {
    key: "pseudonymous",
    label: "Pseudonymous",
    icon: User,
    description: "Use a pseudonym",
  },
  {
    key: "public",
    label: "Public",
    icon: Globe,
    description: "Show your identity",
  },
]

export function IdentityToggle({
  value,
  onChange,
  pseudonym,
}: IdentityToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#111111]">Identity Mode</span>
      <div className="flex gap-2">
        {modes.map(({ key, label, icon: Icon }) => {
          const isActive = value === key
          return (
            <button
              key={key}
              type="button"
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-full py-3 text-xs font-medium transition-all ${
                isActive
                  ? "bg-[#111111] text-white"
                  : "border border-[#111111]/15 bg-transparent text-[#111111]/60 hover:bg-[#111111]/10"
              }`}
              onClick={() => onChange(key)}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {value === "pseudonymous" && pseudonym && (
        <p className="text-xs text-[#111111]/50">
          Posting as <span className="font-medium">{pseudonym}</span>
        </p>
      )}
      {value === "anonymous" && (
        <p className="text-xs text-[#111111]/50">
          Your identity will be completely hidden.
        </p>
      )}
      {value === "public" && (
        <p className="text-xs text-[#111111]/50">
          Your name will be visible on your review.
        </p>
      )}
    </div>
  )
}
