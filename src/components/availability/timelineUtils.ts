export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 22;
export const PIXELS_PER_HOUR = 72;
export const TIMELINE_HEIGHT = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * PIXELS_PER_HOUR;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeToPixels(time: string): number {
  const mins = timeToMinutes(time);
  const startMins = TIMELINE_START_HOUR * 60;
  return ((mins - startMins) / 60) * PIXELS_PER_HOUR;
}

export function durationToPixels(startTime: string, endTime: string): number {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  return ((endMins - startMins) / 60) * PIXELS_PER_HOUR;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function parseDateLocal(dateStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

export const TIME_OPTIONS = generateTimeOptions();

export const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];
