"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FORUM_THREAD_TYPES } from "@/lib/constants";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportButton from "@/components/ReportButton";

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

const REPLIES_PAGE_SIZE = 25;

export default function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();

  const [thread, setThread] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyPage, setReplyPage] = useState(1);
  const [replyTotalPages, setReplyTotalPages] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const userId = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;
  const isGuide = userRole === "GUIDE" || userRole === "BOTH" || userRole === "ADMIN";
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (!session?.user) return;
    fetchThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, threadId]);

  async function fetchThread() {
    setLoading(true);
    try {
      const res = await fetch(`/api/forum/threads/${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
        setReplies(data.replies || []);
        // If more than 25 replies, calculate pages
        setReplyTotalPages(Math.ceil((data.thread.replyCount || 0) / REPLIES_PAGE_SIZE));
      } else {
        router.push("/community");
      }
    } catch {
      router.push("/community");
    } finally {
      setLoading(false);
    }
  }

  async function fetchReplies(p: number) {
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/replies?page=${p}`);
      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies || []);
        setReplyTotalPages(data.pagination.totalPages);
        setReplyPage(p);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });
      if (res.ok) {
        const reply = await res.json();
        setReplies((prev) => [...prev, reply]);
        setReplyContent("");
        setThread((prev: any) => prev ? { ...prev, replyCount: (prev.replyCount || 0) + 1 } : prev);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteThread() {
    if (!confirm("Are you sure you want to delete this thread? All replies will be deleted too.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/forum/threads/${threadId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/community");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!confirm("Delete this reply?")) return;
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/replies/${replyId}`, { method: "DELETE" });
      if (res.ok) {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
        setThread((prev: any) => prev ? { ...prev, replyCount: Math.max(0, (prev.replyCount || 0) - 1) } : prev);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTogglePin() {
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/pin`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setThread((prev: any) => prev ? { ...prev, isPinned: data.isPinned } : prev);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">Sign in to view this thread.</p>
        <Link href="/auth/signin" className="bg-teal-600 text-white px-6 py-2.5 rounded-lg hover:bg-teal-700 font-medium">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">
        Loading thread...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">Thread not found.</p>
        <Link href="/community" className="text-teal-600 hover:text-teal-700 font-medium">
          Back to Community
        </Link>
      </div>
    );
  }

  const typeLabel = FORUM_THREAD_TYPES.find((t) => t.value === thread.threadType)?.label || thread.threadType;
  const typeColor = threadTypeColors[thread.threadType] || "bg-gray-50 text-gray-700";
  const authorIsGuide = thread.author?.role === "GUIDE" || thread.author?.role === "BOTH" || thread.author?.role === "ADMIN";
  const canDelete = thread.authorId === userId || isAdmin;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/community" className="text-sm text-teal-600 hover:text-teal-700 font-medium mb-4 inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Community
      </Link>

      {/* Thread Card */}
      <div className={`bg-white border rounded-xl p-6 mb-6 ${thread.isPinned ? "border-teal-300" : "border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
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

        <h1 className="text-xl font-bold text-gray-900 mb-3">{thread.title}</h1>

        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{thread.author?.name || "Anonymous"}</span>
          {authorIsGuide && <VerifiedBadge />}
          <span>&middot;</span>
          <span>{timeAgo(thread.createdAt)}</span>
        </div>

        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
          {thread.content}
        </div>

        {/* Thread Actions */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
          {canDelete && (
            <button
              onClick={handleDeleteThread}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Thread"}
            </button>
          )}
          {isGuide && (
            <button
              onClick={handleTogglePin}
              className="text-sm text-gray-500 hover:text-teal-600 font-medium"
            >
              {thread.isPinned ? "Unpin" : "Pin Thread"}
            </button>
          )}
          <ReportButton forumThreadId={thread.id} contentTitle={thread.title} />
          <span className="text-sm text-gray-400 ml-auto">
            {thread.replyCount || 0} {thread.replyCount === 1 ? "reply" : "replies"}
          </span>
        </div>
      </div>

      {/* Reply Form */}
      <form onSubmit={handleReply} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a reply..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none mb-3"
        />
        <button
          type="submit"
          disabled={submitting || !replyContent.trim()}
          className="bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post Reply"}
        </button>
      </form>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Replies</h2>
          {replies.map((reply: any) => {
            const replyAuthorIsGuide = reply.author?.role === "GUIDE" || reply.author?.role === "BOTH" || reply.author?.role === "ADMIN";
            const canDeleteReply = reply.authorId === userId || isAdmin;

            return (
              <div key={reply.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{reply.author?.name || "Anonymous"}</span>
                    {replyAuthorIsGuide && <VerifiedBadge />}
                    <span className="text-gray-400">&middot;</span>
                    <span className="text-gray-400">{timeAgo(reply.createdAt)}</span>
                  </div>
                  {canDeleteReply && (
                    <button
                      onClick={() => handleDeleteReply(reply.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                  {reply.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply Pagination */}
      {replyTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => fetchReplies(replyPage - 1)}
            disabled={replyPage === 1}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {replyPage} of {replyTotalPages}
          </span>
          <button
            onClick={() => fetchReplies(replyPage + 1)}
            disabled={replyPage === replyTotalPages}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
