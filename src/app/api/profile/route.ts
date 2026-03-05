import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// Type for per-procedure profile data
interface ProcedureProfileData {
  procedureDetails?: string;
  timeSinceSurgery?: string;
  recoveryGoals?: string[];
  complicatingFactors?: string[];
}

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("Profile")
      .select("*")
      .eq("userId", (session.user as any).id)
      .single();

    // PGRST116 means no rows found, which is fine for new users
    if (error && error.code !== "PGRST116") {
      console.error("Supabase error fetching profile:", error);
      return NextResponse.json({ error: error.message || "Failed to fetch profile" }, { status: 500 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/profile - Create profile
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();

    const { data: existing } = await supabase
      .from("Profile")
      .select("id")
      .eq("userId", userId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Profile already exists. Use PUT to update." }, { status: 409 });
    }

    // Handle procedureTypes array
    const procedureTypes = body.procedureTypes || (body.procedureType ? [body.procedureType] : []);
    const primaryProcedure = body.procedureType || procedureTypes[0] || "";
    const activeProcedure = body.activeProcedureType || primaryProcedure;

    // Build procedureProfiles if not provided
    let procedureProfiles = body.procedureProfiles || {};
    if (primaryProcedure && !procedureProfiles[primaryProcedure]) {
      procedureProfiles[primaryProcedure] = {
        procedureDetails: body.procedureDetails || "",
        timeSinceSurgery: body.timeSinceSurgery || "",
        recoveryGoals: body.recoveryGoals || [],
        complicatingFactors: body.complicatingFactors || [],
      };
    }

    const { data: profile, error } = await supabase
      .from("Profile")
      .insert({
        id: uuidv4(),
        userId,
        procedureType: primaryProcedure,
        procedureTypes: procedureTypes,
        activeProcedureType: activeProcedure,
        procedureProfiles: procedureProfiles,
        // Keep legacy fields for backwards compatibility
        procedureDetails: body.procedureDetails || null,
        surgeryDate: body.surgeryDate || null,
        timeSinceSurgery: body.timeSinceSurgery || null,
        recoveryGoals: body.recoveryGoals || [],
        complicatingFactors: body.complicatingFactors || [],
        // Condition category
        conditionCategory: body.conditionCategory || "SURGERY",
        // Profile-wide fields
        ageRange: body.ageRange,
        gender: body.gender || null,
        activityLevel: body.activityLevel || "RECREATIONAL",
        lifestyleContext: body.lifestyleContext || [],
        hourlyRate: body.hourlyRate || null,
        isAvailableForCalls: body.isAvailableForCalls || false,
        introVideoUrl: body.introVideoUrl || null,
        introVideoDuration: body.introVideoDuration || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error creating profile:", error);
      return NextResponse.json({ error: error.message || "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error: any) {
    console.error("Error creating profile:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// PUT /api/profile - Update profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();

    // Handle procedureTypes array
    const procedureTypes = body.procedureTypes || (body.procedureType ? [body.procedureType] : []);
    const primaryProcedure = body.procedureType || procedureTypes[0] || "";

    // Build update object
    const updateData: Record<string, any> = {
      procedureType: primaryProcedure,
      procedureTypes: procedureTypes,
      // Profile-wide fields
      ageRange: body.ageRange,
      gender: body.gender || null,
      activityLevel: body.activityLevel || "RECREATIONAL",
      lifestyleContext: body.lifestyleContext || [],
      hourlyRate: body.hourlyRate || null,
      isAvailableForCalls: body.isAvailableForCalls || false,
      updatedAt: new Date().toISOString(),
    };

    // Handle conditionCategory
    if (body.conditionCategory !== undefined) {
      updateData.conditionCategory = body.conditionCategory;
    }

    // Handle procedureProfiles
    if (body.procedureProfiles !== undefined) {
      updateData.procedureProfiles = body.procedureProfiles;
    }

    // Keep legacy fields updated for backwards compatibility
    if (body.procedureDetails !== undefined) {
      updateData.procedureDetails = body.procedureDetails || null;
    }
    if (body.surgeryDate !== undefined) {
      updateData.surgeryDate = body.surgeryDate || null;
    }
    if (body.timeSinceSurgery !== undefined) {
      updateData.timeSinceSurgery = body.timeSinceSurgery || null;
    }
    if (body.recoveryGoals !== undefined) {
      updateData.recoveryGoals = body.recoveryGoals || [];
    }
    if (body.complicatingFactors !== undefined) {
      updateData.complicatingFactors = body.complicatingFactors || [];
    }

    // Update activeProcedureType if provided
    if (body.activeProcedureType !== undefined) {
      updateData.activeProcedureType = body.activeProcedureType;
    }

    // Update intro video fields if provided
    if (body.introVideoUrl !== undefined) {
      updateData.introVideoUrl = body.introVideoUrl || null;
    }
    if (body.introVideoDuration !== undefined) {
      updateData.introVideoDuration = body.introVideoDuration || null;
    }

    // Update call scheduling settings if provided
    if (body.callBufferMinutes !== undefined) {
      updateData.callBufferMinutes = body.callBufferMinutes;
    }
    if (body.maxCallsPerWeek !== undefined) {
      updateData.maxCallsPerWeek = body.maxCallsPerWeek === null || body.maxCallsPerWeek === "" ? null : body.maxCallsPerWeek;
    }

    const { data: profile, error } = await supabase
      .from("Profile")
      .update(updateData)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating profile:", error);
      return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
