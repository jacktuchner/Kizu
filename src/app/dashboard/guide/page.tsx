"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import { parseDate } from "@/lib/dates";
import CallRequestsSection from "@/components/guide/CallRequestsSection";
import PurchaseHistory from "@/components/PurchaseHistory";
import SharedJournalsSection from "@/components/guide/SharedJournalsSection";

export default function GuideOverviewPage() {
  const { data: session } = useSession();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [groupSessions, setGroupSessions] = useState<any[]>([]);
  const [reviewsReceived, setReviewsReceived] = useState<any[]>([]);
  const [forumReplyCount, setForumReplyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    const userId = (session.user as any).id;
    async function load() {
      try {
        const [recRes, callsRes, gsRes, revRes] = await Promise.all([
          fetch("/api/recordings/mine"),
          fetch("/api/calls"),
          fetch(`/api/group-sessions?contributorId=${userId}`),
          fetch(`/api/reviews?subjectId=${userId}`),
        ]);
        if (recRes.ok) setRecordings(await recRes.json());
        if (callsRes.ok) setCalls(await callsRes.json());
        if (gsRes.ok) setGroupSessions(await gsRes.json());
        if (revRes.ok) setReviewsReceived(await revRes.json());
        try {
          const frRes = await fetch("/api/forum/replies/count");
          if (frRes.ok) {
            const frData = await frRes.json();
            setForumReplyCount(frData.count || 0);
          }
        } catch {}
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Recordings</p>
          <p className="text-2xl font-bold text-teal-700">{recordings.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Views</p>
          <p className="text-2xl font-bold text-teal-700">{recordings.reduce((a, r) => a + (r.viewCount || 0), 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Calls Completed</p>
          <p className="text-2xl font-bold text-teal-700">{calls.filter((c) => c.status === "COMPLETED").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Upcoming Calls</p>
          <p className="text-2xl font-bold text-teal-700">{calls.filter((c) => c.status === "CONFIRMED" && parseDate(c.scheduledAt) > new Date()).length}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Group Sessions</p>
          <p className="text-2xl font-bold text-teal-700">{groupSessions.filter((s: any) => s.status === "SCHEDULED" || s.status === "CONFIRMED").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Avg Rating</p>
          <p className="text-2xl font-bold text-yellow-600">
            {reviewsReceived.length > 0
              ? (reviewsReceived.reduce((a: number, r: any) => a + r.rating, 0) / reviewsReceived.length).toFixed(1)
              : "-"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Reviews</p>
          <p className="text-2xl font-bold text-teal-700">{reviewsReceived.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Community Replies</p>
          <p className="text-2xl font-bold text-cyan-700">{forumReplyCount}</p>
        </div>
      </div>
      <CallRequestsSection
        calls={calls}
        onCallUpdate={(callId, updated) => {
          setCalls((prev) => prev.map((c) => (c.id === callId ? updated : c)));
        }}
      />

      <SharedJournalsSection />

      <PurchaseHistory role="guide" />

      {/* Reviews Received */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Reviews Received ({reviewsReceived.length})</h2>
        {reviewsReceived.length === 0 ? (
          <p className="text-gray-400 text-sm">No reviews received yet.</p>
        ) : (
          <div className="space-y-4">
            {reviewsReceived.slice(0, 10).map((r: any) => (
              <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.author?.name || "Anonymous"}</span>
                  <span className="text-yellow-500 text-sm">
                    {"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.callId ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                  }`}>
                    {r.callId ? "Call" : "Recording"}
                  </span>
                  <span className="text-xs text-gray-400">{parseDate(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
            {reviewsReceived.length > 10 && (
              <p className="text-sm text-gray-500 text-center">
                Showing 10 of {reviewsReceived.length} reviews
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
