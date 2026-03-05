"use client";

import { useState } from "react";
import VideoCall from "@/components/VideoCall";
import {
  PROCEDURE_TYPES,
  MIN_GROUP_SESSION_PRICE,
  MAX_GROUP_SESSION_PRICE,
  MIN_GROUP_CAPACITY,
  MAX_GROUP_CAPACITY,
  GROUP_SESSION_DURATIONS,
} from "@/lib/constants";
import { parseDate } from "@/lib/dates";

interface GroupSession {
  id: string;
  title: string;
  description?: string;
  procedureType: string;
  scheduledAt: string;
  durationMinutes: number;
  maxCapacity: number;
  minAttendees: number;
  pricePerPerson: number;
  status: string;
  videoRoomUrl?: string;
  participantCount?: number;
}

interface Props {
  sessions: GroupSession[];
  guideProcedures: string[];
  onSessionsUpdate: (sessions: GroupSession[]) => void;
}

// Convert a datetime-local string (user's local time) to a UTC ISO string for the API
function datetimeLocalToISO(dtLocal: string): string {
  const [datePart, timePart] = dtLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

export default function GroupSessionsSection({ sessions, guideProcedures, onSessionsUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ scheduledAt: "", durationMinutes: 60 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    procedureType: guideProcedures[0] || "",
    scheduledAt: "",
    durationMinutes: 60,
    maxCapacity: 10,
    pricePerPerson: 15,
  });

  const upcomingSessions = sessions.filter(
    (s) => (s.status === "SCHEDULED" || s.status === "CONFIRMED") && parseDate(s.scheduledAt) > new Date()
  );
  const pastSessions = sessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "CANCELLED" || parseDate(s.scheduledAt) <= new Date()
  );

  async function createSession() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/group-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: datetimeLocalToISO(form.scheduledAt),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create session");
        return;
      }

      const newSession = await res.json();
      onSessionsUpdate([...sessions, { ...newSession, participantCount: 0 }]);
      setShowForm(false);
      setForm({
        title: "",
        description: "",
        procedureType: guideProcedures[0] || "",
        scheduledAt: "",
        durationMinutes: 60,
        maxCapacity: 10,
        pricePerPerson: 15,
      });
    } catch {
      setError("Failed to create session");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession(sessionId: string) {
    if (!confirm("Are you sure you want to cancel this session? All participants will be refunded.")) return;
    setCancellingId(sessionId);
    try {
      const res = await fetch(`/api/group-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (res.ok) {
        const updated = await res.json();
        onSessionsUpdate(sessions.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  }

  function toDatetimeLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  function startEditing(s: GroupSession) {
    const local = parseDate(s.scheduledAt);
    setEditForm({ scheduledAt: toDatetimeLocal(local), durationMinutes: s.durationMinutes });
    setEditingId(s.id);
    setEditError(null);
  }

  async function saveEdit(sessionId: string) {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/group-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: datetimeLocalToISO(editForm.scheduledAt),
          durationMinutes: editForm.durationMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Failed to update");
        return;
      }

      const updated = await res.json();
      onSessionsUpdate(sessions.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
      setEditingId(null);
    } catch {
      setEditError("Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  // Minimum date: 24 hours from now
  const minDateTime = toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Group Sessions</h2>
          <p className="text-sm text-gray-500 mt-1">Host group recovery sessions for multiple seekers</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 font-medium"
          >
            Create Group Session
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900">New Group Session</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., ACL Recovery: Weeks 1-6 Q&A"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What will you cover in this session?"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Type</label>
              <select
                value={form.procedureType}
                onChange={(e) => setForm((f) => ({ ...f, procedureType: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {(guideProcedures.length > 0 ? guideProcedures : PROCEDURE_TYPES as unknown as string[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                min={minDateTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {GROUP_SESSION_DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity ({MIN_GROUP_CAPACITY}-{MAX_GROUP_CAPACITY})</label>
              <input
                type="number"
                min={MIN_GROUP_CAPACITY}
                max={MAX_GROUP_CAPACITY}
                value={form.maxCapacity}
                onChange={(e) => setForm((f) => ({ ...f, maxCapacity: parseInt(e.target.value) || MIN_GROUP_CAPACITY }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Person (${MIN_GROUP_SESSION_PRICE}-${MAX_GROUP_SESSION_PRICE})</label>
              <input
                type="number"
                min={MIN_GROUP_SESSION_PRICE}
                max={MAX_GROUP_SESSION_PRICE}
                step={1}
                value={form.pricePerPerson}
                onChange={(e) => setForm((f) => ({ ...f, pricePerPerson: parseFloat(e.target.value) || MIN_GROUP_SESSION_PRICE }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={createSession}
              disabled={saving || !form.title || !form.scheduledAt || !form.procedureType}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Creating..." : "Create Session"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Upcoming</h3>
          <div className="space-y-3">
            {upcomingSessions.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{s.title}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {parseDate(s.scheduledAt).toLocaleDateString()} at{" "}
                      {parseDate(s.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" "}&middot; {s.durationMinutes} min
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="text-teal-600 font-medium">{s.participantCount || 0}</span>/{s.maxCapacity} signed up
                      {" "}&middot; ${s.pricePerPerson}/person
                    </p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {s.procedureType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === "SCHEDULED" && (s.participantCount || 0) === 0 && editingId !== s.id && (
                      <button
                        onClick={() => startEditing(s)}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50"
                      >
                        Edit
                      </button>
                    )}
                    {s.status === "SCHEDULED" && (
                      <button
                        onClick={() => cancelSession(s.id)}
                        disabled={cancellingId === s.id}
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === s.id ? "Cancelling..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline edit form for date/time */}
                {editingId === s.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    {editError && (
                      <p className="text-xs text-red-600">{editError}</p>
                    )}
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={editForm.scheduledAt}
                          min={minDateTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                        <select
                          value={editForm.durationMinutes}
                          onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                        >
                          {GROUP_SESSION_DURATIONS.map((d) => (
                            <option key={d} value={d}>{d} min</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => saveEdit(s.id)}
                        disabled={editSaving || !editForm.scheduledAt}
                        className="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {editSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditError(null); }}
                        className="text-gray-500 hover:text-gray-700 px-2 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Video call for confirmed sessions */}
                {s.status === "CONFIRMED" && s.videoRoomUrl && (
                  <div className="p-4 border-t border-gray-200">
                    <VideoCall
                      roomUrl={s.videoRoomUrl}
                      callId={s.id}
                      scheduledAt={s.scheduledAt}
                      durationMinutes={s.durationMinutes}
                      type="group-session"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Past</h3>
          <div className="space-y-3">
            {pastSessions.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{s.title}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.status === "COMPLETED" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {parseDate(s.scheduledAt).toLocaleDateString()}
                      {" "}&middot; {s.participantCount || 0} participants
                      {" "}&middot; ${s.pricePerPerson}/person
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-500 text-sm">No group sessions yet. Create one to get started!</p>
        </div>
      )}
    </section>
  );
}
