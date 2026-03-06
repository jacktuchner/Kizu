import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;

    // Verify ownership
    const { data: existing } = await supabase
      .from("JournalEntry")
      .select("patientId")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existing.patientId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to edit this entry" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.painLevel !== undefined) {
      if (body.painLevel < 0 || body.painLevel > 10) {
        return NextResponse.json({ error: "painLevel must be 0-10" }, { status: 400 });
      }
      updates.painLevel = body.painLevel;
    }

    if (body.mobilityLevel !== undefined) {
      if (body.mobilityLevel < 0 || body.mobilityLevel > 10) {
        return NextResponse.json({ error: "mobilityLevel must be 0-10" }, { status: 400 });
      }
      updates.mobilityLevel = body.mobilityLevel;
    }

    if (body.mood !== undefined) {
      if (body.mood < 1 || body.mood > 5) {
        return NextResponse.json({ error: "mood must be 1-5" }, { status: 400 });
      }
      updates.mood = body.mood;
    }

    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.milestones !== undefined) updates.milestones = body.milestones;
    if (body.triggers !== undefined) updates.triggers = body.triggers;
    if (body.isFlare !== undefined) updates.isFlare = body.isFlare;
    if (body.energyLevel !== undefined) updates.energyLevel = body.energyLevel;
    if (body.isShared !== undefined) {
      updates.isShared = !!body.isShared;
    }

    updates.updatedAt = new Date().toISOString();

    const { data: entry, error } = await supabase
      .from("JournalEntry")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating journal entry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const userRole = (session.user as Record<string, string>).role;

    // Verify ownership or admin
    const { data: existing } = await supabase
      .from("JournalEntry")
      .select("patientId")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existing.patientId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Not authorized to delete this entry" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("JournalEntry")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting journal entry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
