"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import FilterSidebar from "@/components/FilterSidebar";
import ContentAcknowledgmentModal from "@/components/ContentAcknowledgmentModal";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import MatchScoreTooltip from "@/components/MatchScoreTooltip";
import { GENDERS } from "@/lib/constants";
import { getTimeSinceSurgeryLabel } from "@/lib/surgeryDate";
import VerifiedBadge from "@/components/VerifiedBadge";

const activityLabels: Record<string, string> = {
  SEDENTARY: "Sedentary",
  RECREATIONAL: "Recreational",
  COMPETITIVE_ATHLETE: "Competitive Athlete",
  PROFESSIONAL_ATHLETE: "Professional Athlete",
};

type SortOption = "match" | "price_low" | "price_high" | "highest_rated" | "most_reviews";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "match", label: "Best Match" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "most_reviews", label: "Most Reviews" },
];

interface Guide {
  id: string;
  name: string;
  bio?: string;
  profile?: {
    procedureType?: string;
    procedureTypes?: string[];
    ageRange?: string;
    gender?: string;
    activityLevel?: string;
    recoveryGoals?: string[];
    surgeryDate?: string;
    timeSinceSurgery?: string;
    hourlyRate?: number;
    isAvailableForCalls?: boolean;
  };
  contributorStatus?: string;
  reviewsReceived?: { rating: number }[];
  matchScore?: number;
  matchBreakdown?: { attribute: string; matched: boolean; weight: number }[];
}

