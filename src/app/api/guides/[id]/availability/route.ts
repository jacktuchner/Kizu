import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

// GET - Public endpoint to fetch a guide's availability
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify the guide exists and is available for calls
    const { data: guide, error: contribError } = await supabase
      .from("User")
      .select("id, profile:Profile(isAvailableForCalls, callBufferMinutes, maxCallsPerWeek)")
      .eq("id", id)
      .single();

    if (contribError || !guide) {
      return NextResponse.json(
        { error: "Guide not found" },
        { status: 404 }
      );
    }

    if (!(guide.profile as any)?.isAvailableForCalls) {
      return NextResponse.json(
        { error: "Guide is not available for calls" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const [slotsResult, callsResult, overridesResult] = await Promise.all([
      supabase
        .from("Availability")
        .select("id, dayOfWeek, startTime, endTime, timezone")
        .eq("contributorId", id)
        .order("dayOfWeek")
        .order("startTime"),
      supabase
        .from("Call")
        .select("scheduledAt, durationMinutes")
        .eq("contributorId", id)
        .in("status", ["REQUESTED", "CONFIRMED"])
        .gte("scheduledAt", new Date().toISOString()),
      supabase
        .from("DateOverride")
        .select("date, isBlocked, startTime, endTime")
        .eq("contributorId", id)
        .gte("date", today)
        .order("date"),
    ]);

    if (slotsResult.error) throw slotsResult.error;

    // Build call count by week for the 14-day window
    const callCountByWeek: Record<string, number> = {};
    const bookedCalls = (callsResult.data || []).map((c) => {
      const scheduledDate = c.scheduledAt.split("T")[0];
      const week = getISOWeek(scheduledDate);
      callCountByWeek[week] = (callCountByWeek[week] || 0) + 1;

      return {
        start: c.scheduledAt,
        end: new Date(new Date(c.scheduledAt).getTime() + c.durationMinutes * 60000).toISOString(),
      };
    });

    // Derive blockedDates from overrides for backward compat
    const blockedDates = (overridesResult.data || [])
      .filter((o: any) => o.isBlocked)
      .map((o: any) => o.date)
      .filter((d: string, i: number, arr: string[]) => arr.indexOf(d) === i);

    const profile = guide.profile as any;

    return NextResponse.json({
      slots: slotsResult.data || [],
      bookedCalls,
      blockedDates,
      dateOverrides: overridesResult.data || [],
      callBufferMinutes: profile?.callBufferMinutes ?? 15,
      maxCallsPerWeek: profile?.maxCallsPerWeek ?? null,
      callCountByWeek,
    });
  } catch (error) {
    console.error("Error fetching guide availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
