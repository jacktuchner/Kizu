"use client";

import Link from "next/link";
import { useState } from "react";

interface SeriesCardProps {
  id: string;
  title: string;
  guideName: string;
  procedureType: string;
  recordingCount: number;
  totalDuration?: number;
  matchScore?: number;
  matchBreakdown?: { attribute: string; matched: boolean; weight: number }[];
  isOwn?: boolean;
  hideMatchScore?: boolean;
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

export default function SeriesCard({
  id,
  title,
  guideName,
  procedureType,
  recordingCount,
  totalDuration,
  matchScore,
  matchBreakdown,
  isOwn,
  hideMatchScore,
}: SeriesCardProps) {
  const showMatchScore = matchScore !== undefined && !hideMatchScore;
  return (
    <Link href={`/series/${id}`} className="block group">
      <div className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all ${isOwn ? "border-l-2 border-l-teal-300 border-gray-200" : "border-gray-200"}`}>
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Series
              </span>
            </div>
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
            <div className="flex -space-x-2">
              {[...Array(Math.min(3, recordingCount))].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg bg-white border-2 border-purple-200 flex items-center justify-center shadow-sm"
                  style={{ zIndex: 3 - i }}
                >
                  <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              ))}
              {recordingCount > 3 && (
                <div
                  className="w-10 h-10 rounded-lg bg-purple-100 border-2 border-purple-200 flex items-center justify-center text-xs font-semibold text-purple-700"
                  style={{ zIndex: 0 }}
                >
                  +{recordingCount - 3}
                </div>
              )}
            </div>
          </div>
          {totalDuration && (
            <span className="absolute bottom-2 right-2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
              {formatDuration(totalDuration)}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2 mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-500 mb-3">{guideName}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {procedureType}
            </span>
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              {recordingCount} recordings
            </span>
          </div>

        </div>
      </div>
    </Link>
  );
}
