"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CALL_BUFFER_OPTIONS } from "@/lib/constants";
import type { AvailabilitySlot, DateOverride, CalendarCall } from "./availability/types";
import {
  formatTime,
  toDateStr,
  parseDateLocal,
  TIME_OPTIONS,
  DAYS_OF_WEEK,
  SHORT_DAYS,
  MONTH_NAMES,
  TIMEZONES,
} from "./availability/timelineUtils";
import DayTimeline from "./availability/DayTimeline";

export default function AvailabilityManager() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [calls, setCalls] = useState<CalendarCall[]>([]);
  const [callBufferMinutes, setCallBufferMinutes] = useState(15);
  const [maxCallsPerWeek, setMaxCallsPerWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Collapsible sections
  const [weeklyHoursOpen, setWeeklyHoursOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Form state for adding new weekly slot
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    timezone: "America/New_York",
  });

  // Settings saving state
  const [savingSettings, setSavingSettings] = useState(false);

  const loadCalendarData = useCallback(async () => {
    try {
      const res = await fetch("/api/availability/calendar");
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        setOverrides(data.overrides || []);
        setCalls(data.calls || []);
        setCallBufferMinutes(data.callBufferMinutes ?? 15);
        setMaxCallsPerWeek(data.maxCallsPerWeek ?? null);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // ─── Weekly Slots ───

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSlot),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add slot");
      }

      const slot = await res.json();
      setSlots((prev) =>
        [...prev, slot].sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return a.startTime.localeCompare(b.startTime);
        })
      );
      setSuccess("Availability slot added");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add slot");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    try {
      const res = await fetch(`/api/availability?id=${slotId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete slot");
      }
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete slot");
    }
  }

  // ─── Overrides ───

  async function createOverride(date: string, isBlocked: boolean, startTime?: string, endTime?: string, replaceId?: string) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, isBlocked, startTime, endTime, excludeId: replaceId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create override");
      }
      // If replacing an existing override, delete the old one
      if (replaceId) {
        await fetch(`/api/availability/overrides?id=${replaceId}`, { method: "DELETE" });
      }
      await loadCalendarData();
      setSuccess(isBlocked ? "Day blocked" : "Custom hours set");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create override");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOverride(id: string) {
    try {
      const res = await fetch(`/api/availability/overrides?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete override");
      }
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      setSuccess("Override removed");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete override");
    }
  }

  // ─── Settings ───

  async function saveSettings() {
    setError("");
    setSavingSettings(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callBufferMinutes, maxCallsPerWeek }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      setSuccess("Settings saved");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  // ─── Calendar helpers ───

  const slotsByDay = useMemo(() => {
    const grouped: Record<number, AvailabilitySlot[]> = {};
    slots.forEach((s) => {
      if (!grouped[s.dayOfWeek]) grouped[s.dayOfWeek] = [];
      grouped[s.dayOfWeek].push(s);
    });
    return grouped;
  }, [slots]);

  const overridesByDate = useMemo(() => {
    const grouped: Record<string, DateOverride[]> = {};
    overrides.forEach((o) => {
      if (!grouped[o.date]) grouped[o.date] = [];
      grouped[o.date].push(o);
    });
    return grouped;
  }, [overrides]);

  const callsByDate = useMemo(() => {
    const grouped: Record<string, CalendarCall[]> = {};
    calls.forEach((c) => {
      const date = c.scheduledAt.split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(c);
    });
    return grouped;
  }, [calls]);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(toDateStr(new Date(year, month, d)));
    }
    return days;
  }, [calendarMonth]);

  const todayStr = toDateStr(new Date());

  function getDayInfo(dateStr: string) {
    const date = parseDateLocal(dateStr);
    const dayOfWeek = date.getDay();
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const hasDefault = !!slotsByDay[dayOfWeek]?.length;
    const dateOverrides = overridesByDate[dateStr] || [];
    const isBlocked = dateOverrides.some((o) => o.isBlocked);
    const hasCustomHours = dateOverrides.some((o) => !o.isBlocked && o.startTime);
    const dayCalls = callsByDate[dateStr] || [];

    return { dayOfWeek, isPast, isToday, hasDefault, dateOverrides, isBlocked, hasCustomHours, dayCalls };
  }

  const selectedDayInfo = selectedDate ? getDayInfo(selectedDate) : null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">{success}</div>
      )}

      {/* ═══ Section A: Calendar / Day Timeline (drill-down) ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {selectedDate && selectedDayInfo ? (
          /* ── Day Timeline (full-width drill-down) ── */
          <div>
            <button
              onClick={() => setSelectedDate(null)}
              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to calendar
            </button>
            <DayTimeline
              dateStr={selectedDate}
              slots={slots}
              overrides={selectedDayInfo.dateOverrides}
              calls={selectedDayInfo.dayCalls}
              isBlocked={selectedDayInfo.isBlocked}
              hasCustomHours={selectedDayInfo.hasCustomHours}
              saving={saving}
              onBlockDay={() => createOverride(selectedDate, true)}
              onAddCustomHours={(start, end, replaceId) => createOverride(selectedDate, false, start, end, replaceId)}
              onClearOverride={deleteOverride}
              onUnblock={deleteOverride}
            />
          </div>
        ) : (
          /* ── Monthly Calendar (full-width default view) ── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Your Calendar</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCalendarMonth((prev) => {
                      const d = new Date(prev.year, prev.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    });
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-lg font-bold text-gray-800 min-w-[180px] text-center">
                  {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                </span>
                <button
                  onClick={() => {
                    setCalendarMonth((prev) => {
                      const d = new Date(prev.year, prev.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    });
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-5 mb-5 text-sm text-gray-500">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-teal-400"></span> Default hours</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Booked call(s)</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400"></span> Custom hours</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400"></span> Blocked</span>
            </div>

            {/* Calendar grid — full width */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              {SHORT_DAYS.map((d) => (
                <div key={d} className="bg-gray-50 py-3 text-center text-sm font-semibold text-gray-500">
                  {d}
                </div>
              ))}

              {/* Day cells */}
              {calendarDays.map((dateStr, i) => {
                if (!dateStr) {
                  return <div key={`pad-${i}`} className="bg-white p-3 min-h-[100px]" />;
                }

                const info = getDayInfo(dateStr);
                const dayNum = parseDateLocal(dateStr).getDate();

                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      if (!info.isPast) setSelectedDate(dateStr);
                    }}
                    disabled={info.isPast}
                    className={`bg-white p-3 min-h-[100px] text-left transition-colors relative ${
                      info.isPast
                        ? "text-gray-300 cursor-default"
                        : info.isToday
                        ? "bg-blue-50 ring-2 ring-blue-400 ring-inset hover:bg-blue-100"
                        : "hover:bg-gray-50 cursor-pointer"
                    }`}
                  >
                    {info.isToday && !info.isPast ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-base font-bold -mt-0.5 -ml-0.5">
                        {dayNum}
                      </span>
                    ) : (
                      <span className={`text-base font-semibold ${info.isPast ? "" : "text-gray-800"}`}>
                        {dayNum}
                      </span>
                    )}
                    {/* Indicators */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {info.isBlocked && (
                        <span className="w-3 h-3 rounded-full bg-red-400" title="Blocked" />
                      )}
                      {!info.isBlocked && info.hasCustomHours && (
                        <span className="w-3 h-3 rounded-full bg-amber-400" title="Custom hours" />
                      )}
                      {!info.isBlocked && !info.hasCustomHours && info.hasDefault && (
                        <span className="w-3 h-3 rounded-full bg-teal-400" title="Default hours" />
                      )}
                      {info.dayCalls.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-blue-500 text-white text-[11px] font-bold px-1" title={`${info.dayCalls.length} call(s)`}>
                          {info.dayCalls.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Section B: Default Weekly Hours (Collapsible) ═══ */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setWeeklyHoursOpen(!weeklyHoursOpen)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900">Default Weekly Hours</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {slots.length > 0
                ? `${slots.length} slot${slots.length !== 1 ? "s" : ""} across ${Object.keys(slotsByDay).length} day${Object.keys(slotsByDay).length !== 1 ? "s" : ""}`
                : "No availability set yet"}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${weeklyHoursOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {weeklyHoursOpen && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            {slots.length > 0 ? (
              <div className="mb-4">
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const daySlots = slotsByDay[index];
                    if (!daySlots || daySlots.length === 0) return null;
                    return (
                      <div key={day} className="flex items-start gap-4 py-2 border-b border-gray-100 last:border-0">
                        <span className="w-24 text-sm font-medium text-gray-900">{day}</span>
                        <div className="flex-1 flex flex-wrap gap-2">
                          {daySlots.map((slot) => (
                            <span key={slot.id} className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-sm">
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                              <button onClick={() => deleteSlot(slot.id)} className="text-teal-500 hover:text-red-600 transition-colors" title="Remove slot">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center mb-4">
                <p className="text-gray-500">No availability set yet. Add your first slot below.</p>
              </div>
            )}

            <form onSubmit={addSlot} className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add availability slot</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Day</label>
                  <select value={newSlot.dayOfWeek} onChange={(e) => setNewSlot((prev) => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                  <select value={newSlot.startTime} onChange={(e) => setNewSlot((prev) => ({ ...prev, startTime: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {TIME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                  <select value={newSlot.endTime} onChange={(e) => setNewSlot((prev) => ({ ...prev, endTime: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {TIME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
                  <select value={newSlot.timezone} onChange={(e) => setNewSlot((prev) => ({ ...prev, timezone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving || newSlot.startTime >= newSlot.endTime} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
                {saving ? "Adding..." : "Add Slot"}
              </button>
              {newSlot.startTime >= newSlot.endTime && (
                <span className="ml-3 text-sm text-red-600">End time must be after start time</span>
              )}
            </form>
          </div>
        )}
      </div>

      {/* ═══ Section C: Call Settings (Collapsible) ═══ */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900">Call Settings</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Buffer: {callBufferMinutes === 0 ? "None" : `${callBufferMinutes}min`}
              {maxCallsPerWeek !== null ? ` · Max ${maxCallsPerWeek}/week` : " · Unlimited"}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buffer between calls</label>
                <p className="text-xs text-gray-400 mb-2">Time blocked before and after each call</p>
                <select
                  value={callBufferMinutes}
                  onChange={(e) => setCallBufferMinutes(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {CALL_BUFFER_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 0 ? "No buffer" : `${mins} minutes`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max calls per week</label>
                <p className="text-xs text-gray-400 mb-2">Leave empty for unlimited</p>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxCallsPerWeek ?? ""}
                  onChange={(e) => setMaxCallsPerWeek(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Unlimited"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
