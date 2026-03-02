"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PROCEDURE_TYPES, CHRONIC_PAIN_CONDITIONS, FORUM_THREAD_TYPES, FORUM_PAGE_SIZE, getAllConditions } from "@/lib/constants";
import VerifiedBadge from "@/components/VerifiedBadge";

function timeAgo(dateStr: string) {
  const now = Date.now();
  const d = dateStr.endsWith("Z") || dateStr.includes("+") ? new Date(dateStr) : new Date(dateStr + "Z");
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

const threadTypeColors: Record<string, string> = {
  DISCUSSION: "bg-blue-50 text-blue-700",
  QUESTION: "bg-purple-50 text-purple-700",
  EXPERIENCE: "bg-amber-50 text-amber-700",
  TIP: "bg-green-50 text-green-700",
};

export default function CommunityPage() {
  const { data: session, status } = useSession();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [procedure, setProcedure] = useState("");
  const [threadType, setThreadType] = useState("");
  const [sort, setSort] = useState("active");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // New thread form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newProcedure, setNewProcedure] = useState("");
  const [newType, setNewType] = useState("DISCUSSION");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // User profile for "Your Boards"
  const [userProcedures, setUserProcedures] = useState<string[]>([]);

  const userRole = (session?.user as any)?.role;
  const isGuide = userRole === "GUIDE" || userRole === "BOTH" || userRole === "ADMIN";

  useEffect(() => {
    if (!session?.user) return;
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const p = await res.json();
          if (p?.procedureTypes?.length) {
            setUserProcedures(p.procedureTypes);
          } else if (p?.procedureType) {
            setUserProcedures([p.procedureType]);
          }
        }
      } catch {}
    }
    loadProfile();
  }, [session]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, page, procedure, threadType, sort, search]);

  async function fetchThreads() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (procedure) params.set("procedure", procedure);
      if (threadType) params.set("type", threadType);
      if (sort) params.set("sort", sort);
      if (search) params.set("search", search);

      const res = await fetch(`/api/forum/threads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!newTitle.trim() || !newContent.trim() || !newProcedure) {
      setFormError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          procedureType: newProcedure,
          threadType: newType,
        }),
      });
      if (res.ok) {
        const thread = await res.json();
        setThreads((prev) => [thread, ...prev]);
        setNewTitle("");
        setNewContent("");
        setNewProcedure("");
        setNewType("DISCUSSION");
        setShowForm(false);
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to create thread");
      }
    } catch {
      setFormError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  // Auth gate
  if (status !== "loading" && !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-3">Community Forum</h1>
          <p className="text-teal-100 text-lg">Connect with others on similar recovery journeys</p>
        </div>
        <p className="text-gray-600 mb-6">Sign in to join the conversation.</p>
        <div className="flex justify-center gap-3">
          <Link href="/auth/signin" className="bg-teal-600 text-white px-6 py-2.5 rounded-lg hover:bg-teal-700 font-medium">
            Sign In
          </Link>
          <Link href="/auth/register" className="border border-teal-600 text-teal-600 px-6 py-2.5 rounded-lg hover:bg-teal-50 font-medium">
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 sm:p-8 text-white mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Community Forum</h1>
        <p className="text-teal-100">
          Share experiences, ask questions, and support each other through recovery.
        </p>
      </div>

      {/* Your Boards */}
      {userProcedures.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 mb-2">Your Boards</p>
          <div className="flex flex-wrap gap-2">
            {userProcedures.map((p) => (
              <button
                key={p}
                onClick={() => { setProcedure(procedure === p ? "" : p); setPage(1); }}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  procedure === p
                    ? "bg-teal-50 border-teal-300 text-teal-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={procedure}
          onChange={(e) => { setProcedure(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
        >
          <option value="">All Conditions</option>
          <optgroup label="Surgeries">
            {PROCEDURE_TYPES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </optgroup>
          <optgroup label="Autoimmune">
            {CHRONIC_PAIN_CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        </select>
        <select
          value={threadType}
          onChange={(e) => { setThreadType(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {FORUM_THREAD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="newest">Newest</option>
          <option value="most_replies">Most Replies</option>
        </select>
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search threads..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
          />
          <button type="submit" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm">
            Search
          </button>
        </form>
      </div>

      {/* New Thread Button + Form */}
      <div className="mb-6">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Thread
          </button>
        ) : (
          <form onSubmit={handleCreateThread} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">Start a New Thread</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {formError && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{formError}</div>
            )}
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Thread title"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <select
                value={newProcedure}
                onChange={(e) => setNewProcedure(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
              >
                <option value="">Select condition *</option>
                <optgroup label="Surgeries">
                  {PROCEDURE_TYPES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </optgroup>
                <optgroup label="Autoimmune">
                  {CHRONIC_PAIN_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              </select>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {FORUM_THREAD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post Thread"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Thread List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading threads...</div>
      ) : threads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-3">No threads yet{procedure ? ` for ${procedure}` : ""}.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-teal-600 hover:text-teal-700 font-medium text-sm"
          >
            Start the first conversation
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread: any) => {
            const typeLabel = FORUM_THREAD_TYPES.find((t) => t.value === thread.threadType)?.label || thread.threadType;
            const typeColor = threadTypeColors[thread.threadType] || "bg-gray-50 text-gray-700";
            const authorIsGuide = thread.author?.role === "GUIDE" || thread.author?.role === "BOTH" || thread.author?.role === "ADMIN";
            const isOwnThread = !!session?.user && thread.author?.id === (session.user as any).id;

            return (
              <div
                key={thread.id}
                className={`bg-white border rounded-xl p-4 hover:border-teal-200 transition-colors ${
                  thread.isPinned ? "border-teal-300 bg-teal-50/30" : isOwnThread ? "border-l-2 border-l-teal-300 border-gray-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {thread.isPinned && (
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                          Pinned
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
                        {typeLabel}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {thread.procedureType}
                      </span>
                    </div>
                    <Link
                      href={`/community/${thread.id}`}
                      className="font-medium text-gray-900 hover:text-teal-600 transition-colors line-clamp-1"
                    >
                      {thread.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{thread.author?.name || "Anonymous"}</span>
                      {authorIsGuide && <VerifiedBadge />}
                      <span>&middot;</span>
                      <span>{timeAgo(thread.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-shrink-0">
                    <div className="flex items-center gap-1" title="Replies">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{thread.replyCount || 0}</span>
                    </div>
                    {thread.lastReplyAt && (
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        Last reply {timeAgo(thread.lastReplyAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
