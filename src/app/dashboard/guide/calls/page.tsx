"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { parseDate } from "@/lib/dates";
import { MIN_CALL_RATE, MAX_CALL_RATE } from "@/lib/constants";
import AvailabilityManager from "@/components/AvailabilityManager";
import VideoCall from "@/components/VideoCall";

export default function GuideCallsPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    async function load() {
      try {
        const [profileRes, callsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/calls"),
        ]);
        if (profileRes.ok) {
          const p = await profileRes.json();
          setProfile(p);
          setHourlyRate(p?.hourlyRate || 50);
        }
        if (callsRes.ok) setCalls(await callsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  async function enableCalls() {
    setEnabling(true);
    try {
      const procedures = profile?.procedureTypes?.length > 0
        ? profile.procedureTypes
        : (profile?.procedureType ? [profile.procedureType] : []);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageRange: profile?.ageRange || "",
          gender: profile?.gender || "",
          activityLevel: profile?.activityLevel || "RECREATIONAL",
          hourlyRate: profile?.hourlyRate || 50,
          isAvailableForCalls: true,
          procedureTypes: procedures,
          procedureProfiles: profile?.procedureProfiles || {},
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnabling(false);
    }
  }

  async function saveRate() {
    setSavingRate(true);
    try {
      const procedures = profile?.procedureTypes?.length > 0
        ? profile.procedureTypes
        : (profile?.procedureType ? [profile.procedureType] : []);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageRange: profile?.ageRange || "",
          gender: profile?.gender || "",
          activityLevel: profile?.activityLevel || "RECREATIONAL",
          hourlyRate,
          isAvailableForCalls: true,
          procedureTypes: procedures,
          procedureProfiles: profile?.procedureProfiles || {},
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setRateSaved(true);
        setTimeout(() => setRateSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRate(false);
    }
  }

  async function updateCallStatus(callId: string, newStatus: string) {
    try {
      setCancelError(null);
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCalls((prev) => prev.map((c) => (c.id === callId ? updated : c)));
        setCancellingId(null);
      } else {
        const data = await res.json();
        setCancelError(data.error || "Failed to update call");
      }
    } catch (err) {
      console.error(err);
      setCancelError("Something went wrong");
    }
  }

  if (loading) return <div>Loading...</div>;

  // Empty state — calls not enabled
  if (!profile?.isAvailableForCalls) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Offer 1-on-1 Calls with Seekers</h2>
          <p className="text-gray-500 text-sm mb-6">Connect directly with seekers through paid video calls.</p>
          <ul className="text-left text-sm text-gray-600 space-y-3 mb-8 max-w-xs mx-auto">
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Set your own hourly rate and availability
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Seekers book and pay through the platform
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Built-in video calls with automatic payouts
            </li>
          </ul>
          <button
            onClick={enableCalls}
            disabled={enabling}
            className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {enabling ? "Enabling..." : "Enable Calls"}
          </button>
        </div>
      </div>
    );
  }

  // Calls enabled — full tab content
  const now = new Date();
  const upcomingCalls = calls
    .filter((c) => c.status === "CONFIRMED" && parseDate(c.scheduledAt) > new Date(now.getTime() - c.durationMinutes * 60000))
    .sort((a, b) => parseDate(a.scheduledAt).getTime() - parseDate(b.scheduledAt).getTime());

  const pastCalls = calls
    .filter((c) => c.status === "COMPLETED" || c.status === "CANCELLED" || (c.status === "CONFIRMED" && parseDate(c.scheduledAt) <= new Date(now.getTime() - c.durationMinutes * 60000)))
    .sort((a, b) => parseDate(b.scheduledAt).getTime() - parseDate(a.scheduledAt).getTime());

  const pendingCalls = calls.filter((c) => c.status === "REQUESTED");

  function getHoursUntilCall(scheduledAt: string): number {
    return (parseDate(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  }

  return (
    <div className="space-y-8">
      {/* Hourly Rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Hourly Rate</h2>
        <p className="text-sm text-gray-500 mb-4">Set your rate for 1-on-1 calls. 30-minute calls are charged at half rate.</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-lg">$</span>
            <input
              type="number"
              min={MIN_CALL_RATE}
              max={MAX_CALL_RATE}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseInt(e.target.value) || 50)}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-gray-500">/ hour</span>
          </div>
          <button
            onClick={saveRate}
            disabled={savingRate}
            className="bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {savingRate ? "Saving..." : "Save Rate"}
          </button>
          {rateSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
        <p className="text-xs text-gray-400 mt-2">Range: ${MIN_CALL_RATE} - ${MAX_CALL_RATE}</p>
      </div>

      {/* Availability Manager (weekly hours, calendar, call settings) */}
      <AvailabilityManager />

      {/* Pending Call Requests */}
      {pendingCalls.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Pending Requests ({pendingCalls.length})</h2>
          <div className="space-y-3">
            {pendingCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                cancellingId={cancellingId}
                setCancellingId={setCancellingId}
                onUpdateStatus={updateCallStatus}
                getHoursUntilCall={getHoursUntilCall}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Calls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Calls ({upcomingCalls.length})</h2>
        {cancelError && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{cancelError}</div>
        )}
        {upcomingCalls.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No upcoming calls scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcomingCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                cancellingId={cancellingId}
                setCancellingId={setCancellingId}
                onUpdateStatus={updateCallStatus}
                getHoursUntilCall={getHoursUntilCall}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past Calls */}
      {pastCalls.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Past Calls ({pastCalls.length})</h2>
          <div className="space-y-3">
            {pastCalls.slice(0, 10).map((call) => (
              <CallCard
                key={call.id}
                call={call}
                cancellingId={cancellingId}
                setCancellingId={setCancellingId}
                onUpdateStatus={updateCallStatus}
                getHoursUntilCall={getHoursUntilCall}
              />
            ))}
            {pastCalls.length > 10 && (
              <p className="text-sm text-gray-400 text-center pt-2">
                Showing 10 of {pastCalls.length} past calls
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Call Card Component ─── */

function CallCard({
  call,
  cancellingId,
  setCancellingId,
  onUpdateStatus,
  getHoursUntilCall,
}: {
  call: any;
  cancellingId: string | null;
  setCancellingId: (id: string | null) => void;
  onUpdateStatus: (callId: string, status: string) => void;
  getHoursUntilCall: (scheduledAt: string) => number;
}) {
  const scheduled = parseDate(call.scheduledAt);
  const isUpcoming = call.status === "CONFIRMED" && scheduled > new Date(Date.now() - call.durationMinutes * 60000);
  const canJoinCall = isUpcoming && call.videoRoomUrl;
  const hoursUntil = getHoursUntilCall(call.scheduledAt);
  const isLateCancel = hoursUntil < 24;
  const showCancelConfirm = cancellingId === call.id;

  const statusBadge = call.status === "CONFIRMED"
    ? "bg-green-100 text-green-700"
    : call.status === "COMPLETED"
    ? "bg-gray-100 text-gray-600"
    : call.status === "REQUESTED"
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  const statusLabel = call.status === "CONFIRMED"
    ? "Upcoming"
    : call.status === "COMPLETED"
    ? "Completed"
    : call.status === "REQUESTED"
    ? "Pending"
    : "Cancelled";

  const seekerCondition = call.seeker?.profile?.activeProcedureType || null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 truncate">{call.seeker?.name || "Seeker"}</p>
            {seekerCondition && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full flex-shrink-0">
                {seekerCondition}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {" at "}
            {scheduled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" "}&middot; {call.durationMinutes} min
            {call.contributorPayout != null && <> &middot; ${call.contributorPayout.toFixed(2)} payout</>}
          </p>
          {call.questionsInAdvance && (
            <p className="text-xs text-gray-400 mt-1 truncate">Q: {call.questionsInAdvance}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {call.status === "REQUESTED" && (
            <button
              onClick={() => onUpdateStatus(call.id, "CONFIRMED")}
              className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium transition-colors"
            >
              Accept
            </button>
          )}
          {call.status === "CONFIRMED" && (
            <>
              <button
                onClick={() => onUpdateStatus(call.id, "COMPLETED")}
                className="text-xs bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-200 font-medium"
              >
                Mark Done
              </button>
              {!showCancelConfirm && (
                <button
                  onClick={() => setCancellingId(call.id)}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 font-medium"
                >
                  Cancel
                </button>
              )}
            </>
          )}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {showCancelConfirm && (
        <div className={`p-4 border-t ${isLateCancel ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isLateCancel ? "text-amber-500" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              {isLateCancel ? (
                <>
                  <p className="text-sm font-medium text-amber-800">Late cancellation - no refund</p>
                  <p className="text-xs text-amber-600 mt-1">This call is less than 24 hours away. The seeker will not receive a refund.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-red-800">Cancel this call?</p>
                  <p className="text-xs text-red-600 mt-1">The seeker will receive a full refund.</p>
                </>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => onUpdateStatus(call.id, "CANCELLED")} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium">
                  Yes, Cancel Call
                </button>
                <button onClick={() => setCancellingId(null)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 font-medium">
                  Keep Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canJoinCall && (
        <div className="p-4 border-t border-gray-200">
          <VideoCall roomUrl={call.videoRoomUrl} callId={call.id} scheduledAt={call.scheduledAt} durationMinutes={call.durationMinutes} />
        </div>
      )}
    </div>
  );
}
