"use client"

import { useEffect, useState, useCallback } from "react"
import { usePrivy } from "@privy-io/react-auth"
import {
  MapPin,
  Camera,
  Calendar,
  Trophy,
  Clock,
  X,
  Navigation,
  Image as ImageIcon,
  CheckCircle,
  ChevronRight,
  ExternalLink,
} from "lucide-react"

const STARKSCAN_TX_URL = "https://starkscan.co/tx/"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────

interface ProofFeedItem {
  id: string
  userId: string
  photoUrl: string
  caption: string | null
  entityName: string
  entitySlug: string
  entityType: string
  eventName: string | null
  eventId: string | null
  distanceMeters: number | null
  createdAt: string
}

interface PresenceEvent {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  entityName: string
  entitySlug: string
  entityType: string
  entityImageUrl: string | null
  startTime: string
  endTime: string
  latitude: number
  longitude: number
  radius: number
  proofCount: number
  isActive: boolean
}

interface MyProof {
  id: string
  photoUrl: string
  caption: string | null
  entityName: string
  entitySlug: string
  entityType: string
  eventName: string | null
  userLatitude: number
  userLongitude: number
  txHash: string
  createdAt: string
}

interface LeaderboardEntry {
  rank: number
  userId: string
  pseudonym: string
  avatarUrl: string | null
  uniquePlaces: number
  totalProofs: number
}

interface NearbyEntity {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  distance: number
}

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const TABS = [
  { id: "feed", label: "Feed", icon: MapPin },
  { id: "events", label: "Events", icon: Calendar },
  { id: "myproofs", label: "My Proofs", icon: Camera },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"]

// ── Main Page ────────────────────────────────────────────────────────────

export default function PresencePage() {
  const { ready, authenticated, user } = usePrivy()
  const [activeTab, setActiveTab] = useState<string>("feed")
  const [showCheckin, setShowCheckin] = useState(false)

  const userId = user?.wallet?.address ?? user?.id ?? ""

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-warm-yellow">
            Proof of Presence
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-0.5">
            Prove you were there. On-chain.
          </p>
        </div>
      </section>

      {/* Tab pills */}
      <section className="mb-5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white text-[#111111]"
                    : "bg-transparent text-[#A0A0A0] border border-[#333333] hover:border-[#A0A0A0]"
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Tab content */}
      {activeTab === "feed" && <FeedView />}
      {activeTab === "events" && <EventsView />}
      {activeTab === "myproofs" && <MyProofsView userId={userId} isLoggedIn={ready && authenticated} />}
      {activeTab === "leaderboard" && <LeaderboardView currentUserId={userId} />}

      {/* FAB — Check in button */}
      {ready && authenticated && (
        <button
          onClick={() => setShowCheckin(true)}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-warm-yellow px-5 py-3.5 text-sm font-bold text-[#111111] shadow-lg shadow-warm-yellow/30 transition-all hover:scale-105 active:scale-95 md:bottom-8"
        >
          <Camera className="size-5" />
          Check In
        </button>
      )}

      {/* Checkin modal */}
      {showCheckin && (
        <CheckinModal
          userId={userId}
          onClose={() => setShowCheckin(false)}
        />
      )}
    </div>
  )
}

// ── Feed View ────────────────────────────────────────────────────────────

