"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Video, Globe, User } from "lucide-react";
import { parseDate } from "@/lib/dates";

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface BookedCall {
  start: string;
  end: string;
}

interface DateOverrideData {
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
}

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  booked?: boolean;
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const hh = Math.floor(totalMins / 60).toString().padStart(2, "0");
  const mm = (totalMins % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatSlotRange(startTime: string, endTime: string): string {
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function parseDateLocal(dateStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function getTimezoneLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

function getTimezoneLongLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function BookCallPage() {
  const { guideId } = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [guide, setGuide] = useState<any>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [bookedCalls, setBookedCalls] = useState<BookedCall[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverrideData[]>([]);
  const [callBufferMinutes, setCallBufferMinutes] = useState(15);
  const [maxCallsPerWeek, setMaxCallsPerWeek] = useState<number | null>(null);
  const [callCountByWeek, setCallCountByWeek] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [duration, setDuration] = useState(30);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [questionsInAdvance, setQuestionsInAdvance] = useState("");

  // Week navigation: startDate is the first visible day
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const day = now.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    now.setDate(now.getDate() + diff);
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // Mobile: single day view
  const [mobileDate, setMobileDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateStr(tomorrow);
  });
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);

  // Timezone
  const [userTimezone, setUserTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "America/New_York";
    }
  });
  const [showTzPicker, setShowTzPicker] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    async function load() {
      try {
        const [guideRes, availRes] = await Promise.all([
          fetch(`/api/guides/${guideId}`),
          fetch(`/api/guides/${guideId}/availability`),
        ]);
        if (guideRes.ok) setGuide(await guideRes.json());
        if (availRes.ok) {
          const availData = await availRes.json();
          setAvailability(availData.slots || []);
          setBookedCalls(availData.bookedCalls || []);
          setBlockedDates(availData.blockedDates || []);
          setDateOverrides(availData.dateOverrides || []);
          setCallBufferMinutes(availData.callBufferMinutes ?? 15);
          setMaxCallsPerWeek(availData.maxCallsPerWeek ?? null);
          setCallCountByWeek(availData.callCountByWeek || {});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [guideId]);

  const availabilityByDay = useMemo(() => {
    const grouped: Record<number, AvailabilitySlot[]> = {};
    availability.forEach((slot) => {
      if (!grouped[slot.dayOfWeek]) grouped[slot.dayOfWeek] = [];
      grouped[slot.dayOfWeek].push(slot);
    });
    return grouped;
  }, [availability]);

  const overridesByDate = useMemo(() => {
    const grouped: Record<string, DateOverrideData[]> = {};
    dateOverrides.forEach((o) => {
      if (!grouped[o.date]) grouped[o.date] = [];
      grouped[o.date].push(o);
    });
    return grouped;
  }, [dateOverrides]);

  function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
  }

  const allSlots = useMemo(() => {
    if (availability.length === 0 && dateOverrides.length === 0) return [];

    const slots: TimeSlot[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    for (let d = 0; d < 60; d++) {
      const date = new Date(tomorrow);
      date.setDate(date.getDate() + d);
      const dayOfWeek = date.getDay();
      const dateStr = toDateStr(date);

      if (maxCallsPerWeek !== null) {
        const week = getISOWeek(dateStr);
        if ((callCountByWeek[week] || 0) >= maxCallsPerWeek) continue;
      }

      const dayOverrides = overridesByDate[dateStr];
      if (dayOverrides) {
        if (dayOverrides.some((o) => o.isBlocked)) continue;
        const customWindows = dayOverrides.filter((o) => !o.isBlocked && o.startTime && o.endTime);
        if (customWindows.length > 0) {
          for (const ov of customWindows) {
            generateSlotsForWindow(ov.startTime!, ov.endTime!, dateStr, slots);
          }
          continue;
        }
      }

      if (blockedDates.includes(dateStr)) continue;

      const daySlots = availabilityByDay[dayOfWeek];
      if (!daySlots || daySlots.length === 0) continue;

      for (const avail of daySlots) {
        generateSlotsForWindow(avail.startTime, avail.endTime, dateStr, slots);
      }
    }

    function generateSlotsForWindow(windowStart: string, windowEnd: string, dateStr: string, slots: TimeSlot[]) {
      const [sh, sm] = windowStart.split(":").map(Number);
      const [eh, em] = windowEnd.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      for (let m = startMins; m + duration <= endMins; m += 15) {
        const startHH = Math.floor(m / 60).toString().padStart(2, "0");
        const startMM = (m % 60).toString().padStart(2, "0");
        const startTime = `${startHH}:${startMM}`;
        const endTime = addMinutesToTime(startTime, duration);

        const slotStartMs = new Date(`${dateStr}T${startTime}:00`).getTime();
        const slotEndMs = slotStartMs + duration * 60000;
        const bufferMs = callBufferMinutes * 60000;

        const overlaps = bookedCalls.some((call) => {
          const callStart = parseDate(call.start).getTime() - bufferMs;
          const callEnd = parseDate(call.end).getTime() + bufferMs;
          return slotStartMs < callEnd && slotEndMs > callStart;
        });

        slots.push({ date: dateStr, startTime, endTime, label: formatSlotRange(startTime, endTime), booked: overlaps });
      }
    }

    return slots;
  }, [availability, availabilityByDay, bookedCalls, blockedDates, dateOverrides, overridesByDate, duration, callBufferMinutes, maxCallsPerWeek, callCountByWeek]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    allSlots.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [allSlots]);

  const datesWithFreeSlots = useMemo(() => {
    const dates = new Set<string>();
    allSlots.forEach((s) => { if (!s.booked) dates.add(s.date); });
    return dates;
  }, [allSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [duration]);

  // Desktop: scan from weekStart and pick exactly 4 days that have free slots
  const VISIBLE_DAYS = 4;
  const SCAN_RANGE = 30;
  const visibleDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < SCAN_RANGE && dates.length < VISIBLE_DAYS; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const ds = toDateStr(d);
      const daySlots = (slotsByDate[ds] || []).filter((s) => !s.booked);
      if (daySlots.length > 0) {
        dates.push(ds);
      }
    }
    return dates;
  }, [weekStart, slotsByDate]);

  // Header label — cross-month display (e.g. "March – April 2026")
  const headerLabel = useMemo(() => {
    if (visibleDates.length === 0) {
      return weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    const firstDate = parseDateLocal(visibleDates[0]);
    const lastDate = parseDateLocal(visibleDates[visibleDates.length - 1]);
    const firstMonth = firstDate.toLocaleDateString("en-US", { month: "long" });
    const lastMonth = lastDate.toLocaleDateString("en-US", { month: "long" });
    const year = lastDate.getFullYear();
    if (firstDate.getMonth() === lastDate.getMonth()) {
      return `${firstMonth} ${year}`;
    }
    if (firstDate.getFullYear() !== lastDate.getFullYear()) {
      return `${firstMonth} ${firstDate.getFullYear()} – ${lastMonth} ${year}`;
    }
    return `${firstMonth} – ${lastMonth} ${year}`;
  }, [visibleDates, weekStart]);

  function navigateWeek(direction: number) {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * VISIBLE_DAYS);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (next < tomorrow) return prev;
      return next;
    });
    setSelectedSlot(null);
  }

  function navigateMobileDate(direction: number) {
    const current = parseDateLocal(mobileDate);
    current.setDate(current.getDate() + direction);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (current < tomorrow) return;
    setMobileDate(toDateStr(current));
    setSelectedSlot(null);
  }

  // Auto-navigate to first date with free slots
  useEffect(() => {
    if (!loading && datesWithFreeSlots.size > 0) {
      const sorted = Array.from(datesWithFreeSlots).sort();
      if (sorted[0]) {
        const firstFreeDate = parseDateLocal(sorted[0]);
        setWeekStart(new Date(firstFreeDate));
        setMobileDate(sorted[0]);
      }
    }
  }, [loading, datesWithFreeSlots]);

  const hasAvailability = availability.length > 0 || dateOverrides.length > 0;

  async function handleBook() {
    if (!selectedSlot) return;
    setBooking(true);
    setError(null);

    try {
      const scheduledAt = new Date(`${selectedSlot.date}T${selectedSlot.startTime}`).toISOString();

      const res = await fetch("/api/checkout/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributorId: guideId,
          scheduledAt,
          durationMinutes: duration,
          questionsInAdvance: questionsInAdvance || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create checkout session");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const userRole = (session?.user as any)?.role;
  const isGuideOnly = userRole === "GUIDE";

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-gray-400">Loading...</div>;
  if (!guide) return <div className="max-w-5xl mx-auto px-4 py-12 text-gray-400">Guide not found.</div>;

  if (isGuideOnly) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/guides" className="text-sm text-teal-600 hover:text-teal-700 mb-4 inline-block">
          &larr; Back to Guides
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Want to book a session?</h2>
          <p className="text-gray-600 mb-6">
            Add a health profile so we can match you with the right guide.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/user/upgrade-role", { method: "POST" });
                const data = await res.json();
                window.location.href = data.redirect || "/dashboard/seeker";
              } catch {
                window.location.href = "/dashboard/seeker";
              }
            }}
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-medium transition-colors"
          >
            Set Up Health Profile
          </button>
        </div>
      </div>
    );
  }

  const rate = guide.profile?.hourlyRate || 50;
  const price = duration === 60 ? rate : rate / 2;
  const procedures: string[] = guide.profile?.procedureTypes?.length > 0
    ? guide.profile.procedureTypes
    : (guide.profile?.procedureType ? [guide.profile.procedureType] : []);

  const mobileDateSlots = slotsByDate[mobileDate] || [];
  const mobileDateObj = parseDateLocal(mobileDate);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/guides" className="text-sm text-teal-600 hover:text-teal-700 mb-8 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" />
        Back to Guides
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Left Sidebar ── */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-7 sticky top-8">
            {/* Guide avatar */}
            <Link href={`/guides/${guideId}?from=booking`} className="block group">
              <div className="mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ring-4 ring-gray-100">
                {guide.image ? (
                  <img src={guide.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <h2 className="text-lg font-bold text-center text-gray-900 group-hover:text-teal-700 transition-colors">
                {guide.name}
              </h2>
            </Link>

            {procedures.length > 0 && (
              <p className="text-sm text-gray-500 text-center mt-1.5 leading-relaxed">
                {procedures.join(", ")}
              </p>
            )}

            {/* Meta details */}
            <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{duration} min video call</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>Daily.co video room</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-900">
                <span className="w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0 text-base">$</span>
                <span>${price.toFixed(0)}</span>
              </div>
            </div>

            {/* Duration toggle */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Duration</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDuration(30)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                    duration === 30
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                  }`}
                >
                  30 min
                </button>
                <button
                  type="button"
                  onClick={() => setDuration(60)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                    duration === 60
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                  }`}
                >
                  60 min
                </button>
              </div>
            </div>

            {/* Questions */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Questions for guide
              </label>
              <textarea
                value={questionsInAdvance}
                onChange={(e) => setQuestionsInAdvance(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 placeholder:text-gray-400"
                rows={3}
                placeholder="Anything you'd like to discuss..."
              />
            </div>
          </div>
        </div>

        {/* ── Main: Time Slot Grid ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {!hasAvailability ? (
              <div className="p-16 text-center">
                <p className="text-gray-400">This guide hasn&apos;t set up their availability yet.</p>
              </div>
            ) : (
              <>
                {/* ── Desktop: Multi-column view ── */}
                <div className="hidden md:block">
                  {/* Week navigation header */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <button
                      onClick={() => navigateWeek(-1)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-gray-700">
                      {headerLabel}
                    </span>
                    <button
                      onClick={() => navigateWeek(1)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {visibleDates.length === 0 ? (
                    <div className="p-16 text-center">
                      <p className="text-sm text-gray-400">No available slots this week. Try navigating forward.</p>
                    </div>
                  ) : (
                    <>
                      {/* Column headers — only days with slots */}
                      <div className="grid grid-cols-4 border-b border-gray-100">
                        {visibleDates.map((dateStr) => {
                          const d = parseDateLocal(dateStr);
                          return (
                            <div key={dateStr} className="text-center py-4 border-r border-gray-100 last:border-r-0">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                {SHORT_DAYS[d.getDay()]}
                              </p>
                              <p className="text-xl font-bold text-gray-900 mt-0.5">
                                {d.getDate()}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {d.toLocaleDateString("en-US", { month: "short" })}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Slot columns — hidden scrollbar */}
                      <div className={`grid grid-cols-4`}>
                        {visibleDates.map((dateStr) => {
                          const daySlots = (slotsByDate[dateStr] || []).filter((s) => !s.booked);
                          return (
                            <div
                              key={dateStr}
                              className="border-r border-gray-100 last:border-r-0 p-3 space-y-2 overflow-y-auto max-h-[420px]"
                            >
                              {daySlots.map((slot) => {
                                const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                                return (
                                  <div key={`${slot.date}-${slot.startTime}`}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSlot(isSelected ? null : slot)}
                                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                        isSelected
                                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                          : "bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
                                      }`}
                                    >
                                      {formatTime12(slot.startTime)}
                                    </button>
                                    {isSelected && (
                                      <button
                                        onClick={handleBook}
                                        disabled={booking}
                                        className="w-full mt-1.5 py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                      >
                                        {booking ? "Processing..." : `Confirm · $${price.toFixed(0)}`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* ── Mobile: Single day view ── */}
                <div className="md:hidden">
                  <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button
                      onClick={() => navigateMobileDate(-1)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowMobileDatePicker(!showMobileDatePicker)}
                      className="text-center"
                    >
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {SHORT_DAYS[mobileDateObj.getDay()]}
                      </p>
                      <p className="text-xl font-bold text-gray-900 mt-0.5">
                        {mobileDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </button>
                    <button
                      onClick={() => navigateMobileDate(1)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {showMobileDatePicker && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <input
                        type="date"
                        value={mobileDate}
                        onChange={(e) => {
                          setMobileDate(e.target.value);
                          setShowMobileDatePicker(false);
                          setSelectedSlot(null);
                        }}
                        min={toDateStr((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })())}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-2 min-h-[300px]">
                    {mobileDateSlots.filter((s) => !s.booked).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center pt-16">No available slots on this date</p>
                    ) : (
                      mobileDateSlots.filter((s) => !s.booked).map((slot) => {
                        const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                        return (
                          <div key={`${slot.date}-${slot.startTime}`}>
                            <button
                              type="button"
                              onClick={() => setSelectedSlot(isSelected ? null : slot)}
                              className={`w-full py-3 rounded-lg text-sm font-medium transition-all border ${
                                isSelected
                                  ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:bg-teal-50"
                              }`}
                            >
                              {formatTime12(slot.startTime)}
                            </button>
                            {isSelected && (
                              <button
                                onClick={handleBook}
                                disabled={booking}
                                className="w-full mt-2 py-3 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                              >
                                {booking ? "Processing..." : `Confirm · $${price.toFixed(0)}`}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Timezone selector */}
                <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2.5 text-xs text-gray-500">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  {showTzPicker ? (
                    <select
                      value={userTimezone}
                      onChange={(e) => { setUserTimezone(e.target.value); setShowTzPicker(false); }}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 bg-white"
                      autoFocus
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{getTimezoneLongLabel(tz)} ({getTimezoneLabel(tz)})</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <span>{getTimezoneLongLabel(userTimezone)}</span>
                      <button
                        onClick={() => setShowTzPicker(true)}
                        className="text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Change
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mt-4 text-center space-y-1.5">
            <p className="text-xs text-gray-400">
              You will be redirected to Stripe to complete payment securely.
            </p>
            <p className="text-xs text-amber-600">
              Cancellations less than 24 hours before the call are non-refundable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
