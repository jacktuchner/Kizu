import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { calculateMatchScore } from "@/lib/matching";
import { getPublicDisplayName } from "@/lib/displayName";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const procedure = searchParams.get("procedure");
    const matchProcedure = searchParams.get("matchProcedure");
    const ageRange = searchParams.get("ageRange");
    const gender = searchParams.get("gender");
    const activityLevel = searchParams.get("activityLevel");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

    let query = supabase
      .from("Recording")
      .select("*, guide:User!Recording_contributorId_fkey(id, name, displayName, showRealName, bio, contributorStatus, profile:Profile(*)), reviews:Review(*)", { count: "exact" })
      .eq("status", "PUBLISHED");

    if (procedure) query = query.eq("procedureType", procedure);
    if (ageRange) query = query.eq("ageRange", ageRange);
    if (gender) query = query.eq("gender", gender);
    if (activityLevel) query = query.eq("activityLevel", activityLevel);
    if (category) query = query.eq("category", category);

    const { data: recordings, count, error } = await query
      .order("createdAt", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    const total = count || 0;

    const session = await getServerSession(authOptions);
    let enrichedRecordings: unknown[] = recordings || [];

    if (session?.user) {
      const { data: userProfile } = await supabase
        .from("Profile")
        .select("*")
        .eq("userId", (session.user as Record<string, string>).id)
        .single();

      if (userProfile && recordings) {
        // Use matchProcedure query param if provided, otherwise fall back to activeProcedureType
        const activeProc = matchProcedure || userProfile.activeProcedureType || userProfile.procedureType;

        // Get per-procedure attributes from procedureProfiles, fallback to legacy fields
        const procProfiles = userProfile.procedureProfiles || {};
        const activeProcProfile = procProfiles[activeProc] || {};

        const seekerGoals = activeProcProfile.recoveryGoals || userProfile.recoveryGoals || [];
        const seekerFactors = activeProcProfile.complicatingFactors || userProfile.complicatingFactors || [];
        const seekerDetails = activeProcProfile.procedureDetails || userProfile.procedureDetails;

        enrichedRecordings = recordings
          .map((rec: any) => {
            const score = calculateMatchScore(
              {
                procedureType: activeProc,
                procedureDetails: seekerDetails,
                ageRange: userProfile.ageRange,
                gender: userProfile.gender,
                activityLevel: userProfile.activityLevel,
                recoveryGoals: seekerGoals,
                complicatingFactors: seekerFactors,
                lifestyleContext: userProfile.lifestyleContext,
              },
              {
                procedureType: rec.procedureType,
                ageRange: rec.ageRange,
                gender: rec.gender || rec.guide?.profile?.gender,
                activityLevel: rec.activityLevel,
                recoveryGoals: rec.recoveryGoals,
                complicatingFactors: rec.guide?.profile?.complicatingFactors || [],
                lifestyleContext: rec.guide?.profile?.lifestyleContext || [],
              }
            );
            return {
              ...rec,
              matchScore: score.score,
              matchBreakdown: score.breakdown,
            };
          })
          .sort((a: any, b: any) => b.matchScore - a.matchScore);
      }
    }

    // Transform guide names to public display names
    const transformedRecordings = (enrichedRecordings as any[]).map((rec) => ({
      ...rec,
      guide: rec.guide
        ? {
            ...rec.guide,
            name: getPublicDisplayName(rec.guide),
            displayName: undefined,
            showRealName: undefined,
          }
        : null,
    }));

    return NextResponse.json({
      recordings: transformedRecordings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
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

    const { data: user, error: userError } = await supabase
      .from("User")
      .select("*, profile:Profile(*)")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!["GUIDE", "BOTH", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Only guides can create recordings" },
        { status: 403 }
      );
    }

    // Gate content creation: require approved guide status
    if (user.role !== "ADMIN" && user.contributorStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Your guide application must be approved before creating content" },
        { status: 403 }
      );
    }

    if (!user.profile) {
      return NextResponse.json(
        { error: "Please complete your profile first" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      category,
      mediaUrl,
      thumbnailUrl,
      durationSeconds,
      isVideo,
      price,
      faqPromptId,
      transcription,
      transcriptionStatus,
      procedureType: overrideProcedure, // Optional override for guides with multiple procedures
      timeSinceSurgery, // Time since this specific surgery
    } = body;

    if (!title || !category || !mediaUrl) {
      return NextResponse.json(
        { error: "Title, category, and media URL are required" },
        { status: 400 }
      );
    }

    // Use override procedure if provided (for guides with multiple procedures)
    const recordingProcedure = overrideProcedure || user.profile.procedureType;

    const { data: recording, error } = await supabase
      .from("Recording")
      .insert({
        id: uuidv4(),
        contributorId: userId,
        title,
        description,
        category,
        mediaUrl,
        thumbnailUrl,
        durationSeconds,
        isVideo: isVideo || false,
        price: price || 4.99,
        procedureType: recordingProcedure,
        timeSinceSurgery: timeSinceSurgery || null,
        ageRange: user.profile.ageRange,
        gender: user.profile.gender || null,
        activityLevel: user.profile.activityLevel,
        recoveryGoals: user.profile.recoveryGoals,
        status: (user.contributorStatus === "APPROVED" || user.role === "ADMIN") ? "PUBLISHED" : "PENDING_REVIEW",
        faqPromptId: faqPromptId || null,
        transcription: transcription || null,
        transcriptionStatus: transcriptionStatus || "NONE",
        viewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select("*, guide:User!Recording_contributorId_fkey(*, profile:Profile(*))")
      .single();

    if (error) throw error;

    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    console.error("Error creating recording:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
