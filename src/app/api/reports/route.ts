import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const body = await req.json();
    const { recordingId, reportedUserId, callId, reviewId, seriesId, forumThreadId, reason, details } = body;

    // Validate that at least one target is specified
    if (!recordingId && !reportedUserId && !callId && !reviewId && !seriesId && !forumThreadId) {
      return NextResponse.json(
        { error: "Must specify a report target (recordingId, reportedUserId, callId, reviewId, seriesId, or forumThreadId)" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    // Check if user already reported this content
    let existingQuery = supabase
      .from("Report")
      .select("id")
      .eq("reporterId", userId);

    if (forumThreadId) {
      existingQuery = existingQuery.eq("forumThreadId", forumThreadId);
    } else if (seriesId) {
      existingQuery = existingQuery.eq("seriesId", seriesId);
    } else if (reviewId) {
      existingQuery = existingQuery.eq("reviewId", reviewId);
    } else if (recordingId) {
      existingQuery = existingQuery.eq("recordingId", recordingId);
    } else if (reportedUserId) {
      existingQuery = existingQuery.eq("userId", reportedUserId);
    } else if (callId) {
      existingQuery = existingQuery.eq("callId", callId);
    }

    const { data: existing } = await existingQuery.single();

    if (existing) {
      return NextResponse.json(
        { error: "You have already reported this content" },
        { status: 409 }
      );
    }

    const { data: report, error } = await supabase
      .from("Report")
      .insert({
        id: uuidv4(),
        reporterId: userId,
        recordingId: recordingId || null,
        userId: reportedUserId || null,
        callId: callId || null,
        reviewId: reviewId || null,
        seriesId: seriesId || null,
        forumThreadId: forumThreadId || null,
        reason,
        details: details || null,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Admin only: fetch all reports
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // "recording", "user", "call", "review", "series", "thread"

    let query = supabase
      .from("Report")
      .select(`
        *,
        reporter:User!Report_reporterId_fkey(id, name, email),
        recording:Recording(id, title, contributorId),
        reportedUser:User!Report_userId_fkey(id, name, email),
        call:Call(id, scheduledAt, patientId, contributorId),
        review:Review(id, rating, comment, authorId, subjectId),
        series:RecordingSeries(id, title, contributorId),
        forumThread:ForumThread(id, title, authorId)
      `)
      .order("createdAt", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (type === "recording") {
      query = query.not("recordingId", "is", null);
    } else if (type === "user") {
      query = query.not("userId", "is", null);
    } else if (type === "call") {
      query = query.not("callId", "is", null);
    } else if (type === "review") {
      query = query.not("reviewId", "is", null);
    } else if (type === "series") {
      query = query.not("seriesId", "is", null);
    } else if (type === "thread") {
      query = query.not("forumThreadId", "is", null);
    }

    const { data: reports, error } = await query;

    if (error) throw error;

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