function FeedView() {
  const [feed, setFeed] = useState<ProofFeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/presence/feed?limit=30")
        if (res.ok) {
          const data = await res.json()
          setFeed(data.feed ?? [])
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Spinner />

  if (feed.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No proofs yet"
        subtitle="Be the first to prove your presence!"
      />
    )
  }

  return (
    <div className="space-y-3">
      {feed.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-2xl bg-[#222222] transition-all hover:bg-[#2A2A2A]"
        >
          {/* Photo */}
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img
              src={item.photoUrl}
              alt={item.entityName}
              className="h-full w-full object-cover"
            />
            {/* Distance badge */}
            {item.distanceMeters !== null && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <Navigation className="size-3" />
                {item.distanceMeters}m away
              </div>
            )}
          </div>

          <div className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {item.entityName}
                </p>
                {item.eventName && (
                  <p className="text-xs text-warm-yellow mt-0.5">
                    {item.eventName}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-[#555555] shrink-0">
                {timeAgo(item.createdAt)}
              </span>
            </div>
            {item.caption && (
              <p className="mt-1.5 text-xs text-[#A0A0A0] line-clamp-2">
                {item.caption}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <div className="size-4 rounded-full bg-[#333333]" />
              <span className="text-[10px] text-[#666666]">
                {item.userId.slice(0, 6)}...{item.userId.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Events View ──────────────────────────────────────────────────────────

function EventsView() {
  const [events, setEvents] = useState<PresenceEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/presence/events")
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events ?? [])
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Spinner />

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No events yet"
        subtitle="Events will appear here when created"
      />
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="overflow-hidden rounded-2xl bg-[#222222] p-4 transition-all hover:bg-[#2A2A2A]"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">{event.name}</h3>
              <p className="text-xs text-[#A0A0A0] mt-0.5">{event.entityName}</p>
              {event.description && (
                <p className="text-xs text-[#666666] mt-1 line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>
            {event.isActive && (
              <span className="shrink-0 rounded-full bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold text-green-400">
                LIVE
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-[#666666]">
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDate(event.startTime)} — {formatDate(event.endTime)}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">
              {event.proofCount} proof{event.proofCount !== 1 ? "s" : ""}
            </span>
            {event.isActive && (
              <button className="flex items-center gap-1 rounded-full bg-warm-yellow px-3 py-1.5 text-xs font-bold text-[#111111] transition-all hover:scale-105">
                <Camera className="size-3" />
                Prove Presence
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── My Proofs View ───────────────────────────────────────────────────────

function MyProofsView({ userId, isLoggedIn }: { userId: string; isLoggedIn: boolean }) {
  const [proofs, setProofs] = useState<MyProof[]>([])
  const [stats, setStats] = useState({ totalProofs: 0, uniquePlaces: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        const res = await fetch(`/api/presence/my-proofs?userId=${userId}`)
        if (res.ok) {
          const data = await res.json()
          setProofs(data.proofs ?? [])
          setStats(data.stats ?? { totalProofs: 0, uniquePlaces: 0 })
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, isLoggedIn])

  if (!isLoggedIn) {
    return (
      <EmptyState
        icon={Camera}
        title="Sign in to see your proofs"
        subtitle="Your proof-of-presence trail will appear here"
      />
    )
  }

  if (loading) return <Spinner />

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-4 flex gap-3">
        <div className="flex-1 rounded-xl bg-[#222222] p-3 text-center">
          <p className="text-2xl font-bold text-warm-yellow">{stats.uniquePlaces}</p>
          <p className="text-[10px] text-[#A0A0A0]">Unique Places</p>
        </div>
        <div className="flex-1 rounded-xl bg-[#222222] p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalProofs}</p>
          <p className="text-[10px] text-[#A0A0A0]">Total Proofs</p>
        </div>
      </div>

      {proofs.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No proofs yet"
          subtitle="Check in at places to build your trail"
        />
      ) : (
        <div className="space-y-3">
          {proofs.map((proof) => (
            <div
              key={proof.id}
              className="flex gap-3 rounded-xl bg-[#222222] p-3 transition-all hover:bg-[#2A2A2A]"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={proof.photoUrl}
                  alt={proof.entityName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {proof.entityName}
                </p>
                {proof.eventName && (
                  <p className="text-xs text-warm-yellow truncate">{proof.eventName}</p>
                )}
                {proof.caption && (
                  <p className="text-xs text-[#A0A0A0] truncate mt-0.5">
                    {proof.caption}
                  </p>
                )}
                <p className="text-[10px] text-[#555555] mt-1">
                  {timeAgo(proof.createdAt)}
                </p>
              </div>
              {proof.txHash && (
                <a
                  href={`${STARKSCAN_TX_URL}${proof.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 self-center text-[#555555] hover:text-blue-400 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Leaderboard View ─────────────────────────────────────────────────────

function LeaderboardView({ currentUserId }: { currentUserId: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [period, setPeriod] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presence/leaderboard?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data.leaderboard ?? [])
      }
    } catch {
      // API not ready
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const currentUserEntry = leaderboard.find((e) => e.userId === currentUserId)

  return (
    <div>
      {/* Time filters */}
      <div className="mb-4 flex gap-2">
        {[
          { id: "all", label: "All Time" },
          { id: "month", label: "This Month" },
          { id: "week", label: "This Week" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setPeriod(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              period === f.id
                ? "bg-warm-yellow text-[#111111]"
                : "bg-[#222222] text-[#A0A0A0] hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : leaderboard.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No explorers yet"
          subtitle="Be the first to touch grass!"
        />
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="mb-6 flex items-end justify-center gap-3">
            {/* 2nd place */}
            {top3[1] && (
              <PodiumCard entry={top3[1]} rank={2} isCurrentUser={top3[1].userId === currentUserId} />
            )}
            {/* 1st place */}
            {top3[0] && (
              <PodiumCard entry={top3[0]} rank={1} isCurrentUser={top3[0].userId === currentUserId} />
            )}
            {/* 3rd place */}
            {top3[2] && (
              <PodiumCard entry={top3[2]} rank={3} isCurrentUser={top3[2].userId === currentUserId} />
            )}
          </div>

          {/* Ranked list */}
          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((entry) => (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3 transition-all",
                    entry.userId === currentUserId
                      ? "bg-warm-yellow/10 border border-warm-yellow/30"
                      : "bg-[#222222]"
                  )}
                >
                  <span className="w-8 text-center text-sm font-bold text-[#A0A0A0]">
                    {entry.rank}
                  </span>
                  <div className="size-8 rounded-full bg-[#333333] overflow-hidden">
                    {entry.avatarUrl && (
                      <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {entry.pseudonym}
                    </p>
                    <p className="text-[10px] text-[#666666]">
                      {entry.uniquePlaces} places
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-warm-yellow">
                      {entry.uniquePlaces}
                    </p>
                    <p className="text-[10px] text-[#666666]">
                      {entry.totalProofs} proofs
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current user sticky footer if not in top list */}
          {currentUserEntry && currentUserEntry.rank > 10 && (
            <div className="sticky bottom-20 mt-4 rounded-xl border border-warm-yellow/30 bg-[#1A1A1A] p-3 flex items-center gap-3">
              <span className="w-8 text-center text-sm font-bold text-warm-yellow">
                {currentUserEntry.rank}
              </span>
              <div className="size-8 rounded-full bg-[#333333]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">You</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-warm-yellow">
                  {currentUserEntry.uniquePlaces}
                </p>
                <p className="text-[10px] text-[#666666]">
                  {currentUserEntry.totalProofs} proofs
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PodiumCard({
  entry,
  rank,
  isCurrentUser,
}: {
  entry: LeaderboardEntry
  rank: number
  isCurrentUser: boolean
}) {
  const heights = { 1: "h-32", 2: "h-24", 3: "h-20" }
  const sizes = { 1: "size-14", 2: "size-11", 3: "size-11" }

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "rounded-full overflow-hidden border-2 mb-2",
          sizes[rank as 1 | 2 | 3]
        )}
        style={{ borderColor: MEDAL_COLORS[rank - 1] }}
      >
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[#333333]" />
        )}
      </div>
      <p className={cn(
        "text-xs font-bold truncate max-w-[80px]",
        isCurrentUser ? "text-warm-yellow" : "text-white"
      )}>
        {entry.pseudonym}
      </p>
      <p className="text-[10px] text-[#A0A0A0]">
        {entry.uniquePlaces} places
      </p>

      {/* Pedestal */}
      <div
        className={cn(
          "mt-2 w-20 rounded-t-lg flex items-center justify-center",
          heights[rank as 1 | 2 | 3]
        )}
        style={{ backgroundColor: MEDAL_COLORS[rank - 1] + "33" }}
      >
        <span
          className="text-2xl font-black"
          style={{ color: MEDAL_COLORS[rank - 1] }}
        >
          {rank}
        </span>
      </div>
    </div>
  )
}

// ── Checkin Modal ────────────────────────────────────────────────────────

function CheckinModal({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<"photo" | "entity" | "submitting" | "success">("photo")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [selectedEntity, setSelectedEntity] = useState<NearbyEntity | null>(null)
  const [nearbyEntities, setNearbyEntities] = useState<NearbyEntity[]>([])
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Request location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocationError("Location access denied. Please enable location services.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Fetch nearby entities when location available
  useEffect(() => {
    if (!userLocation) return
    async function fetchNearby() {
      try {
        const res = await fetch(
          `/api/places?latitude=${userLocation!.lat}&longitude=${userLocation!.lng}&sort=distance&limit=10`
        )
        if (res.ok) {
          const data = await res.json()
          // Map entities with calculated distance
          const entities = (data.entities ?? data.places ?? []).map(
            (e: { id: string; name: string; type: string; latitude: number; longitude: number }) => ({
              id: e.id,
              name: e.name,
              type: e.type,
              latitude: e.latitude,
              longitude: e.longitude,
              distance: haversineDistance(
                userLocation!.lat,
                userLocation!.lng,
                e.latitude,
                e.longitude
              ),
            })
          )
          // Filter within 500m and sort
          setNearbyEntities(
            entities
              .filter((e: NearbyEntity) => e.distance <= 500)
              .sort((a: NearbyEntity, b: NearbyEntity) => a.distance - b.distance)
          )
        }
      } catch {
        // API not ready
      }
    }
    fetchNearby()
  }, [userLocation])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setStep("entity")
  }

  const handleSubmit = async () => {
    if (!selectedEntity || !userLocation) return
    setStep("submitting")
    setSubmitError(null)

    try {
      const formData = new FormData()
      formData.append("entityId", selectedEntity.id)
      formData.append("userId", userId)
      formData.append("userLatitude", userLocation.lat.toString())
      formData.append("userLongitude", userLocation.lng.toString())
      if (caption) formData.append("caption", caption)
      if (photo) formData.append("photo", photo)

      const res = await fetch("/api/presence/checkin", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to check in")
      }

      const data = await res.json()
      setTxHash(data.onChain?.txHash ?? data.txHash)
      setStep("success")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
      setStep("entity")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t-3xl bg-[#1A1A1A] p-5 pb-8 md:rounded-3xl md:pb-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {step === "photo" && "Take a Photo"}
            {step === "entity" && "Select Place"}
            {step === "submitting" && "Submitting..."}
            {step === "success" && "Checked In!"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full bg-[#333333] p-2 text-[#A0A0A0] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {locationError && (
          <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
            {locationError}
          </div>
        )}

        {/* Step: Photo */}
        {step === "photo" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-32 items-center justify-center rounded-2xl border-2 border-dashed border-[#333333]">
              <ImageIcon className="size-10 text-[#555555]" />
            </div>
            <label className="cursor-pointer rounded-full bg-warm-yellow px-6 py-3 text-sm font-bold text-[#111111] transition-all hover:scale-105">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              Open Camera
            </label>
          </div>
        )}

        {/* Step: Entity selection */}
        {step === "entity" && (
          <div>
            {/* Photo preview */}
            {photoPreview && (
              <div className="mb-4 overflow-hidden rounded-xl">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
              </div>
            )}

            {/* Caption */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              className="mb-4 w-full rounded-xl bg-[#222222] px-4 py-3 text-sm text-white placeholder:text-[#555555] outline-none focus:ring-1 focus:ring-warm-yellow/50"
            />

            {submitError && (
              <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
                {submitError}
              </div>
            )}

            {/* Nearby entities */}
            <p className="mb-2 text-xs font-medium text-[#A0A0A0]">
              Nearby places (within 500m)
            </p>
            {nearbyEntities.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#555555]">
                {userLocation ? "No places found nearby" : "Getting your location..."}
              </p>
            ) : (
              <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                {nearbyEntities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all",
                      selectedEntity?.id === entity.id
                        ? "bg-warm-yellow/10 border border-warm-yellow/30"
                        : "bg-[#222222] hover:bg-[#2A2A2A]"
                    )}
                  >
                    <MapPin className="size-4 shrink-0 text-[#A0A0A0]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {entity.name}
                      </p>
                      <p className="text-[10px] text-[#666666]">
                        {Math.round(entity.distance)}m away
                      </p>
                    </div>
                    {selectedEntity?.id === entity.id && (
                      <CheckCircle className="size-4 text-warm-yellow shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!selectedEntity || !userLocation}
              className="w-full rounded-full bg-warm-yellow py-3.5 text-sm font-bold text-[#111111] transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              Submit Proof of Presence
            </button>
          </div>
        )}

        {/* Step: Submitting */}
        {step === "submitting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
            <p className="text-sm text-[#A0A0A0]">
              Uploading to IPFS & submitting on-chain...
            </p>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="size-8 text-green-400" />
            </div>
            <p className="text-sm font-medium text-white">Proof recorded on-chain!</p>
            {txHash && (
              <a
                href={`${STARKSCAN_TX_URL}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-[#222222] px-4 py-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View on Starkscan
                <ExternalLink className="size-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-full bg-warm-yellow px-6 py-2.5 text-sm font-bold text-[#111111]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared Components ────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex size-16 items-center justify-center rounded-full bg-[#222222] mb-4">
        <Icon className="size-7 text-[#A0A0A0]/30" />
      </div>
      <p className="text-[#A0A0A0] text-sm mb-1">{title}</p>
      <p className="text-[#555555] text-xs">{subtitle}</p>
    </div>
  )
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
