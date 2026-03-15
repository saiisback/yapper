"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ReviewCard } from "@/components/ReviewCard";
import { Star, TrendingUp, PenLine, Settings, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  contentText: string;
  authorName: string | null;
  identityMode: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  hidden: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { ready, authenticated, user, logout } = usePrivy();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editing, setEditing] = useState(false);
  const [pseudonym, setPseudonym] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"reviews" | "bookmarks">("reviews");

  const walletAddress = user?.wallet?.address ?? user?.id ?? "";
  const displayName = pseudonym || user?.email?.address || user?.google?.name || "Anonymous Reviewer";

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/login");
      return;
    }

    if (!ready || !authenticated) return;

    // Load saved pseudonym from localStorage
    const saved = localStorage.getItem("starkzap_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPseudonym(parsed.pseudonym ?? "");
        setBio(parsed.bio ?? "");
      } catch {}
    }

    fetch(`/api/reviews?author=${walletAddress}`)
      .then((res) => (res.ok ? res.json() : { reviews: [] }))
      .then((data) => setReviews(data.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ready, authenticated, router, walletAddress]);

  async function handleLogout() {
    await logout();
    localStorage.removeItem("starkzap_session");
    localStorage.removeItem("starkzap_profile");
    router.push("/");
  }

  function handleSaveProfile() {
    localStorage.setItem(
      "starkzap_profile",
      JSON.stringify({ pseudonym, bio })
    );
    setEditing(false);
    toast.success("Profile updated!");
  }

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-warm-yellow" />
      </div>
    );
  }

  const totalUpvotes = reviews.reduce((sum, r) => sum + r.upvotes, 0);
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 lg:px-8">
      {/* Profile card — warm yellow */}
      <div className="mb-8 rounded-3xl bg-warm-yellow p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {/* Avatar — dark circle */}
          <div className="flex size-20 items-center justify-center rounded-full bg-[#111111] text-2xl font-bold text-warm-yellow">
            {initials}
          </div>

          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={pseudonym}
                  onChange={(e) => setPseudonym(e.target.value)}
                  placeholder="Choose a pseudonym"
                  className="w-full rounded-full border border-[#111111]/10 bg-transparent px-5 py-3 text-[#111111] placeholder:text-[#111111]/40 outline-none focus:border-[#111111]/30 transition-colors"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                  rows={3}
                  className="w-full rounded-3xl border border-[#111111]/10 bg-transparent px-5 py-3 text-[#111111] placeholder:text-[#111111]/40 outline-none resize-none focus:border-[#111111]/30 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    className="rounded-full bg-[#111111] px-6 py-2.5 text-sm font-semibold text-warm-yellow"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-full bg-[#111111]/10 px-6 py-2.5 text-sm font-medium text-[#111111]/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
                  {displayName}
                </h1>
                {bio && <p className="mt-1 text-sm text-[#111111]/60">{bio}</p>}
              </>
            )}

            {/* Stats pills */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#111111]">
                <PenLine className="h-3 w-3" />
                {reviews.length} reviews
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#111111]">
                <TrendingUp className="h-3 w-3" />
                {totalUpvotes} upvotes
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#111111]">
                <Star className="h-3 w-3" />
                Rep: {totalUpvotes}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-full bg-[#111111]/10 px-5 py-2.5 text-sm font-medium text-[#111111]/60 hover:bg-[#111111]/20 transition-colors"
              >
                <Settings className="size-4" />
                Edit
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-warm-yellow hover:opacity-90 transition-opacity"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Tabs — pill toggle */}
      <div className="mb-8 flex gap-1 rounded-full bg-[#111111] p-1">
        <button
          onClick={() => setActiveTab("reviews")}
          className={`flex-1 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "reviews"
              ? "bg-warm-yellow text-[#111111]"
              : "text-[#A0A0A0]"
          }`}
        >
          Your Reviews
        </button>
        <button
          onClick={() => setActiveTab("bookmarks")}
          className="flex-1 rounded-full px-5 py-2.5 text-sm font-medium text-[#A0A0A0]/40 cursor-not-allowed"
          disabled
        >
          Bookmarks (Soon)
        </button>
      </div>

      {/* Content */}
      {activeTab === "reviews" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-yellow border-t-transparent" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review, i) => (
                <ReviewCard key={review.id} review={review} colorIndex={i} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[#222222] border border-dashed border-[#333333] p-12 text-center">
              <PenLine className="mx-auto mb-3 h-10 w-10 text-[#A0A0A0]/30" />
              <p className="text-[#A0A0A0]">You haven&apos;t written any reviews yet.</p>
              <button
                className="mt-3 text-sm font-medium text-warm-yellow hover:underline"
                onClick={() => router.push("/explore")}
              >
                Explore places to review
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
