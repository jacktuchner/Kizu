"use client";

import { useState, useRef, useCallback } from "react";
import type { AvailabilitySlot, DateOverride, CalendarCall } from "./types";
import {
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  TIMELINE_HEIGHT,
  PIXELS_PER_HOUR,
  timeToPixels,
  durationToPixels,
  formatTime,
  parseDateLocal,
  DAYS_OF_WEEK,
  TIME_OPTIONS,
} from "./timelineUtils";

interface DayTimelineProps {
  dateStr: string;
  slots: AvailabilitySlot[];
  overrides: DateOverride[];
  calls: CalendarCall[];
  isBlocked: boolean;
  hasCustomHours: boolean;
  saving: boolean;
  onBlockDay: () => void;
  onAddCustomHours: (startTime: string, endTime: string, replaceId?: string) => void;
  onClearOverride: (id: string) => void;
  onUnblock: (id: string) => void;
}

const LABEL_WIDTH = "w-20"; // time label column

export default function DayTimeline({
  dateStr,
  slots,
  overrides,
  calls,
  isBlocked,
  hasCustomHours,
  saving,
  onBlockDay,
  onAddCustomHours,
  onClearOverride,
  onUnblock,
}: DayTimelineProps) {
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const [editing, setEditing] = useState<{ overrideId: string; start: string; end: string } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const date = parseDateLocal(dateStr);
  const dayOfWeek = date.getDay();
  const dateDisplay = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const customOverrides = overrides.filter((o) => !o.isBlocked && o.startTime);
  const availWindows: { start: string; end: string; type: "default" | "custom"; overrideId?: string }[] = [];

  if (isBlocked) {
    // blocked — no windows
  } else if (customOverrides.length > 0) {
    customOverrides.forEach((o) => {
      availWindows.push({ start: o.startTime!, end: o.endTime!, type: "custom", overrideId: o.id });
    });
  } else {
    const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    daySlots.forEach((s) => {
      availWindows.push({ start: s.startTime, end: s.endTime, type: "default" });
    });
  }

  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
    hours.push(h);
  }

  // Click-to-create
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isBlocked || draft || editing) return;
    const container = timelineRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const y = e.clientY - rect.top + scrollTop;

    const rawHour = TIMELINE_START_HOUR + y / PIXELS_PER_HOUR;
    const snappedHour = Math.max(TIMELINE_START_HOUR, Math.min(TIMELINE_END_HOUR - 1, Math.floor(rawHour)));

    const startH = snappedHour.toString().padStart(2, "0");
    const endH = (snappedHour + 1).toString().padStart(2, "0");
    setDraft({ start: `${startH}:00`, end: `${endH}:00` });
  }, [isBlocked, draft, editing]);

  function saveDraft() {
    if (!draft || draft.start >= draft.end) return;
    onAddCustomHours(draft.start, draft.end);
    setDraft(null);
  }

  function saveEdit() {
    if (!editing || editing.start >= editing.end) return;
    // Create new override, excluding the old one from overlap check, then delete old
    onAddCustomHours(editing.start, editing.end, editing.overrideId);
    setEditing(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900">{dateDisplay}</h3>
        <div className="flex items-center gap-2">
          {isBlocked && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">Blocked</span>
          )}
          {!isBlocked && hasCustomHours && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Custom hours</span>
          )}
          {!isBlocked && !hasCustomHours && availWindows.length > 0 && (
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
              {DAYS_OF_WEEK[dayOfWeek]} default
            </span>
          )}
        </div>
      </div>

      {!isBlocked && !draft && !editing && (
        <p className="text-sm text-gray-400 mb-4">Click on a time below to add custom hours</p>
      )}

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="relative overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/30"
        style={{ maxHeight: 540 }}
        onClick={handleTimelineClick}
      >
        <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
          {/* Hour grid lines + labels */}
          {hours.map((h) => {
            const top = (h - TIMELINE_START_HOUR) * PIXELS_PER_HOUR;
            const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
            return (
              <div key={h} className="absolute w-full" style={{ top }}>
                <div className="flex items-start">
                  <span className={`text-sm text-gray-400 ${LABEL_WIDTH} -mt-2.5 flex-shrink-0 text-right pr-4`}>
                    {label}
                  </span>
                  <div className="flex-1 border-t border-gray-200/70" />
                </div>
              </div>
            );
          })}

          {/* Blocked overlay */}
          {isBlocked && (
            <div
              className="absolute left-20 right-0 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center"
              style={{ top: 0, height: TIMELINE_HEIGHT }}
            >
              <span className="text-red-400 font-medium">Day blocked</span>
            </div>
          )}

          {/* Availability blocks */}
          {availWindows.map((w, i) => {
            const top = timeToPixels(w.start);
            const height = durationToPixels(w.start, w.end);
            const isCustom = w.type === "custom";
            const isEditing = editing && w.overrideId && editing.overrideId === w.overrideId;

            // If this block is being edited, show the edit UI instead
            if (isEditing) {
              return (
                <div
                  key={w.overrideId}
                  className="absolute left-20 right-2 bg-amber-100 border-2 border-amber-500 rounded-lg px-4 py-3 z-30 shadow-lg"
                  style={{
                    top: timeToPixels(editing.start),
                    height: Math.max(durationToPixels(editing.start, editing.end), 56),
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={editing.start}
                      onChange={(e) => setEditing((ed) => ed ? { ...ed, start: e.target.value } : ed)}
                      className="border border-amber-300 rounded-md px-2 py-1 text-sm bg-white font-medium"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <span className="text-sm text-amber-600 font-medium">to</span>
                    <select
                      value={editing.end}
                      onChange={(e) => setEditing((ed) => ed ? { ...ed, end: e.target.value } : ed)}
                      className="border border-amber-300 rounded-md px-2 py-1 text-sm bg-white font-medium"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={saveEdit}
                      disabled={saving || editing.start >= editing.end}
                      className="bg-amber-600 text-white px-4 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                  {editing.start >= editing.end && (
                    <p className="text-xs text-red-500 mt-1">End must be after start</p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={w.overrideId || i}
                className={`absolute left-20 right-2 rounded-lg border flex items-start justify-between group ${
                  isCustom
                    ? "bg-amber-50/90 border-amber-300 cursor-pointer hover:bg-amber-100/90"
                    : "bg-teal-50/90 border-teal-300"
                }`}
                style={{ top, height: Math.max(height, 28), padding: "6px 12px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCustom && w.overrideId) {
                    setEditing({ overrideId: w.overrideId, start: w.start, end: w.end });
                  }
                }}
              >
                <span className={`text-sm font-medium ${isCustom ? "text-amber-700" : "text-teal-700"}`}>
                  {formatTime(w.start)} - {formatTime(w.end)}
                  {isCustom && (
                    <span className="text-xs text-amber-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to edit
                    </span>
                  )}
                </span>
                {isCustom && w.overrideId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearOverride(w.overrideId!);
                    }}
                    className="text-amber-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5"
                    title="Remove override"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {/* Booked calls */}
          {calls.map((c) => {
            const callDate = new Date(
              c.scheduledAt.endsWith("Z") || c.scheduledAt.includes("+")
                ? c.scheduledAt
                : c.scheduledAt + "Z"
            );
            const callHH = callDate.getHours().toString().padStart(2, "0");
            const callMM = callDate.getMinutes().toString().padStart(2, "0");
            const callStartTime = `${callHH}:${callMM}`;
            const endMinutes = callDate.getHours() * 60 + callDate.getMinutes() + c.durationMinutes;
            const endHH = Math.floor(endMinutes / 60).toString().padStart(2, "0");
            const endMM = (endMinutes % 60).toString().padStart(2, "0");
            const callEndTime = `${endHH}:${endMM}`;

            const top = timeToPixels(callStartTime);
            const height = durationToPixels(callStartTime, callEndTime);

            return (
              <div
                key={c.id}
                className="absolute left-20 right-2 bg-blue-100 border border-blue-300 rounded-lg px-4 py-2 z-10"
                style={{ top, height: Math.max(height, 32) }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-semibold text-blue-800 block truncate">
                  {formatTime(callStartTime)} - {formatTime(callEndTime)}
                </span>
                <span className="text-sm text-blue-600 block truncate">
                  {c.seekerName} &middot; {c.durationMinutes} min
                  {c.status === "CONFIRMED" ? "" : " (Requested)"}
                </span>
              </div>
            );
          })}

          {/* Draft block (click-to-create) */}
          {draft && draft.start < draft.end && (
            <div
              className="absolute left-20 right-2 bg-teal-100 border-2 border-teal-500 rounded-lg px-4 py-3 z-30 shadow-lg"
              style={{
                top: timeToPixels(draft.start),
                height: Math.max(durationToPixels(draft.start, draft.end), 56),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={draft.start}
                  onChange={(e) => setDraft((d) => d ? { ...d, start: e.target.value } : d)}
                  className="border border-teal-300 rounded-md px-2 py-1 text-sm bg-white font-medium"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <span className="text-sm text-teal-600 font-medium">to</span>
                <select
                  value={draft.end}
                  onChange={(e) => setDraft((d) => d ? { ...d, end: e.target.value } : d)}
                  className="border border-teal-300 rounded-md px-2 py-1 text-sm bg-white font-medium"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={saveDraft}
                  disabled={saving || draft.start >= draft.end}
                  className="bg-teal-600 text-white px-4 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancel
                </button>
              </div>
              {draft.start >= draft.end && (
                <p className="text-xs text-red-500 mt-1">End must be after start</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions bar — only Block Day / Unblock */}
      <div className="mt-4 flex flex-wrap gap-3">
        {isBlocked ? (
          overrides.filter((o) => o.isBlocked).map((o) => (
            <button
              key={o.id}
              onClick={() => onUnblock(o.id)}
              className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Unblock this day
            </button>
          ))
        ) : (
          <button
            onClick={onBlockDay}
            disabled={saving}
            className="text-sm bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 font-medium"
          >
            Block Day
          </button>
        )}
      </div>
    </div>
  );
}
