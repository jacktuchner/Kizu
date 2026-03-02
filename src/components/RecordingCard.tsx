"use client";

import Link from "next/link";
import { useState } from "react";
import VerifiedBadge from "@/components/VerifiedBadge";

interface RecordingCardProps {
  id: string;
  title: string;
  guideName: string;
  procedureType: string;
  ageRange: string;
  activityLevel: string;
  category: string;
  durationSeconds?: number | null;
  isVideo: boolean;
  thumbnailUrl?: string | null;
  viewCount: number;
  averageRating?: number;
  matchScore?: number;
  matchBreakdown?: { attribute: string; matched: boolean; weight: number }[];
  guideVerified?: boolean;
  isOwn?: boolean;
  hideMatchScore?: boolean;
}

const categoryLabels: Record<string, string> = {
  WEEKLY_TIMELINE: "Timeline",
  WISH_I_KNEW: "Wish I Knew",
  PRACTICAL_TIPS: "Practical Tips",
  MENTAL_HEALTH: "Mental Health",
  RETURN_TO_ACTIVITY: "Return to Activity",
  MISTAKES_AND_LESSONS: "Lessons Learned",
};

const activityLabels: Record<string, string> = {
  SEDENTARY: "Sedentary",
  LIGHTLY_ACTIVE: "Lightly Active",
  MODERATELY_ACTIVE: "Moderately Active",
  ACTIVE: "Active",
  ATHLETE: "Athlete",
  // Legacy values for backwards compatibility
  RECREATIONAL: "Moderately Active",
  COMPETITIVE_ATHLETE: "Athlete",
  PROFESSIONAL_ATHLETE: "Athlete",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function MatchScoreTooltip({ breakdown }: { breakdown: { attribute: string; matched: boolean; weight: number }[] }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShow(!show); }}
        className="ml-1 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute right-0 top-5 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-2.5 text-left">
          <p className="text-xs font-medium text-gray-700 mb-1.5">Match breakdown:</p>
          <div className="space-y-0.5">
            {breakdown.map((item) => (
              <div key={item.attribute} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{item.attribute}</span>
                <span className={item.matched ? "text-green-600" : "text-gray-400"}>
                  {item.matched ? "✓" : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordingCard({
  id, title, guideName, procedureType, ageRange, activityLevel,
  category, durationSeconds, isVideo, thumbnailUrl, viewCount, averageRating, matchScore, matchBreakdown,
  guideVerified, isOwn, hideMatchScore,
}: RecordingCardProps) {
  const showMatchScore = matchScore !== undefined && !hideMatchScore;
  return (
    <Link href={`/recordings/${id}`} className="block group h-full">
      <div className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg hover:border-teal-200 transition-all h-full flex flex-col ${isOwn ? "border-l-2 border-l-teal-300 border-gray-200" : "border-gray-200"}`} title={isOwn ? "Your recording" : undefined}>
        <div className="relative">
          {isVideo && thumbnailUrl ? (
            <div className="relative aspect-video bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  Video
                </span>
                {showMatchScore && (
                  <div className="flex items-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      matchScore >= 80 ? "bg-green-100 text-green-700" :
                      matchScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {matchScore}% match
                    </span>
                    {matchBreakdown && <MatchScoreTooltip breakdown={matchBreakdown} />}
                  </div>
                )}
              </div>
              {durationSeconds && (
                <span className="absolute bottom-2 right-2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                  {formatDuration(durationSeconds)}
                </span>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {isVideo ? "Video" : "Audio"}
                </span>
                {showMatchScore && (
                  <div className="flex items-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      matchScore >= 80 ? "bg-green-100 text-green-700" :
                      matchScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {matchScore}% match
                    </span>
                    {matchBreakdown && <MatchScoreTooltip breakdown={matchBreakdown} />}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center h-16">
                <svg className="w-12 h-12 text-teal-300 group-hover:text-teal-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {durationSeconds && (
                <span className="absolute bottom-2 right-2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                  {formatDuration(durationSeconds)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-2 mb-1 min-h-[2.75rem]">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-sm text-gray-500">{guideName}</p>
            {guideVerified && <VerifiedBadge />}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[3.25rem]">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full h-fit">{procedureType}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full h-fit">{ageRange}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full h-fit">{activityLabels[activityLevel] || activityLevel}</span>
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full h-fit">{categoryLabels[category] || category}</span>
          </div>

          <div className="flex items-center justify-between text-sm mt-auto">
            <div className="flex items-center gap-3 text-gray-400">
              {averageRating !== undefined && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {averageRating.toFixed(1)}
                </span>
              )}
              <span>{viewCount} views</span>
            </div>
            {isOwn && (
              <span className="text-[11px] text-gray-400 italic sm:hidden">Yours</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
