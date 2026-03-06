"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { AvailabilitySlot, DateOverride, CalendarCall } from "./availability/types";
import {
  formatTime,
  toDateStr,
  parseDateLocal,
  DAYS_OF_WEEK,
  SHORT_DAYS,
  MONTH_NAMES,
} from "./availability/timelineUtils";

/* ─── 30-minute time options from 12:00 AM to 11:30 PM ─── */
const TIME_30: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    TIME_30.push({ value, label: `${h12}:${m.toString().padStart(2, "0")} ${ampm}` });
  }
}

const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60];

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

  // Settings saving state
  const [savingSettings, setSavingSettings] = useState(false);

  // Copy-to popover
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);

  // Custom hours form state for calendar side panel
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("17:00");

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

  async function addSlotForDay(dayOfWeek: number, startTime: string, endTime: string) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, startTime, endTime, timezone: "America/New_York" }),
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

  async function copyDaySlots(fromDay: number, toDays: number[]) {
    const sourceSlots = slotsByDay[fromDay] || [];
    if (sourceSlots.length === 0) return;

    setError("");
    setSaving(true);
    try {
      for (const toDay of toDays) {
        const existing = slotsByDay[toDay] || [];
        for (const s of existing) {
          await fetch(`/api/availability?id=${s.id}`, { method: "DELETE" });
        }
        for (const s of sourceSlots) {
          await fetch("/api/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayOfWeek: toDay,
              startTime: s.startTime,
              endTime: s.endTime,
              timezone: s.timezone,
            }),
          });
        }
      }
      await loadCalendarData();
      setSuccess("Availability copied");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy slots");
    } finally {
      setSaving(false);
      setCopyFromDay(null);
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

  // Build cell background class based on day status (priority: blocked > booked > custom > default)
  function cellBgClass(info: ReturnType<typeof getDayInfo>): string {
    if (info.isPast) return "bg-white";
    if (info.isBlocked) return "bg-red-50";
    if (info.dayCalls.length > 0) return "bg-blue-50";
    if (info.hasCustomHours) return "bg-amber-50";
    if (info.hasDefault) return "bg-teal-50/60";
    return "bg-white";
  }

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
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">{success}</div>
      )}

      {/* ═══ Section A: Weekly Hours Grid ═══ */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Weekly Hours</h2>
          <p className="text-sm text-gray-500 mt-1">
            Set your recurring weekly availability for calls.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {DAYS_OF_WEEK.map((dayName, dayIndex) => {
            const daySlots = slotsByDay[dayIndex] || [];
            const isEnabled = daySlots.length > 0;

            return (
              <div key={dayName} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  {/* Toggle */}
                  <button
                    onClick={async () => {
                      if (isEnabled) {
                        for (const s of daySlots) {
                          await deleteSlot(s.id);
                        }
                      } else {
                        await addSlotForDay(dayIndex, "09:00", "17:00");
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                      isEnabled ? "bg-teal-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Day name */}
                  <span className={`w-10 text-sm font-semibold mt-1 ${isEnabled ? "text-gray-900" : "text-gray-400"}`}>
                    {SHORT_DAYS[dayIndex]}
                  </span>

                  {/* Time ranges or unavailable */}
                  {isEnabled ? (
                    <div className="flex-1 space-y-2">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2 flex-wrap">
                          <TimeSelect
                            value={slot.startTime}
                            onChange={async (newStart) => {
                              if (newStart < slot.endTime) {
                                await deleteSlot(slot.id);
                                await addSlotForDay(dayIndex, newStart, slot.endTime);
                              }
                            }}
                          />

                          <span className="text-gray-400 text-sm">—</span>

                          <TimeSelect
                            value={slot.endTime}
                            onChange={async (newEnd) => {
                              if (slot.startTime < newEnd) {
                                await deleteSlot(slot.id);
                                await addSlotForDay(dayIndex, slot.startTime, newEnd);
                              }
                            }}
                          />

                          {/* Delete this range */}
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {/* Add + Copy row */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() => {
                            const lastSlot = daySlots[daySlots.length - 1];
                            let startMins = 9 * 60; // default 9:00 AM
                            if (lastSlot) {
                              const [eh, em] = lastSlot.endTime.split(":").map(Number);
                              // End time + buffer, then snap up to next 30-min increment
                              const afterBuffer = eh * 60 + em + callBufferMinutes;
                              startMins = Math.ceil(afterBuffer / 30) * 30;
                            }
                            const endMins = Math.min(startMins + 60, 23 * 60 + 30);
                            if (startMins >= endMins || startMins >= 24 * 60) return;
                            const newStart = `${Math.floor(startMins / 60).toString().padStart(2, "0")}:${(startMins % 60).toString().padStart(2, "0")}`;
                            const newEnd = `${Math.floor(endMins / 60).toString().padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`;
                            addSlotForDay(dayIndex, newStart, newEnd);
                          }}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add
                        </button>

                        <span className="text-gray-200">|</span>

                        {/* Copy button */}
                        <div className="relative">
                          <button
                            onClick={() => setCopyFromDay(copyFromDay === dayIndex ? null : dayIndex)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-teal-600 transition-colors"
                            title="Copy to other days"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </button>

                          {copyFromDay === dayIndex && (
                            <CopyPopover
                              fromDay={dayIndex}
                              onCopy={(toDays) => copyDaySlots(dayIndex, toDays)}
                              onClose={() => setCopyFromDay(null)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 mt-1">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Section B: Calendar + Day Detail Panel ═══ */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Calendar</h2>
              <p className="text-sm text-gray-500 mt-1">Click a date to view details and manage overrides.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCalendarMonth((prev) => {
                    const d = new Date(prev.year, prev.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  });
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-bold text-gray-800 min-w-[160px] text-center">
                {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
              </span>
              <button
                onClick={() => {
                  setCalendarMonth((prev) => {
                    const d = new Date(prev.year, prev.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  });
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Calendar grid */}
          <div className={`${selectedDate ? "flex-1 min-w-0" : "w-full"} p-5 transition-all`}>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded bg-teal-50 border border-teal-200"></span>
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded bg-blue-50 border border-blue-200"></span>
                Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded bg-amber-50 border border-amber-200"></span>
                Custom
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded bg-red-50 border border-red-200"></span>
                Blocked
              </span>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              {SHORT_DAYS.map((d) => (
                <div key={d} className="bg-gray-50 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {d}
                </div>
              ))}

              {/* Day cells */}
              {calendarDays.map((dateStr, i) => {
                if (!dateStr) {
                  return <div key={`pad-${i}`} className="bg-white p-2 min-h-[72px]" />;
                }

                const info = getDayInfo(dateStr);
                const dayNum = parseDateLocal(dateStr).getDate();
                const isSelected = selectedDate === dateStr;
                const bg = cellBgClass(info);

                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      if (!info.isPast) {
                        setSelectedDate(isSelected ? null : dateStr);
                        setShowCustomForm(false);
                      }
                    }}
                    disabled={info.isPast}
                    className={`${bg} p-2 min-h-[72px] text-left transition-all relative ${
                      info.isPast
                        ? "text-gray-300 cursor-default"
                        : isSelected
                        ? "ring-2 ring-teal-500 ring-inset z-10"
                        : info.isToday
                        ? "ring-2 ring-blue-400 ring-inset"
                        : "hover:brightness-95 cursor-pointer"
                    }`}
                  >
                    {info.isToday && !info.isPast ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                        {dayNum}
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold ${info.isPast ? "text-gray-300" : "text-gray-700"}`}>
                        {dayNum}
                      </span>
                    )}

                    {/* Small count badge for calls */}
                    {info.dayCalls.length > 0 && !info.isPast && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                        {info.dayCalls.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Day Detail Side Panel ── */}
          {selectedDate && selectedDayInfo && (
            <div className="w-80 border-l border-gray-200 p-5 overflow-y-auto scrollbar-hide max-h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">
                  {parseDateLocal(selectedDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status badge */}
              <div className="mb-5">
                {selectedDayInfo.isBlocked ? (
                  <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                    Blocked
                  </span>
                ) : selectedDayInfo.hasCustomHours ? (
                  <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    Custom hours
                  </span>
                ) : selectedDayInfo.hasDefault ? (
                  <span className="inline-flex items-center text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                    {DAYS_OF_WEEK[selectedDayInfo.dayOfWeek]} default
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                    No availability
                  </span>
                )}
              </div>

              {/* Availability windows */}
              {!selectedDayInfo.isBlocked && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hours</p>
                  {(() => {
                    const customOverrides = selectedDayInfo.dateOverrides.filter((o) => !o.isBlocked && o.startTime);
                    if (customOverrides.length > 0) {
                      return (
                        <div className="space-y-1.5">
                          {customOverrides.map((o) => (
                            <div key={o.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                              <span className="text-sm font-medium text-amber-800">
                                {formatTime(o.startTime!)} – {formatTime(o.endTime!)}
                              </span>
                              <button
                                onClick={() => deleteOverride(o.id)}
                                className="text-amber-400 hover:text-red-500 transition-colors"
                                title="Remove override"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    const daySlots = slots.filter((s) => s.dayOfWeek === selectedDayInfo.dayOfWeek);
                    if (daySlots.length > 0) {
                      return (
                        <div className="space-y-1.5">
                          {daySlots.map((s) => (
                            <div key={s.id} className="bg-teal-50 rounded-lg px-3 py-2 border border-teal-100">
                              <span className="text-sm font-medium text-teal-800">
                                {formatTime(s.startTime)} – {formatTime(s.endTime)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return <p className="text-sm text-gray-400">None</p>;
                  })()}
                </div>
              )}

              {/* Booked calls */}
              {selectedDayInfo.dayCalls.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Booked Calls ({selectedDayInfo.dayCalls.length})
                  </p>
                  <div className="space-y-2">
                    {selectedDayInfo.dayCalls.map((call) => {
                      const callDate = new Date(
                        call.scheduledAt.endsWith("Z") || call.scheduledAt.includes("+")
                          ? call.scheduledAt
                          : call.scheduledAt + "Z"
                      );
                      const callHH = callDate.getHours().toString().padStart(2, "0");
                      const callMM = callDate.getMinutes().toString().padStart(2, "0");
                      const callStartTime = `${callHH}:${callMM}`;
                      const endMins = callDate.getHours() * 60 + callDate.getMinutes() + call.durationMinutes;
                      const endHH = Math.floor(endMins / 60).toString().padStart(2, "0");
                      const endMM = (endMins % 60).toString().padStart(2, "0");
                      const callEndTime = `${endHH}:${endMM}`;

                      const statusColor = call.status === "CONFIRMED"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : call.status === "COMPLETED"
                        ? "bg-gray-50 text-gray-600 border-gray-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";

                      return (
                        <div key={call.id} className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{call.seekerName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatTime(callStartTime)} – {formatTime(callEndTime)} · {call.durationMinutes}min
                              </p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor}`}>
                              {call.status === "CONFIRMED" ? "Confirmed" : call.status === "COMPLETED" ? "Done" : "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                {selectedDayInfo.isBlocked ? (
                  selectedDayInfo.dateOverrides.filter((o) => o.isBlocked).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => deleteOverride(o.id)}
                      className="w-full text-sm bg-white border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                    >
                      Unblock this day
                    </button>
                  ))
                ) : (
                  <>
                    {showCustomForm ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {selectedDayInfo.hasCustomHours ? "Add Window" : "Custom Hours"}
                        </p>
                        <div className="flex items-center gap-2">
                          <TimeSelect value={customStart} onChange={setCustomStart} />
                          <span className="text-gray-400 text-sm">—</span>
                          <TimeSelect value={customEnd} onChange={setCustomEnd} />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              if (customStart && customEnd && customStart < customEnd) {
                                await createOverride(selectedDate, false, customStart, customEnd);
                                setShowCustomForm(false);
                              }
                            }}
                            disabled={saving || !customStart || !customEnd || customStart >= customEnd}
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setShowCustomForm(false)}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const existingOverrides = selectedDayInfo.dateOverrides.filter((o) => !o.isBlocked && o.endTime);
                          if (existingOverrides.length > 0) {
                            // Start after the last override's end + buffer, snapped to 30-min
                            const lastEnd = existingOverrides[existingOverrides.length - 1].endTime!;
                            const [eh, em] = lastEnd.split(":").map(Number);
                            const afterBuffer = eh * 60 + em + callBufferMinutes;
                            const startMins = Math.ceil(afterBuffer / 30) * 30;
                            const endMins = Math.min(startMins + 60, 23 * 60 + 30);
                            setCustomStart(`${Math.floor(startMins / 60).toString().padStart(2, "0")}:${(startMins % 60).toString().padStart(2, "0")}`);
                            setCustomEnd(`${Math.floor(endMins / 60).toString().padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`);
                          } else {
                            setCustomStart("09:00");
                            setCustomEnd("17:00");
                          }
                          setShowCustomForm(true);
                        }}
                        disabled={saving}
                        className="w-full text-sm bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-lg hover:bg-amber-100 font-medium transition-colors disabled:opacity-50"
                      >
                        {selectedDayInfo.hasCustomHours ? "Add Hours" : "Set Custom Hours"}
                      </button>
                    )}
                    <button
                      onClick={() => createOverride(selectedDate, true)}
                      disabled={saving}
                      className="w-full text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-lg hover:bg-red-100 font-medium transition-colors disabled:opacity-50"
                    >
                      Block Day
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Section C: Call Settings ═══ */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Call Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure buffer time and scheduling limits.</p>
        </div>
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Buffer time */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buffer between calls</label>
              <select
                value={callBufferMinutes}
                onChange={(e) => setCallBufferMinutes(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white appearance-none"
              >
                {BUFFER_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "No buffer" : `${m} minutes`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Minimum gap between consecutive calls.</p>
            </div>

            {/* Max calls per week */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Max calls per week</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxCallsPerWeek ?? ""}
                onChange={(e) => setMaxCallsPerWeek(e.target.value ? Number(e.target.value) : null)}
                placeholder="No limit"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty for unlimited.</p>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CopyPopover: pick which days to copy slots to ─── */

function CopyPopover({
  fromDay,
  onCopy,
  onClose,
}: {
  fromDay: number;
  onCopy: (toDays: number[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (day: number) => {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg p-3 z-20 min-w-[180px]">
      <p className="text-xs font-medium text-gray-500 mb-2">Copy to:</p>
      <div className="space-y-1">
        {SHORT_DAYS.map((day, i) => {
          if (i === fromDay) return null;
          return (
            <label key={day} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1">
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={() => toggle(i)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              {day}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
        <button
          onClick={() => {
            if (selected.length > 0) onCopy(selected);
          }}
          disabled={selected.length === 0}
          className="flex-1 bg-teal-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-xs font-medium py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── TimeSelect: custom dropdown for 30-min time increments ─── */

function TimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll selected option into view when opened
  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector("[data-selected]") as HTMLElement | null;
      if (el) {
        // Position selected near the top of the list with a small offset
        listRef.current.scrollTop = el.offsetTop - 8;
      }
    }
  }, [open]);

  const selected = TIME_30.find((t) => t.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-teal-400 focus:outline-none focus:border-teal-400 w-[130px]"
      >
        <span>{selected?.label ?? formatTime(value)}</span>
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div ref={listRef} className="absolute z-50 mt-1 w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto scrollbar-hide">
          {TIME_30.map((t) => (
            <div
              key={t.value}
              data-selected={t.value === value ? "" : undefined}
              onClick={() => { onChange(t.value); setOpen(false); }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 ${
                t.value === value ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-700"
              }`}
            >
              {t.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
