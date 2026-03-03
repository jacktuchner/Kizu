"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { JOURNAL_MILESTONE_PRESETS, JOURNAL_MILESTONE_PRESETS_CHRONIC_PAIN, JOURNAL_MOOD_EMOJIS, JOURNAL_TRIGGER_PRESETS } from "@/lib/constants";
import { getTimeSinceSurgeryLabel, getTimeSinceDiagnosisLabel } from "@/lib/surgeryDate";

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

function parseDate(s: string): Date {
  if (!s.endsWith("Z") && !s.includes("+")) return new Date(s + "Z");
  return new Date(s);
}

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

  // Form state
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
    setFormPain(entry.painLevel);
    setFormMobility(entry.mobilityLevel);
    setFormMood(entry.mood);
    setFormNotes(entry.notes || "");
    setFormMilestones(entry.milestones || []);
    setFormCustomMilestone("");
    setFormShared(entry.isShared);
    setFormTriggers(entry.triggers || []);
    setFormIsFlare(entry.isFlare || false);
    setFormEnergyLevel(entry.energyLevel ?? 5);
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
        // When in "View All" mode, create entries under the default (active) condition
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

  // Compute week label for header (skip for chronic pain and View All)
  const weekLabel = isViewAll ? null : (isChronicPain ? null : (effectiveSurgeryDate ? getTimeSinceSurgeryLabel(effectiveSurgeryDate) : null));
  const diagnosisLabel = isViewAll ? null : (isChronicPain && effectiveSurgeryDate ? getTimeSinceDiagnosisLabel(effectiveSurgeryDate) : null);

  // Quick stats from latest 2 entries
  const latest = entries[0] || null;
  const previous = entries[1] || null;

  function trendArrow(current: number, prev: number | null, invertColor: boolean) {
    if (prev === null) return null;
    const diff = current - prev;
    if (diff === 0) return <span className="text-gray-400 text-xs ml-1">—</span>;
    const up = diff > 0;
    const color = invertColor
      ? (up ? "text-red-500" : "text-green-500")
      : (up ? "text-green-500" : "text-red-500");
    return (
      <span className={`${color} text-xs ml-1`}>
        {up ? "\u25B2" : "\u25BC"} {Math.abs(diff)}
      </span>
    );
  }

  // SVG Trend Chart (last 10 entries, chronological)
  const chartEntries = [...entries].slice(0, 10).reverse();
  const showChart = chartEntries.length >= 2;

  function renderChart() {
    const width = 400;
    const height = 160;
    const padding = { top: 20, right: 20, bottom: 30, left: 35 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const n = chartEntries.length;
    const xStep = n > 1 ? plotW / (n - 1) : plotW;

    function toY(val: number) {
      return padding.top + plotH - ((val - 1) / 9) * plotH;
    }

    function buildPath(key: "painLevel" | "mobilityLevel") {
      return chartEntries
        .map((e, i) => {
          const x = padding.left + i * xStep;
          const y = toY(e[key]);
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    }

    const yTicks = [1, 3, 5, 7, 10];

    return (
      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={padding.left} y1={toY(v)}
                x2={width - padding.right} y2={toY(v)}
                stroke="#e5e7eb" strokeWidth="1"
              />
              <text x={padding.left - 8} y={toY(v) + 4} textAnchor="end" className="text-[10px]" fill="#9ca3af">{v}</text>
            </g>
          ))}
          {/* Pain line (orange) */}
          <path d={buildPath("painLevel")} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {chartEntries.map((e, i) => (
            <circle key={`p-${i}`} cx={padding.left + i * xStep} cy={toY(e.painLevel)} r="3" fill="#f97316" />
          ))}
          {/* Mobility line (teal) */}
          <path d={buildPath("mobilityLevel")} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {chartEntries.map((e, i) => (
            <circle key={`m-${i}`} cx={padding.left + i * xStep} cy={toY(e.mobilityLevel)} r="3" fill="#14b8a6" />
          ))}
          {/* Energy line (blue, chronic pain only) */}
          {isChronicPain && buildEnergyPath() && (
            <>
              <path d={buildEnergyPath()!} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {chartEntries.filter((e) => e.energyLevel != null).map((e) => {
                const origIdx = chartEntries.indexOf(e);
                return (
                  <circle key={`e-${origIdx}`} cx={padding.left + origIdx * xStep} cy={toY(e.energyLevel!)} r="3" fill="#3b82f6" />
                );
              })}
            </>
          )}
          {/* X-axis labels */}
          {chartEntries.map((e, i) => (
            <text
              key={`x-${i}`}
              x={padding.left + i * xStep}
              y={height - 5}
              textAnchor="middle"
              className="text-[9px]"
              fill="#9ca3af"
            >
              {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          ))}
        </svg>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Pain
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-teal-500 inline-block rounded" /> Mobility
          </span>
          {isChronicPain && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Energy
            </span>
          )}
        </div>
      </div>
    );
  }

  // Add energy line to chart for chronic pain
  function buildEnergyPath() {
    if (!isChronicPain) return null;
    const width = 400;
    const padding = { top: 20, right: 20, bottom: 30, left: 35 };
    const plotW = width - padding.left - padding.right;
    const plotH = 160 - padding.top - padding.bottom;
    const n = chartEntries.length;
    const xStep = n > 1 ? plotW / (n - 1) : plotW;

    function toY(val: number) {
      return padding.top + plotH - ((val - 1) / 9) * plotH;
    }

    return chartEntries
      .filter((e) => e.energyLevel != null)
      .map((e, i) => {
        const origIdx = chartEntries.indexOf(e);
        const x = padding.left + origIdx * xStep;
        const y = toY(e.energyLevel!);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  const journalTitle = isChronicPain ? "Health Journal" : "Recovery Journal";

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold">{journalTitle}</h2>
        <p className="text-gray-400 text-sm mt-2">Loading...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">{journalTitle}</h2>
          {hasMultipleConditions && (
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              style={{ fontSize: "1.125rem" }}
            >
              {procedures!.map((p) => (
                <option key={p.procedureType} value={p.procedureType} style={{ fontSize: "1.125rem" }}>
                  {p.procedureType}
                </option>
              ))}
              <option value="__ALL__" style={{ fontSize: "1.125rem" }}>View All</option>
            </select>
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
        {!showForm && (
          <button
            onClick={openNewEntry}
            className="text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium flex items-center gap-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Entry
          </button>
        )}
      </div>

      {/* Quick Stats */}
      {latest && (
        <div className={`grid ${isChronicPain ? "grid-cols-4" : "grid-cols-3"} gap-3 mb-4`}>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Pain</p>
            <p className="text-2xl font-bold text-orange-600">
              {latest.painLevel}
              {trendArrow(latest.painLevel, previous?.painLevel ?? null, true)}
            </p>
            <p className="text-xs text-gray-400">/10</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Mobility</p>
            <p className="text-2xl font-bold text-teal-600">
              {latest.mobilityLevel}
              {trendArrow(latest.mobilityLevel, previous?.mobilityLevel ?? null, false)}
            </p>
            <p className="text-xs text-gray-400">/10</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Mood</p>
            <p className="text-2xl font-bold">
              {JOURNAL_MOOD_EMOJIS[latest.mood - 1]}
            </p>
            <p className="text-xs text-gray-400">
              {previous ? (
                latest.mood > previous.mood
                  ? <span className="text-green-500">{"\u25B2"}</span>
                  : latest.mood < previous.mood
                  ? <span className="text-red-500">{"\u25BC"}</span>
                  : <span className="text-gray-400">—</span>
              ) : null}
            </p>
          </div>
          {isChronicPain && (
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Energy</p>
              <p className="text-2xl font-bold text-blue-600">
                {latest.energyLevel ?? "—"}
                {latest.energyLevel != null && trendArrow(latest.energyLevel, previous?.energyLevel ?? null, false)}
              </p>
              <p className="text-xs text-gray-400">/10</p>
            </div>
          )}
        </div>
      )}

      {/* Trend Chart */}
      {showChart && renderChart()}

      {/* Nudge text when no entries — just a subtle line, not a banner */}
      {entries.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm text-center py-4">
          No entries yet. Tap <strong>+ New Entry</strong> to start tracking.
        </p>
      )}

      {/* Entry Form */}
      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 my-4 bg-gray-50/50 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? "Edit Entry" : "New Journal Entry"}
          </h3>

          {/* Pain Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Pain Level</span>
              <span className="text-orange-600 font-bold">{formPain}/10</span>
            </label>
            <input
              type="range" min={1} max={10} value={formPain}
              onChange={(e) => setFormPain(parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Minimal</span><span>Severe</span>
            </div>
          </div>

          {/* Mobility Slider */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Mobility Level</span>
              <span className="text-teal-600 font-bold">{formMobility}/10</span>
            </label>
            <input
              type="range" min={1} max={10} value={formMobility}
              onChange={(e) => setFormMobility(parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Very limited</span><span>Full mobility</span>
            </div>
          </div>

          {/* Mood Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mood</label>
            <div className="flex gap-2">
              {JOURNAL_MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFormMood(i + 1)}
                  className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                    formMood === i + 1
                      ? "border-purple-400 bg-purple-50 scale-110"
                      : "border-transparent hover:border-gray-200"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Chronic Pain: Triggers */}
          {isChronicPain && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Triggers</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {JOURNAL_TRIGGER_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTrigger(t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      formTriggers.includes(t)
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chronic Pain: Flare Toggle & Energy */}
          {isChronicPain && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Flare Day?</label>
                <button
                  type="button"
                  onClick={() => setFormIsFlare(!formIsFlare)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    formIsFlare
                      ? "bg-red-50 border-red-400 text-red-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {formIsFlare ? "Yes — Flare" : "No"}
                </button>
              </div>
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>Energy Level</span>
                  <span className="text-blue-600 font-bold">{formEnergyLevel}/10</span>
                </label>
                <input
                  type="range" min={1} max={10} value={formEnergyLevel}
                  onChange={(e) => setFormEnergyLevel(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Exhausted</span><span>Energized</span>
                </div>
              </div>
            </div>
          )}

          {/* Milestones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Milestones</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {milestonePresets.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMilestone(m)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    formMilestones.includes(m)
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {/* Custom milestones display */}
            {formMilestones.filter((m) => !(milestonePresets as readonly string[]).includes(m)).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {formMilestones
                  .filter((m) => !(milestonePresets as readonly string[]).includes(m))
                  .map((m) => (
                    <span key={m} className="text-xs bg-amber-50 border border-amber-300 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      {m}
                      <button type="button" onClick={() => toggleMilestone(m)} className="hover:text-red-500">
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
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={addCustomMilestone}
                disabled={!formCustomMilestone.trim()}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium px-2 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder="How are you feeling today? Any observations about your recovery..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Share Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setFormShared(!formShared)}
              className={`relative w-10 h-6 rounded-full transition-colors ${formShared ? "bg-teal-500" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formShared ? "left-[18px]" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-gray-700 flex items-center gap-1.5">
              {formShared ? (
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {formShared ? "Shared with guides" : "Private"}
            </span>
          </label>
          {formShared && (
            <p className="text-xs text-gray-500 ml-[52px]">
              Choose which guides can see shared entries in{" "}
              <Link href="/settings" className="text-teal-600 hover:text-teal-700 underline">
                Settings &gt; Journal Sharing
              </Link>.
            </p>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
            </button>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}


      {/* Entry Feed */}
      {entries.length > 0 && (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {parseDate(entry.createdAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {isViewAll && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                      {entry.procedureType}
                    </span>
                  )}
                  {entry.recoveryWeek !== null && !isChronicPain && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Week {entry.recoveryWeek}
                    </span>
                  )}
                  {entry.isFlare && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Flare
                    </span>
                  )}
                  {entry.isShared && (
                    <span title="Shared">
                      <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(entry)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-sm text-red-500 hover:text-red-600 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Indicators row */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-orange-500 font-medium">Pain {entry.painLevel}</span>
                  <span className="text-gray-300">/10</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-teal-500 font-medium">Mobility {entry.mobilityLevel}</span>
                  <span className="text-gray-300">/10</span>
                </span>
                <span className="text-lg">{JOURNAL_MOOD_EMOJIS[entry.mood - 1]}</span>
                {entry.energyLevel != null && (
                  <span className="flex items-center gap-1">
                    <span className="text-blue-500 font-medium">Energy {entry.energyLevel}</span>
                    <span className="text-gray-300">/10</span>
                  </span>
                )}
              </div>

              {/* Triggers */}
              {entry.triggers?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.triggers.map((t) => (
                    <span key={t} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Milestones */}
              {entry.milestones?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.milestones.map((m) => (
                    <span key={m} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes preview */}
              {entry.notes && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{entry.notes}</p>
              )}
            </div>
          ))}

          {/* Load more */}
          {page < totalPages && (
            <button
              onClick={() => fetchEntries(page + 1)}
              className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium py-2"
            >
              Load more ({total - entries.length} remaining)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
