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

    const { data: groupSession, error } = await supabase
      .from("GroupSession")
      .select("id, contributorId, videoRoomUrl")
      .eq("id", id)
      .single();

    if (error || !groupSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!groupSession.videoRoomUrl) {
      return NextResponse.json({ error: "No video room for this session" }, { status: 400 });
    }

    const isGuide = userId === groupSession.contributorId;

    // If not the guide, verify the user is a registered participant
    if (!isGuide) {
      const { data: participant } = await supabase
        .from("GroupSessionParticipant")
        .select("id")
        .eq("groupSessionId", id)
        .eq("userId", userId)
        .in("status", ["REGISTERED", "ATTENDED"])
        .maybeSingle();

      if (!participant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const roomName = groupSession.videoRoomUrl.split("/").pop()!;

    const token = await createMeetingToken({
      roomName,
      userName,
      userId,
      isOwner: isGuide,
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
