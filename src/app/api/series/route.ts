import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPublicDisplayName } from "@/lib/displayName";
import { calculateMatchScore } from "@/lib/matching";
import { v4 as uuidv4 } from "uuid";

// GET /api/series - List series with optional filtering
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const procedure = searchParams.get("procedure");
    const guideId = searchParams.get("contributorId");
    const status = searchParams.get("status"); // null means all statuses for own series
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

    // Check if user is viewing their own series
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    const isOwnSeries = guideId && userId === guideId;

    let query = supabase
      .from("RecordingSeries")
      .select(
        `*,
        guide:User!RecordingSeries_contributorId_fkey(id, name, displayName, showRealName, profile:Profile(*)),
        recordings:SeriesRecording(
          id, sequenceNumber,
          recording:Recording(id, title, price, durationSeconds, isVideo, status, ageRange, activityLevel, recoveryGoals)
        )`,
        { count: "exact" }
      );

    // Filter by status - if viewing own series and no status specified, show all
    // Otherwise default to PUBLISHED for public viewing
    if (status) {
      query = query.eq("status", status);
    } else if (!isOwnSeries) {
      query = query.eq("status", "PUBLISHED");
    }
    // If isOwnSeries and no status, don't filter by status (show all)

    if (procedure) query = query.eq("procedureType", procedure);
    if (guideId) query = query.eq("contributorId", guideId);

    const { data: series, count, error } = await query
      .order("createdAt", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    const total = count || 0;

    // Get user profile for match scoring
    let userProfile: any = null;
    if (session?.user) {
      const { data: profile } = await supabase
        .from("Profile")
        .select("*")
        .eq("userId", userId)
        .single();
      userProfile = profile;
    }

    // Transform series data
    let transformedSeries = (series || []).map((s: any) => {
      // Sort recordings by sequence number
      const sortedRecordings = (s.recordings || [])
        .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber)
        .map((sr: any) => sr.recording)
        .filter((r: any) => r && r.status === "PUBLISHED");

      // Calculate pricing
      const totalValue = sortedRecordings.reduce((sum: number, r: any) => sum + (r?.price || 0), 0);
      const discountedPrice = totalValue * (1 - s.discountPercent / 100);
      const totalDuration = sortedRecordings.reduce((sum: number, r: any) => sum + (r?.durationSeconds || 0), 0);

      // Calculate match score if user is logged in
      let matchScore: number | undefined;
      let matchBreakdown: { attribute: string; matched: boolean; weight: number }[] | undefined;
      if (userProfile) {
        const activeProc = userProfile.activeProcedureType || userProfile.procedureType;
        const procProfiles = userProfile.procedureProfiles || {};
        const activeProcProfile = procProfiles[activeProc] || {};

        const seekerGoals = activeProcProfile.recoveryGoals || userProfile.recoveryGoals || [];
        const seekerFactors = activeProcProfile.complicatingFactors || userProfile.complicatingFactors || [];

        // Use the first recording's attributes as representative, or fall back to guide profile
        const firstRec = sortedRecordings[0];
        const guideProfile = s.guide?.profile;

        const score = calculateMatchScore(
          {
            procedureType: activeProc,
            ageRange: userProfile.ageRange,
            activityLevel: userProfile.activityLevel,
            recoveryGoals: seekerGoals,
            complicatingFactors: seekerFactors,
            lifestyleContext: userProfile.lifestyleContext || [],
          },
          {
            procedureType: s.procedureType,
            ageRange: firstRec?.ageRange || guideProfile?.ageRange || "",
            activityLevel: firstRec?.activityLevel || guideProfile?.activityLevel || "",
            recoveryGoals: firstRec?.recoveryGoals || guideProfile?.recoveryGoals || [],
            complicatingFactors: guideProfile?.complicatingFactors || [],
            lifestyleContext: guideProfile?.lifestyleContext || [],
          }
        );
        matchScore = score.score;
        matchBreakdown = score.breakdown;
      }

      return {
        ...s,
        guide: s.guide
          ? {
              id: s.guide.id,
              name: getPublicDisplayName(s.guide),
            }
          : null,
        recordings: sortedRecordings,
        recordingCount: sortedRecordings.length,
        totalValue,
        discountedPrice,
        savings: totalValue - discountedPrice,
        totalDuration,
        matchScore,
        matchBreakdown,
      };
    });

    // Sort by match score if user is logged in
    if (userProfile) {
      transformedSeries = transformedSeries.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
    }

    return NextResponse.json({
      series: transformedSeries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching series:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/series - Create a new series (guides only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;

    // Check user is a guide
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
        { error: "Only guides can create series" },
        { status: 403 }
      );
    }

    // Gate content creation: require approved guide status
    if (user.role !== "ADMIN" && user.contributorStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Your guide application must be approved before creating series" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, description, procedureType, discountPercent, recordingIds } = body;

    if (!title || !procedureType) {
      return NextResponse.json(
        { error: "Title and procedure type are required" },
        { status: 400 }
      );
    }

    // Validate discount percent (5-30%)
    const discount = Math.min(30, Math.max(5, discountPercent || 15));

    // Create series
    const seriesId = uuidv4();
    const { data: series, error: seriesError } = await supabase
      .from("RecordingSeries")
      .insert({
        id: seriesId,
        contributorId: userId,
        title,
        description: description || null,
        procedureType,
        discountPercent: discount,
        status: (user.contributorStatus === "APPROVED" || user.role === "ADMIN") && recordingIds?.length >= 2 ? "PUBLISHED" : "DRAFT",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (seriesError) throw seriesError;

    // Add recordings if provided
    if (recordingIds && recordingIds.length > 0) {
      // Verify all recordings belong to this guide
      const { data: recordings, error: recError } = await supabase
        .from("Recording")
        .select("id")
        .eq("contributorId", userId)
        .in("id", recordingIds);

      if (recError) throw recError;

      const validRecordingIds = new Set((recordings || []).map((r: any) => r.id));

      const seriesRecordings = recordingIds
        .filter((id: string) => validRecordingIds.has(id))
        .map((recordingId: string, index: number) => ({
          id: uuidv4(),
          seriesId,
          recordingId,
          sequenceNumber: index + 1,
        }));

      if (seriesRecordings.length > 0) {
        const { error: insertError } = await supabase
          .from("SeriesRecording")
          .insert(seriesRecordings);

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json(series, { status: 201 });
  } catch (error: any) {
    console.error("Error creating series:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
