"use client";

import { useState } from "react";
import Link from "next/link";
import SeriesForm from "@/components/SeriesForm";

interface SeriesSectionProps {
  series: any[];
  onSeriesUpdate: (series: any[]) => void;
}

export default function SeriesSection({ series, onSeriesUpdate }: SeriesSectionProps) {
  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<any>(null);
  const [deletingSeries, setDeletingSeries] = useState<string | null>(null);

  async function startEditingSeries(seriesId: string) {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.ok) {
        const seriesData = await res.json();
        setEditingSeries({
          id: seriesData.id,
          title: seriesData.title,
          description: seriesData.description || "",
          procedureType: seriesData.procedureType,
          discountPercent: seriesData.discountPercent,
          recordingIds: seriesData.recordings?.map((r: any) => r.id) || [],
          status: seriesData.status,
        });
        setShowSeriesForm(true);
      }
    } catch (err) {
      console.error("Error loading series for edit:", err);
    }
  }

  async function handleSeriesUpdate(updatedSeries: any) {
    try {
      const res = await fetch(`/api/series/${updatedSeries.id}`);
      if (res.ok) {
        const fullSeries = await res.json();
        onSeriesUpdate(series.map((s) => (s.id === updatedSeries.id ? fullSeries : s)));
      }
    } catch {
      onSeriesUpdate(series.map((s) => (s.id === updatedSeries.id ? updatedSeries : s)));
    }
    setEditingSeries(null);
    setShowSeriesForm(false);
  }

  async function deleteSeries(seriesId: string) {
    if (!confirm("Are you sure you want to delete this series? This cannot be undone.")) return;
    setDeletingSeries(seriesId);
    try {
      const res = await fetch(`/api/series/${seriesId}`, { method: "DELETE" });
      if (res.ok) {
        onSeriesUpdate(series.filter((s) => s.id !== seriesId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete series");
      }
    } catch (err) {
      console.error("Error deleting series:", err);
      alert("Failed to delete series");
    } finally {
      setDeletingSeries(null);
    }
  }

  async function updateSeriesStatus(seriesId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/series/${seriesId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onSeriesUpdate(series.map((s) => (s.id === seriesId ? { ...s, status: newStatus } : s)));
      }
    } catch (err) {
      console.error("Error updating series status:", err);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Your Series</h2>
          <p className="text-sm text-gray-500 mt-1">Bundle related recordings into a series</p>
        </div>
        <button onClick={() => { setEditingSeries(null); setShowSeriesForm(!showSeriesForm); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">+ New Series</button>
      </div>

      {showSeriesForm && (
        <div className="mb-6">
          <SeriesForm
            initialData={editingSeries}
            onSuccess={(updatedSeries) => {
              if (editingSeries) {
                handleSeriesUpdate(updatedSeries);
              } else {
                onSeriesUpdate([updatedSeries, ...series]);
                setShowSeriesForm(false);
              }
            }}
            onCancel={() => { setEditingSeries(null); setShowSeriesForm(false); }}
          />
        </div>
      )}

      {series.length === 0 && !showSeriesForm ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">No series yet</p>
          <p className="text-sm text-gray-400">Create a series to bundle related recordings together</p>
        </div>
      ) : (
        <div className="space-y-3">
          {series.map((s: any) => {
            const recordingCount = s.recordings?.length || s.recordingCount || 0;
            const isDeleting = deletingSeries === s.id;
            return (
              <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-700">{recordingCount}</span>
                  </div>
                  <div>
                    <Link href={`/series/${s.id}`} className="font-medium hover:text-purple-700">{s.title}</Link>
                    <p className="text-sm text-gray-500">{s.procedureType} &middot; {recordingCount} recording{recordingCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.status === "PUBLISHED" ? "bg-green-100 text-green-700" : s.status === "ARCHIVED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>{s.status}</span>
                  {s.status === "DRAFT" && recordingCount >= 2 && (
                    <button onClick={() => updateSeriesStatus(s.id, "PUBLISHED")} className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-200 font-medium">Publish</button>
                  )}
                  {s.status === "PUBLISHED" && (
                    <button onClick={() => updateSeriesStatus(s.id, "DRAFT")} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 font-medium">Unpublish</button>
                  )}
                  <button onClick={() => startEditingSeries(s.id)} className="text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1">Edit</button>
                  <button onClick={() => deleteSeries(s.id)} disabled={isDeleting} className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 disabled:opacity-50">{isDeleting ? "..." : "Delete"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
