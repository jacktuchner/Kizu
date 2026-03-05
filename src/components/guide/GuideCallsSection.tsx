"use client";

import { useState } from "react";
import { MIN_CALL_RATE, MAX_CALL_RATE } from "@/lib/constants";
import AvailabilityManager from "@/components/AvailabilityManager";

interface GuideCallsSectionProps {
  profile: any;
  sharedForm: {
    ageRange: string;
    gender: string;
    activityLevel: string;
    hourlyRate: number;
    isAvailableForCalls: boolean;
  };
  onSharedFormChange: (form: { ageRange: string; gender: string; activityLevel: string; hourlyRate: number; isAvailableForCalls: boolean }) => void;
  onProfileUpdate: (updated: any) => void;
}

export default function GuideCallsSection({ profile, sharedForm, onSharedFormChange, onProfileUpdate }: GuideCallsSectionProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const procedures = profile?.procedureTypes?.length > 0
    ? profile.procedureTypes
    : (profile?.procedureType ? [profile.procedureType] : []);

  const procedureProfiles = profile?.procedureProfiles || {};

  async function toggleCalls(enabled: boolean) {
    onSharedFormChange({ ...sharedForm, isAvailableForCalls: enabled });

    // Auto-save the toggle
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          isAvailableForCalls: enabled,
          procedureTypes: procedures,
          procedureProfiles: procedureProfiles,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onProfileUpdate(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveRate() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: procedures,
          procedureProfiles: procedureProfiles,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onProfileUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">Guide Calls</h2>
            <p className="text-sm text-gray-500">Offer 1-on-1 video calls with seekers</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={sharedForm.isAvailableForCalls}
            onChange={(e) => toggleCalls(e.target.checked)}
            disabled={saving}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          <span className="ms-2 text-sm font-medium text-gray-700">
            {sharedForm.isAvailableForCalls ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {sharedForm.isAvailableForCalls && (
        <div className="mt-4 space-y-6">
          {/* Hourly Rate */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Hourly Rate</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  min={MIN_CALL_RATE}
                  max={MAX_CALL_RATE}
                  value={sharedForm.hourlyRate}
                  onChange={(e) => onSharedFormChange({ ...sharedForm, hourlyRate: parseInt(e.target.value) || 50 })}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
                <span className="text-gray-500">/ hour</span>
              </div>
              <button
                onClick={saveRate}
                disabled={saving}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? "Saving..." : "Save Rate"}
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Range: ${MIN_CALL_RATE} - ${MAX_CALL_RATE}</p>
          </div>

          {/* Availability Manager (weekly hours, settings, calendar) */}
          <AvailabilityManager />
        </div>
      )}
    </section>
  );
}
