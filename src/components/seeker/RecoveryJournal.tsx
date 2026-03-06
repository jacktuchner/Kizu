"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronDown, Flame, BookOpen } from "lucide-react";
import { JOURNAL_MILESTONE_PRESETS, JOURNAL_MILESTONE_PRESETS_CHRONIC_PAIN, JOURNAL_TRIGGER_PRESETS } from "@/lib/constants";
import { getTimeSinceSurgeryLabel, getTimeSinceDiagnosisLabel } from "@/lib/surgeryDate";
import { parseDate } from "@/lib/dates";

interface JournalEntry {
  id: string;
  patientId: string;
  procedureType: string;
  recoveryWeek: number | null;
  painLevel: number;
  mobilityLevel: number;
  mood: number;
  notes: string | null;
  milestones: string[];
  triggers: string[];
  isFlare: boolean;
  energyLevel: number | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProcedureInfo {
  procedureType: string;
  surgeryDate: string | null;
  conditionCategory: string;
}

interface RecoveryJournalProps {
  procedureType: string;
  surgeryDate: string | null;
  currentWeek: number | undefined;
  conditionCategory?: string;
  procedures?: ProcedureInfo[];
}

// --- Shared constants ---

const MOOD_LABELS = ["Low", "Fair", "Okay", "Good", "Great"] as const;

/** 3-tier color for 0-10 metrics. invert=true means low=green (for pain). */
function tierDot(value: number, invert?: boolean): string {
  const v = Math.min(10, Math.max(0, value));
  const tier = v <= 3 ? "low" : v <= 6 ? "mid" : "high";
  if (invert) return tier === "low" ? "bg-green-500" : tier === "mid" ? "bg-yellow-500" : "bg-red-500";
  return tier === "low" ? "bg-red-500" : tier === "mid" ? "bg-yellow-500" : "bg-green-500";
}
function tierText(value: number, invert?: boolean): string {
  const v = Math.min(10, Math.max(0, value));
  const tier = v <= 3 ? "low" : v <= 6 ? "mid" : "high";
  if (invert) return tier === "low" ? "text-green-600" : tier === "mid" ? "text-yellow-600" : "text-red-600";
  return tier === "low" ? "text-red-600" : tier === "mid" ? "text-yellow-600" : "text-green-600";
}
/** Mood color: 1=red, 2-3=yellow, 4-5=green */
function moodDot(mood: number): string {
  const m = Math.min(5, Math.max(1, mood));
  return m <= 1 ? "bg-red-500" : m <= 3 ? "bg-yellow-500" : "bg-green-500";
}
function moodText(mood: number): string {
  const m = Math.min(5, Math.max(1, mood));
  return m <= 1 ? "text-red-600" : m <= 3 ? "text-yellow-600" : "text-green-600";
}

// --- Sub-components ---

function ConditionDropdown({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 text-sm font-medium text-gray-900"
      >
        {selected?.label || value}
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                opt.value === value ? "font-medium text-teal-700 bg-teal-50" : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mood button group — 5 options, 1-5 internally */
function MoodButtonGroup({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const selectedColors = [
    "bg-red-500 text-white",
    "bg-yellow-500 text-gray-800",
    "bg-yellow-500 text-gray-800",
    "bg-green-500 text-white",
    "bg-green-500 text-white",
  ];
  const clamped = Math.min(5, Math.max(1, value));

  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-200">
      {MOOD_LABELS.map((label, i) => {
        const isSelected = clamped === i + 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`flex-1 py-2 text-xs font-medium transition-all ${
              isSelected ? selectedColors[i] : "bg-white text-gray-500 hover:bg-gray-50"
            } ${i > 0 ? "border-l border-gray-200" : ""}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Gradient slider for 0-10 metrics */
function MetricSlider({ value, onChange, gradient, label }: {
  value: number;
  onChange: (v: number) => void;
  gradient: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{value}<span className="text-gray-400 font-normal">/10</span></span>
      </div>
      <div className="relative">
        <div className="absolute top-[10px] left-0 right-0 h-2 rounded-full" style={{ background: gradient }} />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="journal-slider relative z-10"
        />
      </div>
    </div>
  );
}

/** Compact entry card for the feed */
function EntryCard({ entry, isViewAll, isChronicPain, onEdit, onDelete }: {
  entry: JournalEntry;
  isViewAll: boolean;
  isChronicPain: boolean;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = !!(entry.notes || (entry.milestones?.length > 0) || (entry.triggers?.length > 0));

  const moodClamped = Math.min(5, Math.max(1, entry.mood));
  const moodLabel = MOOD_LABELS[moodClamped - 1];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
      <div
        className={`px-4 py-3 ${hasExtra ? "cursor-pointer" : ""}`}
        onClick={() => hasExtra && setExpanded(!expanded)}
      >
        {/* Top row: date + badges + actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">
              {parseDate(entry.createdAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            {isViewAll && (
              <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-200">
                {entry.procedureType}
              </span>
            )}
            {entry.recoveryWeek !== null && !isChronicPain && (
              <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                Wk {entry.recoveryWeek}
              </span>
            )}
            {entry.isFlare && (
              <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                <Flame className="w-3 h-3" /> Flare
              </span>
            )}
            {entry.isShared && (
              <span className="text-[11px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">Shared</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="text-gray-400 hover:text-teal-600 p-1 rounded-lg hover:bg-teal-50 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {hasExtra && (
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            )}
          </div>
        </div>

        {/* Metrics row: colored dots with numeric values */}
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <span className={`w-2 h-2 rounded-full ${tierDot(entry.painLevel, true)} flex-shrink-0`} />
          <span className={`font-medium ${tierText(entry.painLevel, true)}`}>Pain {entry.painLevel}</span>
          <span className="text-gray-300 mx-0.5">&middot;</span>
          <span className={`w-2 h-2 rounded-full ${tierDot(entry.mobilityLevel)} flex-shrink-0`} />
          <span className={`font-medium ${tierText(entry.mobilityLevel)}`}>Mobility {entry.mobilityLevel}</span>
          {entry.energyLevel != null && (
            <>
              <span className="text-gray-300 mx-0.5">&middot;</span>
              <span className={`w-2 h-2 rounded-full ${tierDot(entry.energyLevel)} flex-shrink-0`} />
              <span className={`font-medium ${tierText(entry.energyLevel)}`}>Energy {entry.energyLevel}</span>
            </>
          )}
          <span className="text-gray-300 mx-0.5">&middot;</span>
          <span className={`w-2 h-2 rounded-full ${moodDot(entry.mood)} flex-shrink-0`} />
          <span className="text-gray-500">Mood:</span>
          <span className={`font-medium ${moodText(entry.mood)}`}>{moodLabel}</span>
        </div>
      </div>

      {/* Expandable details */}
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 pb-3 border-t border-gray-100 pt-2.5 space-y-2">
          {entry.triggers?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-500 mr-0.5">Triggers:</span>
              {entry.triggers.map((t) => (
                <span key={t} className="text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                  {t}
                </span>
              ))}
            </div>
          )}
          {entry.milestones?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-500 mr-0.5">Milestones:</span>
              {entry.milestones.map((m) => (
                <span key={m} className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  {m}
                </span>
              ))}
            </div>
          )}
          {entry.notes && (
            <p className="text-sm text-gray-600">{entry.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function computeStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];
    const hasEntry = entries.some((e) => {
      const entryDate = parseDate(e.createdAt).toISOString().split("T")[0];
      return entryDate === dateStr;
    });
    if (hasEntry) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// --- Main component ---

export default function RecoveryJournal({ procedureType, surgeryDate, currentWeek, conditionCategory, procedures }: RecoveryJournalProps) {
  const [selectedCondition, setSelectedCondition] = useState<string>(procedureType);
  const isViewAll = selectedCondition === "__ALL__";
  const activeProcInfo = procedures?.find((p) => p.procedureType === selectedCondition);
  const effectiveConditionCategory = isViewAll ? conditionCategory : (activeProcInfo?.conditionCategory || conditionCategory);
  const effectiveSurgeryDate = isViewAll ? surgeryDate : (activeProcInfo?.surgeryDate ?? surgeryDate);
  const isChronicPain = effectiveConditionCategory === "CHRONIC_PAIN";
  const milestonePresets = isChronicPain ? JOURNAL_MILESTONE_PRESETS_CHRONIC_PAIN : JOURNAL_MILESTONE_PRESETS;
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasMultipleConditions = (procedures?.length || 0) > 1;

  // Form state — sliders 0-10, mood 1-5
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPain, setFormPain] = useState(5);
  const [formMobility, setFormMobility] = useState(5);
  const [formMood, setFormMood] = useState(3);
  const [formNotes, setFormNotes] = useState("");
  const [formMilestones, setFormMilestones] = useState<string[]>([]);
  const [formCustomMilestone, setFormCustomMilestone] = useState("");
  const [formShared, setFormShared] = useState(false);
  const [formTriggers, setFormTriggers] = useState<string[]>([]);
  const [formIsFlare, setFormIsFlare] = useState(false);
  const [formEnergyLevel, setFormEnergyLevel] = useState(5);

  const fetchEntries = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: "10" });
      if (!isViewAll) {
        params.set("procedureType", selectedCondition);
      }
      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (p === 1) {
          setEntries(data.entries);
        } else {
          setEntries((prev) => [...prev, ...data.entries]);
        }
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error("Error fetching journal:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCondition, isViewAll]);

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    setPage(1);
    fetchEntries(1);
  }, [fetchEntries]);

  function resetForm() {
    setFormPain(5);
    setFormMobility(5);
    setFormMood(3);
    setFormNotes("");
    setFormMilestones([]);
    setFormCustomMilestone("");
    setFormShared(false);
    setFormTriggers([]);
    setFormIsFlare(false);
    setFormEnergyLevel(5);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(entry: JournalEntry) {
    setFormPain(Math.min(10, Math.max(0, entry.painLevel)));
    setFormMobility(Math.min(10, Math.max(0, entry.mobilityLevel)));
    setFormMood(Math.min(5, Math.max(1, entry.mood)));
    setFormNotes(entry.notes || "");
    setFormMilestones(entry.milestones || []);
    setFormCustomMilestone("");
    setFormShared(entry.isShared);
    setFormTriggers(entry.triggers || []);
    setFormIsFlare(entry.isFlare || false);
    setFormEnergyLevel(entry.energyLevel != null ? Math.min(10, Math.max(0, entry.energyLevel)) : 5);
    setEditingId(entry.id);
    setShowForm(true);
  }

  function openNewEntry() {
    resetForm();
    setShowForm(true);
  }

  function toggleMilestone(m: string) {
    setFormMilestones((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleTrigger(t: string) {
    setFormTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function addCustomMilestone() {
    const trimmed = formCustomMilestone.trim();
    if (trimmed && !formMilestones.includes(trimmed)) {
      setFormMilestones((prev) => [...prev, trimmed]);
      setFormCustomMilestone("");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/journal/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            painLevel: formPain,
            mobilityLevel: formMobility,
            mood: formMood,
            notes: formNotes || null,
            milestones: formMilestones,
            isShared: formShared,
            ...(isChronicPain && {
              triggers: formTriggers,
              isFlare: formIsFlare,
              energyLevel: formEnergyLevel,
            }),
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          resetForm();
        }
      } else {
        const entryProcedure = isViewAll ? procedureType : selectedCondition;
        const entryProcInfo = procedures?.find((p) => p.procedureType === entryProcedure);
        const entrySurgeryDate = entryProcInfo?.surgeryDate ?? surgeryDate;
        const entryConditionCategory = entryProcInfo?.conditionCategory || conditionCategory;
        const entryIsChronicPain = entryConditionCategory === "CHRONIC_PAIN";
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            procedureType: entryProcedure,
            painLevel: formPain,
            mobilityLevel: formMobility,
            mood: formMood,
            notes: formNotes || null,
            milestones: formMilestones,
            isShared: formShared,
            surgeryDate: entrySurgeryDate,
            conditionCategory: entryConditionCategory,
            ...(entryIsChronicPain && {
              triggers: formTriggers,
              isFlare: formIsFlare,
              energyLevel: formEnergyLevel,
            }),
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setEntries((prev) => [created, ...prev]);
          setTotal((t) => t + 1);
          resetForm();
        }
      }
    } catch (err) {
      console.error("Error saving journal entry:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this journal entry?")) return;
    try {
      const res = await fetch(`/api/journal/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setTotal((t) => t - 1);
        if (editingId === id) resetForm();
      }
    } catch (err) {
      console.error("Error deleting journal entry:", err);
    }
  }

  const weekLabel = isViewAll ? null : (isChronicPain ? null : (effectiveSurgeryDate ? getTimeSinceSurgeryLabel(effectiveSurgeryDate) : null));
  const diagnosisLabel = isViewAll ? null : (isChronicPain && effectiveSurgeryDate ? getTimeSinceDiagnosisLabel(effectiveSurgeryDate) : null);
  const journalTitle = isChronicPain ? "Health Journal" : "Recovery Journal";
  const streak = computeStreak(entries);

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold">{journalTitle}</h2>
        <p className="text-gray-400 text-sm mt-2">Loading...</p>
      </section>
    );
  }

  // Gradient strings for sliders
  const PAIN_GRADIENT = "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)";
  const MOBILITY_GRADIENT = "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)";
  const ENERGY_GRADIENT = "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)";

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">{journalTitle}</h2>
          {hasMultipleConditions && (
            <ConditionDropdown
              value={selectedCondition}
              options={[
                ...procedures!.map((p) => ({ value: p.procedureType, label: p.procedureType })),
                { value: "__ALL__", label: "View All" },
              ]}
              onChange={setSelectedCondition}
            />
          )}
          {weekLabel && (
            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
              {weekLabel}
            </span>
          )}
          {diagnosisLabel && (
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Diagnosed {diagnosisLabel} ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full" title={`${streak}-day streak`}>
              <Flame className="w-4 h-4" />
              <span className="text-sm font-semibold">{streak}</span>
            </div>
          )}
          {!showForm && (
            <button
              onClick={openNewEntry}
              className="text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm text-center py-4">
          No entries yet. Tap <strong>+ New Entry</strong> to start tracking.
        </p>
      )}

      {/* Entry Form */}
      {showForm && (
        <div className="border border-gray-200 rounded-2xl mb-4 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <h3 className="font-semibold text-gray-900">
              {editingId ? "Edit Entry" : "New Journal Entry"}
            </h3>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Pain slider */}
            <MetricSlider
              value={formPain}
              onChange={setFormPain}
              gradient={PAIN_GRADIENT}
              label="Pain Level"
            />

            {/* Mobility slider */}
            <MetricSlider
              value={formMobility}
              onChange={setFormMobility}
              gradient={MOBILITY_GRADIENT}
              label="Mobility"
            />

            {/* Mood + Energy row */}
            <div className={`grid ${isChronicPain ? "sm:grid-cols-2 gap-4" : ""}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mood</label>
                <MoodButtonGroup value={formMood} onChange={setFormMood} />
              </div>
              {isChronicPain && (
                <MetricSlider
                  value={formEnergyLevel}
                  onChange={setFormEnergyLevel}
                  gradient={ENERGY_GRADIENT}
                  label="Energy"
                />
              )}
            </div>

            {/* Chronic Pain: Flare + Triggers */}
            {isChronicPain && (
              <>
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Flare Day</p>
                    <p className="text-xs text-gray-400">Mark if today is a flare-up</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormIsFlare(!formIsFlare)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${formIsFlare ? "bg-red-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formIsFlare ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Triggers</label>
                  <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
                    {JOURNAL_TRIGGER_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTrigger(t)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                          formTriggers.includes(t)
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Milestones */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Milestones</label>
              <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto mb-2">
                {milestonePresets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMilestone(m)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                      formMilestones.includes(m)
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {formMilestones.filter((m) => !(milestonePresets as readonly string[]).includes(m)).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {formMilestones
                    .filter((m) => !(milestonePresets as readonly string[]).includes(m))
                    .map((m) => (
                      <span key={m} className="text-[11px] bg-teal-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        {m}
                        <button type="button" onClick={() => toggleMilestone(m)} className="hover:text-teal-200 ml-0.5">
                          &times;
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formCustomMilestone}
                  onChange={(e) => setFormCustomMilestone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMilestone(); } }}
                  placeholder="Add custom milestone..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={addCustomMilestone}
                  disabled={!formCustomMilestone.trim()}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium px-2.5 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                placeholder="How are you feeling today?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>

            {/* Share Toggle */}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {formShared ? (
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">{formShared ? "Shared with guides" : "Private"}</p>
                  {formShared && (
                    <p className="text-xs text-gray-400">
                      Manage in{" "}
                      <Link href="/settings" className="text-teal-600 hover:text-teal-700 underline">
                        Settings
                      </Link>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormShared(!formShared)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${formShared ? "bg-teal-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formShared ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/40 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
            </button>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entry Feed */}
      {entries.length > 0 && (
        <>
          <div className="space-y-2">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isViewAll={isViewAll}
                isChronicPain={isChronicPain}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {page < totalPages && (
            <button
              onClick={() => fetchEntries(page + 1)}
              className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium py-3 mt-2 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Load more ({total - entries.length} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}
