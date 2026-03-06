"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Play, User } from "lucide-react";
import ScrollReveal from "./landing/ScrollReveal";

interface FeaturedRecording {
  id: string;
  title: string;
  description?: string;
  category: string;
  procedureType: string;
  ageRange: string;
  activityLevel: string;
  durationSeconds?: number;
  isVideo: boolean;
  viewCount: number;
  guide?: {
    id: string;
    name: string;
  };
  averageRating?: number;
  reviewCount: number;
}

const categoryLabels: Record<string, string> = {
  WEEKLY_TIMELINE: "Timeline",
  WISH_I_KNEW: "Wish I Knew",
  PRACTICAL_TIPS: "Tips",
  MENTAL_HEALTH: "Mental Health",
  RETURN_TO_ACTIVITY: "Return to Activity",
  MISTAKES_AND_LESSONS: "Lessons",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PreviewCard({ recording }: { recording: FeaturedRecording }) {
  return (
    <Link href={`/recordings/${recording.id}`}>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden group cursor-pointer hover:shadow-xl hover:scale-[1.02] focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 transition-all duration-300">
        <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-100 p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium bg-white/80 text-teal-700 px-2.5 py-1 rounded-full backdrop-blur-sm">
              {recording.isVideo ? "Video" : "Audio"}
            </span>
            <span className="text-xs bg-white/80 text-purple-600 px-2.5 py-1 rounded-full backdrop-blur-sm">
              {categoryLabels[recording.category] || recording.category}
            </span>
          </div>
          <div className="flex items-center justify-center h-14">
            <div className="w-14 h-14 bg-white/60 rounded-full flex items-center justify-center group-hover:bg-white/80 group-hover:scale-110 transition-all duration-300">
              <Play className="w-7 h-7 text-teal-600 ml-0.5" />
            </div>
          </div>
          {recording.durationSeconds && (
            <span className="absolute bottom-2 right-3 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
              {formatDuration(recording.durationSeconds)}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 text-sm leading-snug">
            {recording.title}
          </h3>
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-600">
              {recording.guide?.name || "Anonymous"}
            </p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {recording.procedureType}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ContentPreviewSection() {
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const [recordings, setRecordings] = useState<FeaturedRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/recordings/featured");
        if (res.ok) {
          const data = await res.json();
          setRecordings(data.recordings || []);
        }
      } catch (err) {
        console.error("Error fetching featured recordings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  if (loading) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Real Recovery Stories</h2>
            <p className="text-gray-600">Loading...</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 h-32 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recordings.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Real Recovery Stories</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Hear from real people about their recovery. All stories are free to watch.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {recordings.slice(0, 6).map((rec, i) => (
            <ScrollReveal key={rec.id} delay={Math.min(i + 1, 3)}>
              <PreviewCard recording={rec} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="text-center">
            {loggedIn ? (
              <Link
                href="/watch"
                className="inline-flex items-center justify-center bg-teal-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-teal-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300"
              >
                Browse All Stories
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center bg-teal-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-teal-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300"
                >
                  Sign Up Free
                </Link>
                <Link
                  href="/watch"
                  className="inline-flex items-center justify-center border-2 border-teal-600 text-teal-700 font-semibold px-8 py-3 rounded-full hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300"
                >
                  Browse All Stories
                </Link>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
