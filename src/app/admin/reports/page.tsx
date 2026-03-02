"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Report {
  id: string;
  recordingId: string | null;
  userId: string | null;
  callId: string | null;
  reviewId: string | null;
  seriesId: string | null;
  forumThreadId: string | null;
  reason: string;
  details: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    name: string;
    email: string;
  } | null;
  recording: {
    id: string;
    title: string;
    contributorId: string;
  } | null;
  reportedUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  call: {
    id: string;
    scheduledAt: string;
    patientId: string;
    contributorId: string;
  } | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    authorId: string;
    subjectId: string;
  } | null;
  series: {
    id: string;
    title: string;
    contributorId: string;
  } | null;
  forumThread: {
    id: string;
    title: string;
    authorId: string;
  } | null;
}

const REASON_LABELS: Record<string, string> = {
  medical_advice: "Contains medical advice",
  harmful_content: "Potentially harmful",
  contradicts_doctors: "Contradicts doctors",
  inappropriate: "Inappropriate content",
  misinformation: "Misinformation",
  spam: "Spam",
  harassment: "Harassment",
  other: "Other",
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "ACTION_TAKEN", label: "Action Taken" },
  { value: "DISMISSED", label: "Dismissed" },
];

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  useEffect(() => {
    loadReports();
  }, [statusFilter, typeFilter]);

  async function loadReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(id: string, status: string, notes?: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      if (res.ok) {
        if (statusFilter && status !== statusFilter) {
          setReports((prev) => prev.filter((r) => r.id !== id));
        } else {
          const updated = await res.json();
          setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
        }
        setSelectedReport(null);
        setAdminNotes("");
      }
    } catch (err) {
      console.error("Failed to update report:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAction(id: string, action: string, notes?: string) {
    if (action === "suspendGuide" && !confirmSuspend) {
      setConfirmSuspend(true);
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTION_TAKEN", action, adminNotes: notes }),
      });
      if (res.ok) {
        if (statusFilter && "ACTION_TAKEN" !== statusFilter) {
          setReports((prev) => prev.filter((r) => r.id !== id));
        } else {
          const updated = await res.json();
          setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
        }
        setSelectedReport(null);
        setAdminNotes("");
        setConfirmSuspend(false);
      }
    } catch (err) {
      console.error("Failed to perform action:", err);
    } finally {
      setActionLoading(null);
    }
  }

  function getReportType(report: Report): string {
    if (report.forumThreadId) return "Thread";
    if (report.seriesId) return "Series";
    if (report.reviewId) return "Review";
    if (report.recordingId) return "Recording";
    if (report.userId) return "User";
    if (report.callId) return "Call";
    return "Unknown";
  }

  function getReportTarget(report: Report): string {
    if (report.forumThread) return report.forumThread.title;
    if (report.series) return report.series.title;
    if (report.review) {
      const stars = "\u2605".repeat(report.review.rating) + "\u2606".repeat(5 - report.review.rating);
      const snippet = report.review.comment
        ? report.review.comment.length > 60
          ? report.review.comment.substring(0, 60) + "..."
          : report.review.comment
        : "No comment";
      return `${stars} - ${snippet}`;
    }
    if (report.recording) return report.recording.title;
    if (report.reportedUser) return report.reportedUser.name || report.reportedUser.email;
    if (report.call) return `Call on ${new Date(report.call.scheduledAt).toLocaleDateString()}`;
    return "Unknown";
  }

  function getViewLink(report: Report): string | null {
    if (report.recordingId) return `/recordings/${report.recordingId}`;
    if (report.seriesId) return `/series/${report.seriesId}`;
    if (report.forumThreadId) return `/community/${report.forumThreadId}`;
    return null;
  }

  function getTypeBadgeColor(report: Report): string {
    if (report.forumThreadId) return "bg-green-100 text-green-700";
    if (report.seriesId) return "bg-indigo-100 text-indigo-700";
    if (report.reviewId) return "bg-yellow-100 text-yellow-700";
    if (report.recordingId) return "bg-purple-100 text-purple-700";
    if (report.callId) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  }

  // Check if the report is for content (not a user or call)
  function isContentReport(report: Report): boolean {
    return !!(report.recordingId || report.seriesId || report.forumThreadId || report.reviewId);
  }

  // Check if we can identify a guide to suspend
  function canSuspendGuide(report: Report): boolean {
    return !!(
      report.recording?.contributorId ||
      report.series?.contributorId ||
      report.forumThread?.authorId ||
      report.userId
    );
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Reports</h1>
        <div className="flex gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="recording">Recordings</option>
            <option value="series">Series</option>
            <option value="thread">Forum Threads</option>
            <option value="user">Users</option>
            <option value="call">Calls</option>
            <option value="review">Reviews</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No reports found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const viewLink = getViewLink(report);
            return (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getTypeBadgeColor(report)}`}>
                        {getReportType(report)}
                      </span>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          report.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-700"
                            : report.status === "ACTION_TAKEN"
                            ? "bg-red-100 text-red-700"
                            : report.status === "REVIEWED"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_OPTIONS.find(s => s.value === report.status)?.label || report.status}
                      </span>
                    </div>

                    <p className="font-medium text-gray-900 mb-1">
                      {REASON_LABELS[report.reason] || report.reason}
                    </p>

                    <p className="text-sm text-gray-700 mb-2">
                      Target: <span className="font-medium">{getReportTarget(report)}</span>
                      {viewLink && (
                        <Link href={viewLink} target="_blank" className="ml-2 text-teal-600 hover:text-teal-700 text-xs font-medium">
                          View &rarr;
                        </Link>
                      )}
                    </p>

                    {report.details && (
                      <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">{report.details}</p>
                    )}

                    {report.adminNotes && (
                      <p className="text-sm text-blue-600 mb-3 bg-blue-50 p-2 rounded">
                        <span className="font-medium">Admin notes:</span> {report.adminNotes}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Reported by: {report.reporter?.name || "Unknown"}</span>
                      <span>|</span>
                      <span>{formatDate(report.createdAt)}</span>
                      {report.resolvedAt && (
                        <>
                          <span>|</span>
                          <span>Resolved: {formatDate(report.resolvedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {report.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setConfirmSuspend(false);
                          }}
                          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(report.id, "DISMISSED")}
                          disabled={actionLoading === report.id}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === report.id ? "..." : "Dismiss"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(report.id, "PENDING")}
                        disabled={actionLoading === report.id}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Action Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Report</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Report Type</p>
              <p className="font-medium">{getReportType(selectedReport)}: {getReportTarget(selectedReport)}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Reason</p>
              <p className="font-medium">{REASON_LABELS[selectedReport.reason] || selectedReport.reason}</p>
            </div>

            {selectedReport.details && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Details from reporter</p>
                <p className="bg-gray-50 p-3 rounded text-sm">{selectedReport.details}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Notes (optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Add notes about your decision..."
              />
            </div>

            {confirmSuspend && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">
                  Are you sure you want to suspend this guide? They will not be able to create new content.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleAction(selectedReport.id, "suspendGuide", adminNotes)}
                    disabled={actionLoading === selectedReport.id}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading === selectedReport.id ? "Suspending..." : "Yes, Suspend Guide"}
                  </button>
                  <button
                    onClick={() => setConfirmSuspend(false)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setAdminNotes("");
                  setConfirmSuspend(false);
                }}
                className="py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedReport.id, "DISMISSED", adminNotes)}
                disabled={actionLoading === selectedReport.id}
                className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Dismiss Flag
              </button>
              {isContentReport(selectedReport) && (
                <button
                  onClick={() => handleAction(selectedReport.id, "removeContent", adminNotes)}
                  disabled={actionLoading === selectedReport.id}
                  className="py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading === selectedReport.id ? "..." : "Remove Content"}
                </button>
              )}
              {canSuspendGuide(selectedReport) && !confirmSuspend && (
                <button
                  onClick={() => handleAction(selectedReport.id, "suspendGuide", adminNotes)}
                  disabled={actionLoading === selectedReport.id}
                  className="py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Suspend Guide
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
