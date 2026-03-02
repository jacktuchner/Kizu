"use client";

import { useState } from "react";
import RecordingForm from "@/components/RecordingForm";
import GuideGuidelines from "@/components/GuideGuidelines";

interface RecordingsSectionProps {
  recordings: any[];
  onRecordingsUpdate: (recordings: any[]) => void;
}

export default function RecordingsSection({ recordings, onRecordingsUpdate }: RecordingsSectionProps) {
  const [showRecordingForm, setShowRecordingForm] = useState(false);
  const [editingRecording, setEditingRecording] = useState<any>(null);
  const [deletingRecording, setDeletingRecording] = useState<string | null>(null);
  const [savingRecording, setSavingRecording] = useState(false);

  function handleRecordingSuccess(recording: Record<string, unknown>) {
    onRecordingsUpdate([recording, ...recordings]);
    setShowRecordingForm(false);
  }

  async function saveRecordingEdit() {
    if (!editingRecording) return;
    setSavingRecording(true);
    try {
      const res = await fetch(`/api/recordings/${editingRecording.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingRecording.title,
          description: editingRecording.description,
          category: editingRecording.category,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onRecordingsUpdate(recordings.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
        setEditingRecording(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save recording");
      }
    } catch (err) {
      console.error("Error saving recording:", err);
      alert("Failed to save recording");
    } finally {
      setSavingRecording(false);
    }
  }

  async function deleteRecording(recordingId: string) {
    if (!confirm("Are you sure you want to delete this recording? This cannot be undone.")) return;
    setDeletingRecording(recordingId);
    try {
      const res = await fetch(`/api/recordings/${recordingId}`, { method: "DELETE" });
      if (res.ok) {
        onRecordingsUpdate(recordings.filter((r) => r.id !== recordingId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete recording");
      }
    } catch (err) {
      console.error("Error deleting recording:", err);
      alert("Failed to delete recording");
    } finally {
      setDeletingRecording(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your Recordings</h2>
        <button onClick={() => setShowRecordingForm(!showRecordingForm)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">+ New Recording</button>
      </div>

      {showRecordingForm && (
        <GuideGuidelines>
          <div className="mb-6">
            <RecordingForm onSuccess={handleRecordingSuccess} onCancel={() => setShowRecordingForm(false)} />
          </div>
        </GuideGuidelines>
      )}

      {recordings.length === 0 && !showRecordingForm ? (
        <p className="text-gray-500 text-center py-8">No recordings yet. Create your first one!</p>
      ) : (
        <div className="space-y-3">
          {recordings.map((rec: any) => {
            const isEditing = editingRecording?.id === rec.id;
            const isDeleting = deletingRecording === rec.id;

            if (isEditing) {
              return (
                <div key={rec.id} className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                      <input type="text" value={editingRecording.title} onChange={(e) => setEditingRecording({ ...editingRecording, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={editingRecording.description || ""} onChange={(e) => setEditingRecording({ ...editingRecording, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select value={editingRecording.category} onChange={(e) => setEditingRecording({ ...editingRecording, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="WEEKLY_TIMELINE">Timeline</option>
                        <option value="WISH_I_KNEW">Wish I Knew</option>
                        <option value="PRACTICAL_TIPS">Practical Tips</option>
                        <option value="MENTAL_HEALTH">Mental Health</option>
                        <option value="RETURN_TO_ACTIVITY">Return to Activity</option>
                        <option value="MISTAKES_AND_LESSONS">Mistakes & Lessons</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveRecordingEdit} disabled={savingRecording} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">{savingRecording ? "Saving..." : "Save"}</button>
                      <button onClick={() => setEditingRecording(null)} className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={rec.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{rec.title}</p>
                  <p className="text-sm text-gray-500">
                    {rec.category.replace(/_/g, " ")} &middot; {rec.viewCount} views
                    {rec.transcriptionStatus && rec.transcriptionStatus !== "NONE" && (
                      <span className={`ml-2 ${rec.transcriptionStatus === "COMPLETED" ? "text-green-600" : rec.transcriptionStatus === "PENDING" ? "text-yellow-600" : "text-red-600"}`}>
                        &middot; Transcription: {rec.transcriptionStatus.toLowerCase()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${rec.status === "PUBLISHED" ? "bg-green-100 text-green-700" : rec.status === "PENDING_REVIEW" ? "bg-yellow-100 text-yellow-700" : rec.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{rec.status.replace(/_/g, " ")}</span>
                  <button onClick={() => setEditingRecording({ ...rec })} className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1">Edit</button>
                  <button onClick={() => deleteRecording(rec.id)} disabled={isDeleting} className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 disabled:opacity-50">{isDeleting ? "..." : "Delete"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
