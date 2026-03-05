import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { v4 as uuidv4 } from "uuid";
import { sendCallBookedEmail } from "@/lib/email";
import { createRoom } from "@/lib/daily";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify this session belongs to this user and is a call payment
    if (checkoutSession.metadata?.userId !== userId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    if (checkoutSession.metadata?.type !== "call_payment") {
      return NextResponse.json({ error: "Not a call payment session" }, { status: 400 });
    }

    if (checkoutSession.status !== "complete") {
      return NextResponse.json({ error: "Checkout not completed" }, { status: 400 });
    }

    const { contributorId, scheduledAt, durationMinutes, questionsInAdvance } = checkoutSession.metadata;

    if (!contributorId || !scheduledAt) {
      return NextResponse.json({ error: "Missing call metadata" }, { status: 400 });
    }

    // Check if the webhook already created this call (check by stripeSessionId in payment)
    const { data: existingPayment } = await supabase
      .from("Payment")
      .select("id, metadata")
      .eq("stripeSessionId", checkoutSession.id)
      .eq("type", "CALL_PAYMENT")
      .maybeSingle();

    if (existingPayment) {
      // Already processed by webhook — fetch call details for the success page
      const callId = (existingPayment.metadata as any)?.callId;
      if (callId) {
        const { data: existingCall } = await supabase
          .from("Call")
          .select("scheduledAt, durationMinutes, videoRoomUrl, guide:User!Call_contributorId_fkey(name)")
          .eq("id", callId)
          .single();
        return NextResponse.json({
          status: "already_created",
          callId,
          guideName: (existingCall?.guide as any)?.name || "Guide",
          scheduledAt: existingCall?.scheduledAt,
          durationMinutes: existingCall?.durationMinutes,
          videoRoomUrl: existingCall?.videoRoomUrl,
        });
      }
      return NextResponse.json({ status: "already_created", callId });
    }

    // Get guide info for pricing
    const { data: guide, error: contribError } = await supabase
      .from("User")
      .select("*, profile:Profile(*)")
      .eq("id", contributorId)
      .single();

    if (contribError || !guide?.profile) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    const duration = parseInt(durationMinutes || "30");
    const price = (checkoutSession.amount_total || 0) / 100;
    const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
    const contributorPayout = price - platformFee;

    const paymentId = uuidv4();
    const callId = uuidv4();

    // Create payment record
    const { error: paymentError } = await supabase.from("Payment").insert({
      id: paymentId,
      userId,
      type: "CALL_PAYMENT",
      amount: price,
      currency: checkoutSession.currency || "usd",
      status: "COMPLETED",
      stripePaymentId: checkoutSession.payment_intent as string,
      stripeSessionId: checkoutSession.id,
      metadata: { contributorId, callId, description: `${duration}-min call with ${guide.name || "Guide"}` },
      createdAt: new Date().toISOString(),
    });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    }

    // Create Daily.co video room immediately (auto-confirm)
    let videoRoomUrl: string | null = null;
    try {
      const scheduledAtDate = new Date(scheduledAt);
      const expiresAt = new Date(scheduledAtDate.getTime() + (duration + 120) * 60 * 1000);
      const minutesUntilExpiry = Math.max(60, Math.ceil((expiresAt.getTime() - Date.now()) / 60000));

      videoRoomUrl = await createRoom({
        callId,
        expiresInMinutes: minutesUntilExpiry,
        enableChat: true,
        enableScreenshare: true,
      });
      console.log(`Created video room for call ${callId}: ${videoRoomUrl}`);
    } catch (roomError) {
      console.error("Failed to create video room:", roomError);
    }

    // Create call record as CONFIRMED (auto-confirm)
    const { error: callError } = await supabase.from("Call").insert({
      id: callId,
      patientId: userId,
      contributorId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes: duration,
      questionsInAdvance: questionsInAdvance || null,
      price,
      platformFee,
      contributorPayout,
      status: "CONFIRMED",
      videoRoomUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (callError) {
      console.error("Error creating call record:", callError);
      return NextResponse.json({ error: "Failed to create call" }, { status: 500 });
    }

    // Send emails to both parties
    const { data: seeker } = await supabase
      .from("User")
      .select("name, email, profile:Profile(activeProcedureType, recoveryGoals, surgeryDate, timeSinceSurgery)")
      .eq("id", userId)
      .single();

    // Notification email to guide
    if (guide.email) {
      const seekerProfile = seeker?.profile as any;
      const seekerCondition = seekerProfile?.activeProcedureType || undefined;
      const seekerGoals: string[] = seekerProfile?.recoveryGoals || [];
      const seekerSurgeryInfo = seekerProfile?.surgeryDate
        ? seekerProfile.surgeryDate
        : seekerProfile?.timeSinceSurgery || undefined;
      sendCallBookedEmail(
        guide.email,
        guide.name || "Guide",
        seeker?.name || "A seeker",
        new Date(scheduledAt),
        duration,
        questionsInAdvance,
        videoRoomUrl,
        false,
        {
          seekerCondition,
          seekerGoals: seekerGoals.length > 0 ? seekerGoals : undefined,
          seekerSurgeryInfo,
        }
      ).catch((err) => console.error("Failed to send call booked email:", err));
    }

    // Confirmation email to seeker with video link
    if (seeker?.email) {
      const guideProfile = guide.profile as any;
      const guideSurgeryInfo = guideProfile?.timeSinceSurgery || undefined;
      sendCallBookedEmail(
        seeker.email,
        seeker.name || "there",
        guide.name || "your guide",
        new Date(scheduledAt),
        duration,
        undefined,
        videoRoomUrl,
        true, // isSeeker
        {
          guideConditions: guideProfile?.procedureTypes || undefined,
          guideSurgeryInfo,
          guideBio: guide.bio || undefined,
        }
      ).catch((err) => console.error("Failed to send call confirmed email to seeker:", err));
    }

    return NextResponse.json({
      status: "created",
      callId,
      guideName: guide.name || "Guide",
      scheduledAt,
      durationMinutes: duration,
      videoRoomUrl,
    });
  } catch (error) {
    console.error("Error verifying call checkout:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
