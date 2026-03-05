"use client";

import { TIME_OPTIONS } from "./timelineUtils";

interface TimeRangeSelectorProps {
  startTime: string;
  endTime: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export default function TimeRangeSelector({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  onSave,
  onCancel,
  saving,
}: TimeRangeSelectorProps) {
  const isValid = startTime < endTime;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
        <select
          value={startTime}
          onChange={(e) => onStartChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
        <select
          value={endTime}
          onChange={(e) => onEndChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onSave}
        disabled={saving || !isValid}
        className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
      >
        Cancel
      </button>
      {!isValid && (
        <p className="w-full text-xs text-red-600 mt-1">End time must be after start time</p>
      )}
    </div>
  );
}
