"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReportButton from "@/components/ReportButton";

const activityLabels: Record<string, string> = {
  SEDENTARY: "Sedentary",
  LIGHTLY_ACTIVE: "Lightly Active",
  MODERATELY_ACTIVE: "Moderately Active",
  ACTIVE: "Active",
  ATHLETE: "Athlete",
  RECREATIONAL: "Moderately Active",
  COMPETITIVE_ATHLETE: "Athlete",
  PROFESSIONAL_ATHLETE: "Athlete",
};

const categoryLabels: Record<string, string> = {
  WEEKLY_TIMELINE: "Timeline",
  WISH_I_KNEW: "Wish I Knew",
  PRACTICAL_TIPS: "Practical Tips",
  MENTAL_HEALTH: "Mental Health",
  RETURN_TO_ACTIVITY: "Return to Activity",
  MISTAKES_AND_LESSONS: "Lessons Learned",
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

export default function SeriesDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [series, setSeries] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = (session?.user as any)?.id;

  async function loadSeries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/series/${id}`);
      if (!res.ok) throw new Error("Failed to load series.");
      setSeries(await res.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load series.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeries();
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8">Loading...</div>;
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={loadSeries} className="text-sm text-red-600 hover:text-red-700 font-medium">Retry</button>
      </div>
    </div>
  );
  if (!series) return <div className="max-w-4xl mx-auto px-4 py-8">Series not found.</div>;

  // All series are free — always viewable
  const canViewContent = true;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/watch" className="text-sm text-purple-600 hover:text-purple-700 mb-4 inline-block">
        &larr; Back to Stories
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Recording Series
              </span>
              <h1 className="text-2xl font-bold mt-2 text-gray-900">{series.title}</h1>
              {series.description && (
                <p className="text-gray-600 mt-2">{series.description}</p>
              )}
            </div>
          </div>

          {/* Series Stats */}
          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-purple-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{series.recordingCount} recordings</span>
            </div>
            {series.totalDuration && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(series.totalDuration)} total</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{series.procedureType}</span>
            </div>
          </div>
        </div>

        {/* Guide Info */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-700 font-semibold text-lg">
                {series.guide?.name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <Link
                href={`/guides/${series.contributorId}`}
                className="font-semibold hover:text-purple-700"
              >
                {series.guide?.name || "Anonymous"}
              </Link>
              {series.guide?.bio && (
                <p className="text-sm text-gray-500 line-clamp-1">{series.guide.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Recordings List */}
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">What&apos;s Included</h2>
          <div className="space-y-3">
            {series.recordings?.map((recording: any, index: number) => (
              <div
                key={recording.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-200 transition-colors"
              >
                {/* Sequence Number */}
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-purple-700">{index + 1}</span>
                </div>

                {/* Recording Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/recordings/${recording.id}`}
                    className="font-medium text-gray-900 hover:text-purple-700 block truncate"
                  >
                    {recording.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    {recording.category && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        {categoryLabels[recording.category] || recording.category}
                      </span>
                    )}
                    {recording.durationSeconds && (
                      <span className="text-xs text-gray-400">
                        {Math.floor(recording.durationSeconds / 60)}:{(recording.durationSeconds % 60).toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Watch Link */}
                <div className="flex-shrink-0 text-right">
                  <Link
                    href={`/recordings/${recording.id}`}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Watch &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Button */}
        <div className="px-6 pb-4 flex justify-end">
          <ReportButton seriesId={series.id} contentTitle={series.title} />
        </div>

        {/* Book a Call CTA */}
        {series.guide && !series.isGuide && (
          <div className="p-6 bg-gradient-to-r from-teal-50 to-cyan-50 border-t border-teal-100">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">
                  Want personalized advice from {series.guide.name?.split(" ")[0]}?
                </p>
                <p className="text-sm text-gray-600">
                  Book a 1-on-1 video call for real-time Q&A
                </p>
              </div>
              <Link
                href={`/book/${series.contributorId}`}
                className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-medium text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Book a Call
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
