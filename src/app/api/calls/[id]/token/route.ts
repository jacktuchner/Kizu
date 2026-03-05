import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createMeetingToken } from "@/lib/daily";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as Record<string, string>).id;
    const userName = session.user.name || "User";

    const { data: call, error } = await supabase
      .from("Call")
      .select("id, patientId, contributorId, videoRoomUrl")
      .eq("id", id)
      .single();

    if (error || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (call.patientId !== userId && call.contributorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!call.videoRoomUrl) {
      return NextResponse.json({ error: "No video room for this call" }, { status: 400 });
    }

    // Extract room name from URL (e.g. https://domain.daily.co/call-xxx → call-xxx)
    const roomName = call.videoRoomUrl.split("/").pop()!;
    const isOwner = userId === call.contributorId;

    const token = await createMeetingToken({
      roomName,
      userName,
      userId,
      isOwner,
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error generating meeting token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
