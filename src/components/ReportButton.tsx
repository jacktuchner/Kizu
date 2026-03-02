"use client";

import { useState } from "react";

interface ReportButtonProps {
  recordingId?: string;
  userId?: string;
  callId?: string;
  reviewId?: string;
  seriesId?: string;
  forumThreadId?: string;
  contentTitle?: string;
}

const REPORT_REASONS = [
  { value: "medical_advice", label: "Contains medical advice or directives" },
  { value: "harmful_content", label: "Potentially harmful information" },
  { value: "contradicts_doctors", label: "Encourages ignoring doctor's advice" },
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "misinformation", label: "Factually incorrect information" },
  { value: "spam", label: "Spam or promotional content" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "other", label: "Other concern" },
];

export default function ReportButton({ recordingId, userId, callId, reviewId, seriesId, forumThreadId, contentTitle }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId,
          reportedUserId: userId,
          callId,
          reviewId,
          seriesId,
          forumThreadId,
          reason,
          details,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setReason("");
        setDetails("");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  // Determine content type for display
  const contentType = forumThreadId ? "thread" : seriesId ? "series" : reviewId ? "review" : recordingId ? "recording" : userId ? "user" : "call";

  return (
    <>
      {/* Report Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 text-sm"
        title="Report this content"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>
        Report
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            {submitted ? (
              <div className="text-center py-8">
                <div className="bg-green-100 rounded-full p-3 w-fit mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-green-600">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Report Submitted</h3>
                <p className="text-gray-600 mt-1">Thank you for helping keep our community safe.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Report {contentType}</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>

                {contentTitle && (
                  <p className="text-sm text-gray-600 mb-4">
                    Reporting: <span className="font-medium">{contentTitle}</span>
                  </p>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for report *
                    </label>
                    <div className="space-y-2">
                      {REPORT_REASONS.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reason"
                            value={r.value}
                            checked={reason === r.value}
                            onChange={(e) => setReason(e.target.value)}
                            className="text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-teal-500 focus:border-teal-500"
                      placeholder="Please describe your concern..."
                    />
                  </div>

                  {error && (
                    <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!reason || submitting}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                        reason && !submitting
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {submitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
