import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

// GET - Returns all data needed for the guide's availability calendar
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const today = new Date().toISOString().split("T")[0];

    const [slotsResult, overridesResult, callsResult, profileResult] = await Promise.all([
      supabase
        .from("Availability")
        .select("id, dayOfWeek, startTime, endTime, timezone")
        .eq("contributorId", userId)
        .order("dayOfWeek")
        .order("startTime"),
      supabase
        .from("DateOverride")
        .select("id, date, isBlocked, startTime, endTime")
        .eq("contributorId", userId)
        .gte("date", today)
        .order("date")
        .order("startTime"),
      supabase
        .from("Call")
        .select("id, scheduledAt, durationMinutes, status, patient:User!Call_patientId_fkey(name)")
        .eq("contributorId", userId)
        .in("status", ["REQUESTED", "CONFIRMED"])
        .gte("scheduledAt", new Date().toISOString())
        .order("scheduledAt"),
      supabase
        .from("Profile")
        .select("callBufferMinutes, maxCallsPerWeek")
        .eq("userId", userId)
        .single(),
    ]);

    if (slotsResult.error) throw slotsResult.error;

    // Build call count by week
    const callCountByWeek: Record<string, number> = {};
    const calls = (callsResult.data || []).map((c: any) => {
      const scheduledDate = c.scheduledAt.split("T")[0];
      const week = getISOWeek(scheduledDate);
      callCountByWeek[week] = (callCountByWeek[week] || 0) + 1;

      return {
        id: c.id,
        scheduledAt: c.scheduledAt,
        durationMinutes: c.durationMinutes,
        status: c.status,
        seekerName: (c.patient as any)?.name || "Unknown",
      };
    });

    return NextResponse.json({
      slots: slotsResult.data || [],
      overrides: overridesResult.data || [],
      calls,
      callBufferMinutes: profileResult.data?.callBufferMinutes ?? 15,
      maxCallsPerWeek: profileResult.data?.maxCallsPerWeek ?? null,
      callCountByWeek,
    });
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
