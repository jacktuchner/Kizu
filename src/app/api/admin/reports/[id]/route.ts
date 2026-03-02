import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const REPORT_SELECT = `
  *,
  reporter:User!Report_reporterId_fkey(id, name, email),
  recording:Recording(id, title, contributorId),
  reportedUser:User!Report_userId_fkey(id, name, email),
  call:Call(id, scheduledAt, patientId, contributorId),
  review:Review(id, rating, comment, authorId, subjectId),
  series:RecordingSeries(id, title, contributorId),
  forumThread:ForumThread(id, title, authorId)
`;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, adminNotes, action } = body;

    if (!status || !["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING, REVIEWED, ACTION_TAKEN, or DISMISSED" },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;
    const isResolved = status !== "PENDING";

    // First fetch the report to get relation data for side effects
    const { data: existingReport, error: fetchError } = await supabase
      .from("Report")
      .select(REPORT_SELECT)
      .eq("id", id)
      .single();

    if (fetchError || !existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Handle action side effects
    if (action === "removeContent") {
      // Unpublish recording
      if (existingReport.recordingId) {
        await supabase
          .from("Recording")
          .update({ status: "REJECTED", updatedAt: new Date().toISOString() })
          .eq("id", existingReport.recordingId);
      }
      // Archive series
      if (existingReport.seriesId) {
        await supabase
          .from("RecordingSeries")
          .update({ status: "ARCHIVED", updatedAt: new Date().toISOString() })
          .eq("id", existingReport.seriesId);
      }
      // Delete forum thread
      if (existingReport.forumThreadId) {
        await supabase
          .from("ForumThread")
          .delete()
          .eq("id", existingReport.forumThreadId);
      }
      // Delete review
      if (existingReport.reviewId) {
        await supabase
          .from("Review")
          .delete()
          .eq("id", existingReport.reviewId);
      }
    }

    if (action === "suspendGuide") {
      // Identify the guide from the report relations
      const guideId =
        existingReport.recording?.contributorId ||
        existingReport.series?.contributorId ||
        existingReport.forumThread?.authorId ||
        existingReport.userId;

      if (guideId) {
        await supabase
          .from("User")
          .update({
            contributorStatus: "SUSPENDED",
            updatedAt: new Date().toISOString(),
          })
          .eq("id", guideId);
      }
    }

    // Update the report status
    const { data: report, error } = await supabase
      .from("Report")
      .update({
        status,
        adminNotes: adminNotes || null,
        resolvedBy: isResolved ? userId : null,
        resolvedAt: isResolved ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select(REPORT_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data: report, error } = await supabase
      .from("Report")
      .select(REPORT_SELECT)
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
