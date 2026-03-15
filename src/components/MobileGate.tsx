"use client"

import { useEffect, useState } from "react"

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Avoid flash while detecting
  if (isMobile === null) return null

  if (!isMobile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white px-6">
        <div className="text-center max-w-md space-y-4">
          <div className="text-5xl">📱</div>
          <h1 className="text-2xl font-bold">Mobile Only</h1>
          <p className="text-zinc-400 text-sm">
            Yap Me. is designed for mobile devices. Please open this site on your phone for the best experience.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
