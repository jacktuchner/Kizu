"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import RecordingCard from "@/components/RecordingCard";
import MatchScoreTooltip from "@/components/MatchScoreTooltip";
import { RECOMMENDATION_CATEGORIES, GENDERS, isChronicPainCondition } from "@/lib/constants";
import { getTimeSinceSurgeryLabel, getTimeSinceDiagnosisLabel } from "@/lib/surgeryDate";
import MessageButton from "@/components/MessageButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import { parseDate } from "@/lib/dates";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Phoenix": "Arizona Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii Time",
};

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  if (m === 0) return `${hour12}${suffix}`;
  return `${hour12}:${m.toString().padStart(2, "0")}${suffix}`;
}

/** Build a plain-English availability summary like "Mon–Fri 9am–5pm" */
function buildAvailabilitySummary(
  slots: { dayOfWeek: number; startTime: string; endTime: string; timezone: string }[]
): { summary: string; timezone: string | null } {
  if (!slots || slots.length === 0) return { summary: "", timezone: null };

  const tz = slots[0]?.timezone || null;

  // Group by day
  const byDay: Record<number, { startTime: string; endTime: string }[]> = {};
  slots.forEach((s) => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = [];
    byDay[s.dayOfWeek].push({ startTime: s.startTime, endTime: s.endTime });
  });

  // Build a signature per day to group consecutive days with the same times
  const daySignatures: { day: number; sig: string; times: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const daySlots = byDay[d];
    if (!daySlots) continue;
    const sorted = daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const sig = sorted.map((s) => `${s.startTime}-${s.endTime}`).join(",");
    const times = sorted.map((s) => `${formatTime12h(s.startTime)}–${formatTime12h(s.endTime)}`).join(", ");
    daySignatures.push({ day: d, sig, times });
  }

  // Group consecutive days with same signature
  const groups: { days: number[]; times: string }[] = [];
  daySignatures.forEach((ds) => {
    const last = groups[groups.length - 1];
    if (last && last.days.length > 0) {
      const lastDay = last.days[last.days.length - 1];
      const lastSig = daySignatures.find((x) => x.day === lastDay)?.sig;
      if (lastSig === ds.sig) {
        last.days.push(ds.day);
        return;
      }
    }
    groups.push({ days: [ds.day], times: ds.times });
  });

  // Format each group
  const parts = groups.map((g) => {
    const dayLabel =
      g.days.length === 1
        ? DAY_NAMES[g.days[0]]
        : g.days.length === 7
        ? "Every day"
        : `${DAY_NAMES[g.days[0]]}–${DAY_NAMES[g.days[g.days.length - 1]]}`;
    return `${dayLabel} ${g.times}`;
  });

  return { summary: parts.join(", "), timezone: tz };
}

const activityLabels: Record<string, string> = {
  SEDENTARY: "Sedentary",
  RECREATIONAL: "Recreational",
  COMPETITIVE_ATHLETE: "Competitive Athlete",
  PROFESSIONAL_ATHLETE: "Professional Athlete",
};