function GuideCard({ guide, isOwn, hideMatchScore }: { guide: Guide; isOwn?: boolean; hideMatchScore?: boolean }) {
  const profile = guide.profile || {};
  const averageRating = guide.reviewsReceived?.length
    ? guide.reviewsReceived.reduce((a, r) => a + r.rating, 0) / guide.reviewsReceived.length
    : undefined;
  const reviewCount = guide.reviewsReceived?.length || 0;

  return (
    <Link href={`/guides/${guide.id}`} className="block group">
      <div className={`bg-white rounded-xl border p-6 hover:shadow-lg hover:border-cyan-200 transition-all h-full flex flex-col ${isOwn ? "border-l-2 border-l-teal-300 border-gray-200" : "border-gray-200"}`} title={isOwn ? "Your profile" : undefined}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">
              {guide.name?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-700 transition-colors text-lg">
                {guide.name}
              </h3>
              {guide.contributorStatus === "APPROVED" && <VerifiedBadge />}
            </div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {(profile.procedureTypes?.length ? profile.procedureTypes : (profile.procedureType ? [profile.procedureType] : [])).map((proc: string) => (
                <span key={proc} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{proc}</span>
              ))}
              {!profile.procedureType && !profile.procedureTypes?.length && (
                <span className="text-sm text-gray-600">Recovery Guide</span>
              )}
            </div>
            {profile.isAvailableForCalls && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Available for calls
              </span>
            )}
          </div>
          {guide.matchScore !== undefined && !hideMatchScore && (
            <div className="flex items-center flex-shrink-0">
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                guide.matchScore >= 80 ? "bg-green-100 text-green-700" :
                guide.matchScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {guide.matchScore}% match
              </span>
              {guide.matchBreakdown && (
                <MatchScoreTooltip breakdown={guide.matchBreakdown} />
              )}
            </div>
          )}
        </div>

        {guide.bio && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 italic">
            &ldquo;{guide.bio}&rdquo;
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {profile.ageRange && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{profile.ageRange}</span>
          )}
          {profile.gender && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {GENDERS.find((g) => g.value === profile.gender)?.label || profile.gender}
            </span>
          )}
          {profile.activityLevel && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {activityLabels[profile.activityLevel] || profile.activityLevel}
            </span>
          )}
          {(profile.surgeryDate || profile.timeSinceSurgery) && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              {profile.surgeryDate
                ? getTimeSinceSurgeryLabel(profile.surgeryDate)
                : `${profile.timeSinceSurgery} post-op`}
            </span>
          )}
        </div>

        {profile.recoveryGoals && profile.recoveryGoals.length > 0 && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            Goals: {profile.recoveryGoals.slice(0, 2).join(", ")}
            {profile.recoveryGoals.length > 2 && ` +${profile.recoveryGoals.length - 2} more`}
          </p>
        )}

        <div className="mt-auto">
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {averageRating !== undefined && reviewCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {averageRating.toFixed(1)} ({reviewCount})
                </span>
              )}
              {isOwn && (
                <span className="text-[11px] text-gray-400 italic sm:hidden">Yours</span>
              )}
            </div>
            {profile.isAvailableForCalls && profile.hourlyRate && (
              <span className="text-lg font-bold text-cyan-700">
                ${profile.hourlyRate}/hr
              </span>
            )}
          </div>

          {profile.isAvailableForCalls && (
            <button className="mt-4 w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Book Call - ${profile.hourlyRate}/hr
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

function GuidesContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const currentUserRole = (session?.user as any)?.role as string | undefined;
  const isGuideOnly = currentUserRole === "GUIDE";

  const [filters, setFilters] = useState({
    procedures: [] as string[],
    ageRanges: [] as string[],
    genders: [] as string[],
    activityLevels: [] as string[],
    categories: [] as string[],
  });
  const [sortBy, setSortBy] = useState<SortOption>("match");
  const [searchQuery, setSearchQuery] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [userProcedures, setUserProcedures] = useState<string[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<string>("");

  // Fetch the seeker's conditions on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const procs: string[] = data.procedureTypes || [];
        const active: string = data.activeProcedureType || "";
        if (procs.length > 0) {
          setUserProcedures(procs);
          setSelectedProcedure(active || procs[0]);
        }
      } catch {
        // Not logged in or no profile — leave empty
      }
    }
    fetchProfile();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("availableForCalls", "true");
    params.set("page", pagination.page.toString());
    if (selectedProcedure) {
      params.set("matchProcedure", selectedProcedure);
    }

    try {
      const res = await fetch(`/api/guides?${params}`);
      if (!res.ok) throw new Error("Failed to load guides.");
      const data = await res.json();
      setGuides(data.guides || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Error fetching guides:", err);
      setError("Failed to load guides.");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, selectedProcedure]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleFilterChange(key: string, values: string[]) {
    setFilters((prev) => ({ ...prev, [key]: values }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  // Filter guides client-side
  const filteredGuides = guides.filter((c) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!c.name?.toLowerCase().includes(query)) return false;
    }

    // Procedure filter
    if (filters.procedures.length > 0) {
      const types = c.profile?.procedureTypes;
      const matches = Array.isArray(types) && types.length > 0
        ? filters.procedures.some((p) => types.includes(p))
        : filters.procedures.includes(c.profile?.procedureType || "");
      if (!matches) return false;
    }

    // Age range filter
    if (filters.ageRanges.length > 0 && !filters.ageRanges.includes(c.profile?.ageRange || "")) {
      return false;
    }

    // Activity level filter
    if (filters.activityLevels.length > 0 && !filters.activityLevels.includes(c.profile?.activityLevel || "")) {
      return false;
    }

    // Gender filter
    if (filters.genders.length > 0 && !filters.genders.includes(c.profile?.gender || "")) {
      return false;
    }

    return true;
  });

  // Sort guides
  const sortedGuides = [...filteredGuides].sort((a, b) => {
    switch (sortBy) {
      case "match":
        return (b.matchScore || 0) - (a.matchScore || 0);
      case "price_low":
        return (a.profile?.hourlyRate || 0) - (b.profile?.hourlyRate || 0);
      case "price_high":
        return (b.profile?.hourlyRate || 0) - (a.profile?.hourlyRate || 0);
      case "highest_rated":
        const aRating = a.reviewsReceived?.length
          ? a.reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / a.reviewsReceived.length
          : 0;
        const bRating = b.reviewsReceived?.length
          ? b.reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / b.reviewsReceived.length
          : 0;
        return bRating - aRating;
      case "most_reviews":
        return (b.reviewsReceived?.length || 0) - (a.reviewsReceived?.length || 0);
      default:
        return 0;
    }
  });

  const totalActiveFilters =
    filters.procedures.length +
    filters.ageRanges.length +
    filters.genders.length +
    filters.activityLevels.length;

  return (
    <ContentAcknowledgmentModal>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold">Talk to Someone Who Had It</h1>
            </div>
            <p className="text-lg sm:text-xl text-cyan-100 max-w-2xl">
              Book a 1-on-1 video call. Ask questions, get real-time advice from someone who&apos;s been there.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Real people, real experience
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book on your schedule
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ask anything
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DisclaimerBanner dismissible />

          {userProcedures.length >= 2 && (
            <div className="mb-6 flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <label htmlFor="condition-selector" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Matching for:
              </label>
              <select
                id="condition-selector"
                value={selectedProcedure}
                onChange={(e) => {
                  setSelectedProcedure(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                {userProcedures.map((proc) => (
                  <option key={proc} value={proc}>
                    {proc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={fetchData} className="text-sm text-red-600 hover:text-red-700 font-medium">Retry</button>
            </div>
          )}

          {/* Looking for recordings CTA */}
          <div className="mb-8 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-teal-900">Prefer to learn at your own pace?</p>
                <p className="text-sm text-teal-700">Browse recorded recovery stories you can watch anytime.</p>
              </div>
              <Link
                href="/watch"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Stories
              </Link>
            </div>
          </div>

          {/* Search and Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-cyan-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {totalActiveFilters > 0 && (
                <span className="bg-cyan-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {totalActiveFilters}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-24">
                <h2 className="font-semibold text-gray-900 mb-4">Find Your Guide</h2>
                <FilterSidebar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  showCategory={false}
                />
              </div>
            </aside>

            {/* Mobile Filters Modal */}
            {showMobileFilters && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
                <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white p-6 overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Filters</h2>
                    <button onClick={() => setShowMobileFilters(false)} className="p-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <FilterSidebar
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    showCategory={false}
                  />
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="w-full mt-6 py-3 bg-cyan-600 text-white rounded-lg font-medium"
                  >
                    Show {sortedGuides.length} results
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1">
              {!loading && (
                <p className="text-sm text-gray-500 mb-4">
                  {sortedGuides.length} guide{sortedGuides.length !== 1 ? "s" : ""} available
                </p>
              )}

              {loading ? (
                <div className="grid sm:grid-cols-2 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
                  ))}
                </div>
              ) : sortedGuides.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 text-lg mb-2">No guides found</p>
                  <p className="text-gray-400 text-sm">Try adjusting your filters or search terms.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {sortedGuides.map((c) => (
                    <GuideCard
                      key={c.id}
                      guide={c}
                      isOwn={!!currentUserId && c.id === currentUserId}
                      hideMatchScore={isGuideOnly || (!!currentUserId && c.id === currentUserId)}
                    />
                  ))}
                </div>
              )}

              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50 bg-white"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50 bg-white"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ContentAcknowledgmentModal>
  );
}

export default function GuidesPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8">Loading...</div>}>
      <GuidesContent />
    </Suspense>
  );
}
