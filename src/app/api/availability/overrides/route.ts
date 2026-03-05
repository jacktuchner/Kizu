import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// GET - Fetch current user's date overrides (future only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("DateOverride")
      .select("*")
      .eq("contributorId", userId)
      .gte("date", today)
      .order("date")
      .order("startTime");

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error fetching date overrides:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a date override
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const userRole = (session.user as any).role;

    if (userRole !== "GUIDE" && userRole !== "BOTH" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Only guides can manage overrides" }, { status: 403 });
    }

    const body = await req.json();
    const { date, isBlocked, startTime, endTime, excludeId } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    // Must be a future date
    const today = new Date().toISOString().split("T")[0];
    if (date <= today) {
      return NextResponse.json({ error: "Can only set overrides for future dates" }, { status: 400 });
    }

    // If blocking, no times needed. If custom hours, validate times.
    if (isBlocked) {
      // Remove any existing overrides for this date and create a blocked one
      await supabase
        .from("DateOverride")
        .delete()
        .eq("contributorId", userId)
        .eq("date", date);

      const { data, error } = await supabase
        .from("DateOverride")
        .insert({
          id: uuidv4(),
          contributorId: userId,
          date,
          isBlocked: true,
          startTime: null,
          endTime: null,
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    // Custom hours override
    if (!startTime || !endTime) {
      return NextResponse.json({ error: "startTime and endTime required for custom hours" }, { status: 400 });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: "Times must be in HH:MM format (24-hour)" }, { status: 400 });
    }

    if (startTime >= endTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    // Check for overlap with existing custom-hours overrides on this date
    const { data: existing } = await supabase
      .from("DateOverride")
      .select("*")
      .eq("contributorId", userId)
      .eq("date", date)
      .eq("isBlocked", false);

    if (existing) {
      for (const ov of existing) {
        // Skip the override being replaced (for edit operations)
        if (excludeId && ov.id === excludeId) continue;
        if (ov.startTime && ov.endTime) {
          if (
            (startTime >= ov.startTime && startTime < ov.endTime) ||
            (endTime > ov.startTime && endTime <= ov.endTime) ||
            (startTime <= ov.startTime && endTime >= ov.endTime)
          ) {
            return NextResponse.json({ error: "This time window overlaps with an existing override" }, { status: 409 });
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("DateOverride")
      .insert({
        id: uuidv4(),
        contributorId: userId,
        date,
        isBlocked: false,
        startTime,
        endTime,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating date override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove a date override
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Override ID is required" }, { status: 400 });
    }

    const { data: override, error: fetchError } = await supabase
      .from("DateOverride")
      .select("contributorId")
      .eq("id", id)
      .single();

    if (fetchError || !override) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }

    if (override.contributorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("DateOverride")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting date override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
