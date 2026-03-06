import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const { searchParams } = new URL(req.url);
    const procedureType = searchParams.get("procedureType");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const offset = (page - 1) * limit;

    // Build query - procedureType is optional (omit for "View All")
    let countQuery = supabase
      .from("JournalEntry")
      .select("id", { count: "exact", head: true })
      .eq("patientId", userId);

    let dataQuery = supabase
      .from("JournalEntry")
      .select("*")
      .eq("patientId", userId)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (procedureType) {
      countQuery = countQuery.eq("procedureType", procedureType);
      dataQuery = dataQuery.eq("procedureType", procedureType);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    // Get paginated entries
    const { data: entries, error } = await dataQuery;

    if (error) throw error;

    const total = count || 0;

    return NextResponse.json({
      entries: entries || [],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const body = await req.json();
    const {
      procedureType,
      painLevel,
      mobilityLevel,
      mood,
      notes,
      milestones,
      isShared,
      surgeryDate,
      triggers,
      isFlare,
      energyLevel,
      conditionCategory,
    } = body;

    if (!procedureType) {
      return NextResponse.json(
        { error: "procedureType is required" },
        { status: 400 }
      );
    }

    if (painLevel === undefined || painLevel < 0 || painLevel > 10) {
      return NextResponse.json(
        { error: "painLevel must be 0-10" },
        { status: 400 }
      );
    }

    if (mobilityLevel === undefined || mobilityLevel < 0 || mobilityLevel > 10) {
      return NextResponse.json(
        { error: "mobilityLevel must be 0-10" },
        { status: 400 }
      );
    }

    if (!mood || mood < 1 || mood > 5) {
      return NextResponse.json(
        { error: "mood must be 1-5" },
        { status: 400 }
      );
    }

    const shareFlag = isShared || false;

    // Compute recoveryWeek from surgeryDate (skip for chronic pain)
    let recoveryWeek: number | null = null;
    if (surgeryDate && conditionCategory !== "CHRONIC_PAIN") {
      const surgery = new Date(surgeryDate);
      const now = new Date();
      const diffMs = now.getTime() - surgery.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        recoveryWeek = Math.ceil(diffDays / 7);
      }
    }

    const now = new Date().toISOString();
    const { data: entry, error } = await supabase
      .from("JournalEntry")
      .insert({
        id: uuidv4(),
        patientId: userId,
        procedureType,
        recoveryWeek,
        painLevel,
        mobilityLevel,
        mood,
        notes: notes || null,
        milestones: milestones || [],
        triggers: triggers || [],
        isFlare: isFlare || false,
        energyLevel: energyLevel ?? null,
        isShared: shareFlag,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating journal entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
