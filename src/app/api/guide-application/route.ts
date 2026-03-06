import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { sendApplicationReceivedEmail, sendApplicationSubmittedEmail } from "@/lib/email";
import { GUIDE_AGREEMENT_VERSION } from "@/lib/constants";

// GET — return current user's application (if any)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const { data: application, error } = await supabase
    .from("ContributorApplication")
    .select("*")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching application:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ application: application || null });
}

// POST — submit application, set role=BOTH + contributorStatus=PENDING_REVIEW
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const guideStatus = (session.user as any).contributorStatus;

  // Block if already approved
  if (guideStatus === "APPROVED") {
    return NextResponse.json({ error: "You are already an approved guide" }, { status: 400 });
  }

  const body = await req.json();
  const { applicationText, applicationData, proofUrls, preferredContact, agreementAccepted, agreementSignature, agreementSignatureImage, agreementVersion } = body;

  if (!applicationText || !preferredContact) {
    return NextResponse.json(
      { error: "Application text and preferred contact are required" },
      { status: 400 }
    );
  }

  if (!agreementAccepted || !agreementSignature?.trim() || !agreementSignatureImage) {
    return NextResponse.json(
      { error: "You must type your name, draw your signature, and accept the Guide Agreement to apply" },
      { status: 400 }
    );
  }

  // Check if an application already exists
  const { data: existing } = await supabase
    .from("ContributorApplication")
    .select("id, status")
    .eq("userId", userId)
    .single();

  if (existing && existing.status === "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "You already have a pending application" },
      { status: 400 }
    );
  }

  // If reapplying after rejection, update existing record
  if (existing) {
    const { error: updateError } = await supabase
      .from("ContributorApplication")
      .update({
        applicationText,
        applicationData: applicationData || null,
        proofUrls: proofUrls || [],
        preferredContact,
        status: "PENDING_REVIEW",
        zoomCompleted: false,
        reviewNote: null,
        reviewedById: null,
        agreementAcceptedAt: new Date().toISOString(),
        agreementSignature: agreementSignature.trim(),
        agreementSignatureImage,
        agreementVersion: agreementVersion || GUIDE_AGREEMENT_VERSION,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Error updating application:", updateError);
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }
  } else {
    // Create new application
    const { error: insertError } = await supabase
      .from("ContributorApplication")
      .insert({
        id: uuidv4(),
        userId,
        applicationText,
        applicationData: applicationData || null,
        proofUrls: proofUrls || [],
        preferredContact,
        status: "PENDING_REVIEW",
        agreementAcceptedAt: new Date().toISOString(),
        agreementSignature: agreementSignature.trim(),
        agreementSignatureImage,
        agreementVersion: agreementVersion || GUIDE_AGREEMENT_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error creating application:", insertError);
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }
  }

  // Set contributorStatus to PENDING_REVIEW and role to BOTH so they can see the guide dashboard
  const { data: currentUser } = await supabase
    .from("User")
    .select("role")
    .eq("id", userId)
    .single();

  const newRole = currentUser?.role === "SEEKER" ? "BOTH" : currentUser?.role;

  const { error: userError } = await supabase
    .from("User")
    .update({
      contributorStatus: "PENDING_REVIEW",
      role: newRole,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", userId);

  if (userError) {
    console.error("Error updating user:", userError);
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
  }

  // Send confirmation email to the applicant
  const applicantName = (session.user as any).name || "Unknown";
  const applicantEmail = (session.user as any).email || "";
  if (applicantEmail) {
    sendApplicationSubmittedEmail(applicantEmail, applicantName).catch(() => {});
  }

  // Notify all admins about the new application
  const { data: admins } = await supabase
    .from("User")
    .select("email, name")
    .eq("role", "ADMIN");
  if (admins?.length) {
    for (const admin of admins) {
      sendApplicationReceivedEmail(admin.email, admin.name || "Admin", applicantName, applicantEmail).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, status: "PENDING_REVIEW" }, { status: 201 });
}