export default function GuideDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const fromBooking = searchParams.get("from") === "booking";
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);

  const isOwnProfile = session?.user && (session.user as any).id === id;

  async function loadGuide() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guides/${id}`);
      if (!res.ok) throw new Error("Failed to load guide profile.");
      setGuide(await res.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load guide profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGuide();
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8">Loading...</div>;
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={loadGuide} className="text-sm text-red-600 hover:text-red-700 font-medium">Retry</button>
      </div>
    </div>
  );
  if (!guide) return <div className="max-w-4xl mx-auto px-4 py-8">Guide not found.</div>;

  const avgRating = guide.reviewsReceived?.length
    ? (guide.reviewsReceived.reduce((a: number, r: any) => a + r.rating, 0) / guide.reviewsReceived.length).toFixed(1)
    : null;

  // Procedure details for inline display
  const procedures: string[] = guide.profile?.procedureTypes?.length > 0
    ? guide.profile.procedureTypes
    : (guide.profile?.procedureType ? [guide.profile.procedureType] : []);
  const hasMultipleProcedures = procedures.length > 1;
  const activeProc = selectedProcedure || guide.profile?.activeProcedureType || guide.profile?.procedureType;
  const procProfiles = guide.profile?.procedureProfiles || {};
  const lifestyle: string[] = guide.profile?.lifestyleContext || [];

  function getInstances(proc: string): any[] {
    const val = procProfiles[proc];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object" && Object.keys(val).length > 0) return [val];
    if (proc === guide.profile?.procedureType) {
      return [{
        procedureDetails: guide.profile.procedureDetails,
        surgeryDate: guide.profile.surgeryDate,
        timeSinceSurgery: guide.profile.timeSinceSurgery,
        recoveryGoals: guide.profile.recoveryGoals || [],
        complicatingFactors: guide.profile.complicatingFactors || [],
      }];
    }
    return [];
  }

  const instances = activeProc ? getInstances(activeProc) : [];
  const isChronic = activeProc ? isChronicPainCondition(activeProc) : false;

  // Availability summary
  const { summary: availSummary, timezone: availTz } = buildAvailabilitySummary(guide.availability || []);
  const tzLabel = availTz ? (TIMEZONE_LABELS[availTz] || availTz) : null;

  // Content checks
  const hasRecordings = guide.recordings?.length > 0;
  const hasSeries = guide.series?.length > 0;
  const hasRecommendations = guide.recommendations?.length > 0;
  const hasReviews = guide.reviewsReceived?.length > 0;
  const hasAnyContent = hasRecordings || hasSeries || hasRecommendations || hasReviews;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={isOwnProfile ? "/dashboard/guide/profile" : fromBooking ? `/book/${id}` : "/guides"}
        className="text-sm text-teal-600 hover:text-teal-700 mb-4 inline-block"
      >
        &larr; {isOwnProfile ? "Back to Dashboard" : fromBooking ? "Back to Booking" : "Back to Guides"}
      </Link>

      {/* Intro Video */}
      {guide.profile?.introVideoUrl && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <video
            src={guide.profile.introVideoUrl}
            controls
            autoPlay
            muted
            playsInline
            className="w-full max-h-96 bg-black"
          />
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Meet {guide.name?.split(" ")[0] || "this guide"}
              {guide.profile.introVideoDuration && (
                <span className="text-gray-400 ml-2">
                  ({Math.floor(guide.profile.introVideoDuration / 60)}:{(guide.profile.introVideoDuration % 60).toString().padStart(2, "0")})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ═══ Profile Header (merged with procedure details) ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 mb-4">
        {/* Top row: avatar + name + actions */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-700 font-bold text-xl">
              {guide.name?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{guide.name}</h1>
              {guide.contributorStatus === "APPROVED" && <VerifiedBadge />}
              {guide.matchScore !== undefined && (
                <div className="flex items-center">
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

            {/* Condition/procedure + time since surgery — inline */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {procedures.map((proc: string) => (
                <span key={proc} className="text-sm text-teal-700 font-medium">{proc}</span>
              ))}
              {procedures.length > 0 && (guide.profile?.surgeryDate || guide.profile?.timeSinceSurgery) && (
                <span className="text-gray-300">·</span>
              )}
              {(guide.profile?.surgeryDate || guide.profile?.timeSinceSurgery) && (
                <span className="text-sm text-gray-500">
                  {guide.profile.surgeryDate
                    ? (isChronic
                        ? getTimeSinceDiagnosisLabel(guide.profile.surgeryDate)
                        : getTimeSinceSurgeryLabel(guide.profile.surgeryDate))
                    : `${guide.profile.timeSinceSurgery} post-op`}
                </span>
              )}
            </div>

            {/* Stats line */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {avgRating && (
                <span className="text-sm text-gray-500">
                  <span className="text-yellow-500">&#9733;</span> {avgRating} ({guide.reviewsReceived.length})
                </span>
              )}
              {avgRating && guide.completedCallCount > 0 && <span className="text-gray-300">·</span>}
              {guide.completedCallCount > 0 && (
                <span className="text-sm text-gray-500">
                  {guide.completedCallCount} calls completed
                </span>
              )}
            </div>
          </div>
          {!isOwnProfile && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              {guide.profile?.isAvailableForCalls && (
                <Link
                  href={`/book/${guide.id}`}
                  className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-semibold text-base text-center shadow-md hover:shadow-lg transition-all"
                >
                  Book a Call &middot; ${(guide.profile.hourlyRate / 2).toFixed(0)}/30min
                </Link>
              )}
              <MessageButton guideId={guide.id} />
            </div>
          )}
        </div>

        {/* Metadata tags — small, subtle */}
        <div className="flex flex-wrap gap-1.5 mt-4 text-xs text-gray-400">
          {guide.profile?.ageRange && (
            <span className="bg-gray-50 px-2 py-0.5 rounded">{guide.profile.ageRange}</span>
          )}
          {guide.profile?.gender && (
            <span className="bg-gray-50 px-2 py-0.5 rounded">
              {GENDERS.find((g) => g.value === guide.profile.gender)?.label || guide.profile.gender}
            </span>
          )}
          {guide.profile?.activityLevel && (
            <span className="bg-gray-50 px-2 py-0.5 rounded">
              {activityLabels[guide.profile.activityLevel] || guide.profile.activityLevel}
            </span>
          )}
          {guide.profile?.isAvailableForCalls && (
            <span className="bg-green-50 text-green-500 px-2 py-0.5 rounded">Available for calls</span>
          )}
        </div>

        {/* Bio */}
        {guide.bio && (
          <p className="text-gray-600 mt-4 leading-relaxed">{guide.bio}</p>
        )}

        {/* ── Procedure details (integrated) ── */}
        {(instances.length > 0 || lifestyle.length > 0) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            {/* Procedure tabs when multiple */}
            {hasMultipleProcedures && (
              <div className="flex flex-wrap gap-2 mb-4">
                {procedures.map((proc: string) => (
                  <button
                    key={proc}
                    onClick={() => setSelectedProcedure(proc)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      proc === activeProc
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {proc}
                  </button>
                ))}
              </div>
            )}

            {instances.map((inst: any, idx: number) => {
              const details = inst.procedureDetails;
              const goals: string[] = inst.recoveryGoals || [];
              const factors: string[] = inst.complicatingFactors || [];
              const hasContent = details || goals.length > 0 || factors.length > 0;
              if (!hasContent) return null;

              return (
                <div key={idx} className={instances.length > 1 ? "pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0" : ""}>
                  {instances.length > 1 && (
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      {details || (isChronic ? `Profile ${idx + 1}` : `Surgery ${idx + 1}`)}
                    </p>
                  )}
                  {details && instances.length <= 1 && (
                    <p className="text-sm text-gray-600 mb-2">{details}</p>
                  )}
                  {goals.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-400 mr-2">{isChronic ? "Goals:" : "Recovery goals:"}</span>
                      {goals.map((g: string) => (
                        <span key={g} className="inline-block text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded mr-1 mb-1">{g}</span>
                      ))}
                    </div>
                  )}
                  {factors.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400 mr-2">Complicating factors:</span>
                      {factors.map((f: string) => (
                        <span key={f} className="inline-block text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded mr-1 mb-1">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {lifestyle.length > 0 && (
              <div className={instances.some((inst: any) => inst.procedureDetails || inst.recoveryGoals?.length > 0 || inst.complicatingFactors?.length > 0) ? "mt-2" : ""}>
                <span className="text-xs text-gray-400 mr-2">Lifestyle:</span>
                {lifestyle.map((l: string) => (
                  <span key={l} className="inline-block text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mr-1 mb-1">{l}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Availability summary (plain English) ── */}
        {guide.profile?.isAvailableForCalls && availSummary && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              <span className="text-gray-400 mr-1">Usually available</span>
              {availSummary}
              {tzLabel && <span className="text-gray-400 ml-1">({tzLabel})</span>}
            </p>
          </div>
        )}
      </div>

      {/* ═══ Content Sections ═══ */}
      {hasAnyContent ? (
        <div className="space-y-4">
          {/* Recordings */}
          {hasRecordings && (
            <section>
              <h2 className="text-lg font-bold mb-3">Recordings</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {guide.recordings.map((rec: any) => (
                  <RecordingCard
                    key={rec.id}
                    id={rec.id}
                    title={rec.title}
                    guideName={guide.name || "Anonymous"}
                    procedureType={rec.procedureType}
                    ageRange={rec.ageRange}
                    activityLevel={rec.activityLevel}
                    category={rec.category}
                    durationSeconds={rec.durationSeconds}
                    isVideo={rec.isVideo}
                    thumbnailUrl={rec.thumbnailUrl}
                    viewCount={rec.viewCount}
                    averageRating={
                      rec.reviews?.length
                        ? rec.reviews.reduce((a: number, r: any) => a + r.rating, 0) / rec.reviews.length
                        : undefined
                    }
                    guideVerified={guide.contributorStatus === "APPROVED"}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Series */}
          {hasSeries && (
            <section>
              <h2 className="text-lg font-bold mb-3">Series</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {guide.series.map((s: any) => (
                  <Link key={s.id} href={`/series/${s.id}`} className="block group">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-teal-200 transition-all h-full">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
                          {s.title}
                        </h3>
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex-shrink-0">
                          Series
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{s.description}</p>
                      )}
                      <p className="text-xs text-gray-400">{s.recordings.length} recordings</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {hasRecommendations && (
            <section>
              <h2 className="text-lg font-bold mb-3">Recommendations</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {guide.recommendations.map((rec: any) => (
                  <Link
                    key={rec.id}
                    href={`/recommendations/${rec.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:border-teal-300 hover:shadow-md transition-all block"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        {RECOMMENDATION_CATEGORIES.find((c) => c.value === rec.category)?.label || rec.category}
                      </span>
                      {rec.priceRange && (
                        <span className="text-xs text-gray-400">{rec.priceRange}</span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{rec.name}</h3>
                    <span className="text-xs text-gray-400">{rec.procedureType}</span>
                    {rec.myComment && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">&ldquo;{rec.myComment}&rdquo;</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{rec.endorsementCount} {rec.endorsementCount === 1 ? "endorsement" : "endorsements"}</span>
                      <span>{rec.helpfulCount} helpful</span>
                      {rec.location && <span>{rec.location}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          {hasReviews && (
            <section>
              <h2 className="text-lg font-bold mb-3">Reviews</h2>
              <div className="space-y-3">
                {guide.reviewsReceived
                  .sort((a: any, b: any) => parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime())
                  .map((r: any) => (
                  <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{r.author?.name || "Anonymous"}</span>
                      <span className="text-yellow-500 text-sm">
                        {"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.callId ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"
                      }`}>
                        {r.callId ? "Call" : "Recording"}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                    {r.createdAt && (
                      <p className="text-xs text-gray-400 mt-1">{parseDate(r.createdAt).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* No content at all */
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400">This guide hasn&apos;t shared any stories yet.</p>
          {!isOwnProfile && guide.profile?.isAvailableForCalls && (
            <p className="text-sm text-gray-400 mt-2">
              You can still <Link href={`/book/${guide.id}`} className="text-teal-600 hover:underline">book a call</Link> to connect directly.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
