export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface DateOverride {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface CalendarCall {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  seekerName: string;
}

export interface DayInfo {
  dayOfWeek: number;
  isPast: boolean;
  isToday: boolean;
  hasDefault: boolean;
  dateOverrides: DateOverride[];
  isBlocked: boolean;
  hasCustomHours: boolean;
  dayCalls: CalendarCall[];
}

export interface TimeWindow {
  startTime: string;
  endTime: string;
  type: "available" | "booked" | "blocked";
  label?: string;
}
