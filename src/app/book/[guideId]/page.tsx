"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const hh = Math.floor(totalMins / 60).toString().padStart(2, "0");
  const mm = (totalMins % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatSlotRange(startTime: string, endTime: string): string {
  const [sh] = startTime.split(":").map(Number);
  const [eh] = endTime.split(":").map(Number);
  const startAmpm = sh >= 12 ? "PM" : "AM";
  const endAmpm = eh >= 12 ? "PM" : "AM";
  const startH12 = sh % 12 || 12;
  const endH12 = eh % 12 || 12;
  const startMin = startTime.split(":")[1];
  const endMin = endTime.split(":")[1];

  if (startAmpm === endAmpm) {
    return `${startH12}:${startMin} - ${endH12}:${endMin} ${endAmpm}`;
  }
  return `${startH12}:${startMin} ${startAmpm} - ${endH12}:${endMin} ${endAmpm}`;
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
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || tz;
  } catch {
    return tz;
  }
}

function getTimezoneLongLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || tz;
  } catch {
    return tz;
  }
}

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

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Timezone
  const [userTimezone, setUserTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "America/New_York";
    }
  });
  const [showTzPicker, setShowTzPicker] = useState(false);

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

  // Group availability by day of week
  const availabilityByDay = useMemo(() => {
    const grouped: Record<number, AvailabilitySlot[]> = {};
    availability.forEach((slot) => {
      if (!grouped[slot.dayOfWeek]) grouped[slot.dayOfWeek] = [];
      grouped[slot.dayOfWeek].push(slot);
    });
    return grouped;
  }, [availability]);

  // Group date overrides by date
  const overridesByDate = useMemo(() => {
    const grouped: Record<string, DateOverrideData[]> = {};
    dateOverrides.forEach((o) => {
      if (!grouped[o.date]) grouped[o.date] = [];
      grouped[o.date].push(o);
    });
    return grouped;
  }, [dateOverrides]);

  // ISO week helper
  function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
  }

  // Generate all available slots for the next 60 days
  const allSlots = useMemo(() => {
    if (availability.length === 0 && dateOverrides.length === 0) return [];

    const slots: (TimeSlot & { date: string })[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    for (let d = 0; d < 60; d++) {
      const date = new Date(tomorrow);
      date.setDate(date.getDate() + d);
      const dayOfWeek = date.getDay();
      const dateStr = toDateStr(date);

      // Check weekly cap
      if (maxCallsPerWeek !== null) {
        const week = getISOWeek(dateStr);
        if ((callCountByWeek[week] || 0) >= maxCallsPerWeek) continue;
      }

      // Check date overrides
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

        slots.push({
          date: dateStr,
          startTime,
          endTime,
          label: formatSlotRange(startTime, endTime),
          booked: overlaps,
        });
      }
    }

    return slots;
  }, [availability, availabilityByDay, bookedCalls, blockedDates, dateOverrides, overridesByDate, duration, callBufferMinutes, maxCallsPerWeek, callCountByWeek]);

  // Set of dates that have any slots (available or booked)
  const datesWithSlots = useMemo(() => {
    const dates = new Set<string>();
    allSlots.forEach((s) => dates.add(s.date));
    return dates;
  }, [allSlots]);

  // Set of dates that have at least one free (non-booked) slot
  const datesWithFreeSlots = useMemo(() => {
    const dates = new Set<string>();
    allSlots.forEach((s) => { if (!s.booked) dates.add(s.date); });
    return dates;
  }, [allSlots]);

  // Slots for the selected date (both available and booked)
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return allSlots.filter((s) => s.date === selectedDate);
  }, [allSlots, selectedDate]);

  // Auto-select first date with a free slot
  useEffect(() => {
    if (!loading && datesWithFreeSlots.size > 0 && !selectedDate) {
      const sorted = Array.from(datesWithFreeSlots).sort();
      if (sorted[0]) setSelectedDate(sorted[0]);
    }
  }, [loading, datesWithFreeSlots, selectedDate]);

  // Calendar grid days
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

  // Clear slot selection when duration or date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [duration]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

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

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8">Loading...</div>;
  if (!guide) return <div className="max-w-3xl mx-auto px-4 py-8">Guide not found.</div>;

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

  const selectedDateObj = selectedDate ? parseDateLocal(selectedDate) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/guides" className="text-sm text-teal-600 hover:text-teal-700 mb-4 inline-block">
        &larr; Back to Guides
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-1">Book a Call</h1>
        <p className="text-gray-500 mb-6">Schedule a 1-on-1 video call with {guide.name}</p>

        {/* Guide card — clickable to profile */}
        <Link href={`/guides/${guideId}?from=booking`} className="block bg-gray-50 rounded-lg p-4 mb-6 flex items-center gap-3 hover:bg-gray-100 transition-colors group">
          <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-700 font-semibold text-lg">
              {guide.name?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold group-hover:text-teal-700 transition-colors">{guide.name}</p>
            <p className="text-sm text-gray-500">
              {guide.profile?.procedureType} &middot; {guide.profile?.ageRange} &middot; {guide.profile?.timeSinceSurgery} post-op
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Duration picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setDuration(30)}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                duration === 30 ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <p className="font-semibold">30 minutes</p>
              <p className="text-sm text-gray-500">${(rate / 2).toFixed(2)}</p>
            </button>
            <button type="button" onClick={() => setDuration(60)}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                duration === 60 ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <p className="font-semibold">60 minutes</p>
              <p className="text-sm text-gray-500">${rate.toFixed(2)}</p>
            </button>
          </div>
        </div>

        {/* Calendar + Time Slots */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Pick a Date & Time</h2>

          {!hasAvailability && (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500">This guide hasn&apos;t set up their availability yet.</p>
            </div>
          )}

          {hasAvailability && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Left: Calendar */}
                <div className="md:w-[320px] p-4 md:border-r border-b md:border-b-0 border-gray-200">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setCalendarMonth((prev) => {
                        const d = new Date(prev.year, prev.month - 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-800">
                      {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                    </span>
                    <button
                      onClick={() => setCalendarMonth((prev) => {
                        const d = new Date(prev.year, prev.month + 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {SHORT_DAYS.map((d) => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((dateStr, i) => {
                      if (!dateStr) {
                        return <div key={`pad-${i}`} className="h-10" />;
                      }

                      const isPast = dateStr <= todayStr;
                      const hasSlots = datesWithSlots.has(dateStr);
                      const hasFreeSlots = datesWithFreeSlots.has(dateStr);
                      const isSelected = selectedDate === dateStr;
                      const isToday = dateStr === todayStr;
                      const dayNum = parseDateLocal(dateStr).getDate();
                      // Allow clicking dates that have any slots (even all booked) to show the booked state
                      const isClickable = !isPast && hasSlots;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            if (isClickable) {
                              setSelectedDate(dateStr);
                            }
                          }}
                          disabled={!isClickable}
                          className={`h-10 w-full flex items-center justify-center text-sm rounded-lg transition-colors ${
                            isSelected
                              ? "bg-teal-600 text-white font-bold"
                              : !isClickable
                              ? "text-gray-300 cursor-default"
                              : isToday
                              ? "text-teal-700 font-bold hover:bg-teal-50"
                              : hasFreeSlots
                              ? "text-teal-700 font-semibold hover:bg-teal-50 cursor-pointer"
                              : "text-gray-400 font-medium hover:bg-gray-50 cursor-pointer"
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Timezone */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{getTimezoneLongLabel(userTimezone)} ({getTimezoneLabel(userTimezone)})</span>
                      <button
                        onClick={() => setShowTzPicker(!showTzPicker)}
                        className="text-teal-600 hover:text-teal-700 font-medium ml-1"
                      >
                        Change
                      </button>
                    </div>
                    {showTzPicker && (
                      <div className="mt-2">
                        <select
                          value={userTimezone}
                          onChange={(e) => {
                            setUserTimezone(e.target.value);
                            setShowTzPicker(false);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        >
                          {COMMON_TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>{getTimezoneLongLabel(tz)} ({getTimezoneLabel(tz)})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Time slots */}
                <div className="flex-1 p-4">
                  {selectedDate && selectedDateObj ? (
                    <>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">
                        {selectedDateObj.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>

                      {slotsForSelectedDate.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                          {slotsForSelectedDate.map((slot) => {
                            const isSelected =
                              !slot.booked && selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                            return (
                              <button
                                key={`${slot.date}-${slot.startTime}`}
                                type="button"
                                onClick={() => { if (!slot.booked) setSelectedSlot(slot); }}
                                disabled={slot.booked}
                                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                  slot.booked
                                    ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through"
                                    : isSelected
                                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:text-teal-700"
                                }`}
                                title={slot.booked ? "This time is already booked" : ""}
                              >
                                {formatTime12(slot.startTime)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                          No available slots on this date
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                      {datesWithFreeSlots.size > 0
                        ? "Select a date to see available times"
                        : datesWithSlots.size > 0
                        ? "All times are currently booked"
                        : "No available slots in the next 60 days"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation card */}
        {selectedSlot && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Confirm Your Booking</h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-teal-700 font-semibold">
                  {guide.name?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{guide.name}</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {parseDateLocal(selectedSlot.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedSlot.label} ({getTimezoneLabel(userTimezone)})
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                  <span>{duration} min</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-teal-700">${price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Questions for your guide (optional)
          </label>
          <textarea
            value={questionsInAdvance}
            onChange={(e) => setQuestionsInAdvance(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            rows={3}
            placeholder="Share any specific questions you'd like to discuss so your guide can prepare..."
          />
        </div>

        {/* Submit */}
        <div className="border-t border-gray-200 pt-4">
          {error && (
            <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
          )}
          <button
            onClick={handleBook}
            disabled={booking || !selectedSlot}
            className="w-full bg-teal-600 text-white font-semibold py-3 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {booking ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              `Proceed to Payment — $${price.toFixed(2)}`
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            You will be redirected to Stripe to complete your payment securely.
          </p>
          <p className="text-xs text-amber-600 text-center mt-1">
            Cancellations made less than 24 hours before the call are non-refundable.
          </p>
        </div>
      </div>
    </div>
  );
}
