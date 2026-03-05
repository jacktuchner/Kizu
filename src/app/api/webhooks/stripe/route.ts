import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";
import { sendGroupSessionSignupEmail, sendCallBookedEmail } from "@/lib/email";
import { createRoom } from "@/lib/daily";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.expired":
        console.log("Checkout session expired:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { type, userId, recordingId, callId, contributorId, scheduledAt, durationMinutes, questionsInAdvance, seriesId, recordingIds, groupSessionId } = session.metadata || {};

  if (type === "recording_purchase" && userId && recordingId) {
    await handleRecordingPurchase(session, userId, recordingId);
  } else if (type === "call_payment" && userId && contributorId) {
    await handleCallPayment(session, userId, contributorId, scheduledAt, durationMinutes, questionsInAdvance);
  } else if (type === "series_purchase" && userId && seriesId) {
    await handleSeriesPurchase(session, userId, seriesId, recordingIds);
  } else if (type === "group_session_payment" && userId && groupSessionId) {
    await handleGroupSessionPayment(session, userId, groupSessionId);
  }
}

async function handleRecordingPurchase(
  session: Stripe.Checkout.Session,
  userId: string,
  recordingId: string
) {
  const paymentId = uuidv4();
  const accessId = uuidv4();
  const amount = (session.amount_total || 0) / 100;

  // Fetch recording with guide info
  const { data: recording, error: recordingError } = await supabase
    .from("Recording")
    .select("*, guide:User!Recording_contributorId_fkey(id, stripeConnectId, stripeConnectOnboarded)")
    .eq("id", recordingId)
    .single();

  if (recordingError || !recording) {
    console.error("Error fetching recording:", recordingError);
    throw recordingError || new Error("Recording not found");
  }

  // Calculate payout amounts (75% to guide, 25% platform fee)
  const guidePayout = amount * 0.75;
  const platformFee = amount * 0.25;

  // Create payment record with payout tracking
  const { error: paymentError } = await supabase.from("Payment").insert({
    id: paymentId,
    userId,
    type: "RECORDING_PURCHASE",
    amount,
    currency: session.currency || "usd",
    status: "COMPLETED",
    stripePaymentId: session.payment_intent as string,
    stripeSessionId: session.id,
    metadata: { recordingId, contributorPayout: guidePayout, platformFee },
    createdAt: new Date().toISOString(),
  });

  if (paymentError) {
    console.error("Error creating payment record:", paymentError);
    throw paymentError;
  }

  // Create recording access
  const { error: accessError } = await supabase.from("RecordingAccess").insert({
    id: accessId,
    userId,
    recordingId,
    paymentId,
    grantedAt: new Date().toISOString(),
  });

  if (accessError) {
    console.error("Error creating recording access:", accessError);
    throw accessError;
  }

  // Transfer payout to guide if they have Stripe Connect set up
  if (recording.guide?.stripeConnectId && recording.guide?.stripeConnectOnboarded) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(guidePayout * 100), // Convert to cents
        currency: "usd",
        destination: recording.guide.stripeConnectId,
        transfer_group: `recording_${recording.id}`,
        metadata: {
          recordingId: recording.id,
          contributorId: recording.guide.id,
          buyerId: userId,
        },
      });

      // Record the payout
      await supabase.from("Payment").insert({
        id: uuidv4(),
        userId: recording.guide.id,
        type: "GUIDE_PAYOUT",
        amount: guidePayout,
        currency: "usd",
        status: "COMPLETED",
        stripePaymentId: transfer.id,
        metadata: { recordingId: recording.id, transferId: transfer.id, purchasePaymentId: paymentId },
        createdAt: new Date().toISOString(),
      });

      console.log(`Payout created for recording ${recording.id}: $${guidePayout.toFixed(2)}`);
    } catch (payoutError) {
      // Log but don't fail the purchase - the recording access was still granted
      console.error("Error creating recording payout:", payoutError);
    }
  } else {
    console.log(`Skipping payout for recording ${recording.id}: guide not onboarded to Stripe Connect`);
  }

  console.log(`Recording purchase completed: user ${userId}, recording ${recordingId}`);
}

async function handleCallPayment(
  session: Stripe.Checkout.Session,
  userId: string,
  contributorId: string,
  scheduledAt?: string,
  durationMinutes?: string,
  questionsInAdvance?: string
) {
  if (!scheduledAt) {
    throw new Error("Missing scheduledAt in call payment metadata");
  }

  // Get guide to calculate pricing
  const { data: guide, error: guideError } = await supabase
    .from("User")
    .select("*, profile:Profile(*)")
    .eq("id", contributorId)
    .single();

  if (guideError || !guide?.profile) {
    throw new Error("Guide not found");
  }

  const rate = guide.profile.hourlyRate || 50;
  const duration = parseInt(durationMinutes || "30");
  const price = (session.amount_total || 0) / 100;
  const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
  const guidePayout = price - platformFee;

  const paymentId = uuidv4();
  const callId = uuidv4();

  // Create payment record
  const { error: paymentError } = await supabase.from("Payment").insert({
    id: paymentId,
    userId,
    type: "CALL_PAYMENT",
    amount: price,
    currency: session.currency || "usd",
    status: "COMPLETED",
    stripePaymentId: session.payment_intent as string,
    stripeSessionId: session.id,
    metadata: { contributorId, callId, description: `${duration}-min call with ${guide.name || "Guide"}` },
    createdAt: new Date().toISOString(),
  });

  if (paymentError) {
    console.error("Error creating payment record:", paymentError);
    throw paymentError;
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
    contributorPayout: guidePayout,
    status: "CONFIRMED",
    videoRoomUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (callError) {
    console.error("Error creating call record:", callError);
    throw callError;
  }

  // Send emails to both parties
  const { data: seeker } = await supabase
    .from("User")
    .select("name, email, profile:Profile(activeProcedureType, recoveryGoals, surgeryDate, timeSinceSurgery)")
    .eq("id", userId)
    .single();

  // Notification email to guide (no confirm/decline needed)
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

  console.log(`Call auto-confirmed: seeker ${userId}, guide ${contributorId}`);
}

async function handleSeriesPurchase(
  session: Stripe.Checkout.Session,
  userId: string,
  seriesId: string,
  recordingIds?: string
) {
  const paymentId = uuidv4();
  const amount = (session.amount_total || 0) / 100;

  // Fetch series with guide info
  const { data: series, error: seriesError } = await supabase
    .from("RecordingSeries")
    .select("*, guide:User!RecordingSeries_contributorId_fkey(id, stripeConnectId, stripeConnectOnboarded)")
    .eq("id", seriesId)
    .single();

  if (seriesError || !series) {
    console.error("Error fetching series:", seriesError);
    throw seriesError || new Error("Series not found");
  }

  // Calculate payout amounts (75% to guide, 25% platform fee)
  const guidePayout = amount * 0.75;
  const platformFee = amount * 0.25;

  // Create payment record
  const { error: paymentError } = await supabase.from("Payment").insert({
    id: paymentId,
    userId,
    type: "RECORDING_PURCHASE", // Use same type for payment tracking
    amount,
    currency: session.currency || "usd",
    status: "COMPLETED",
    stripePaymentId: session.payment_intent as string,
    stripeSessionId: session.id,
    metadata: { seriesId, contributorPayout: guidePayout, platformFee, type: "series_purchase" },
    createdAt: new Date().toISOString(),
  });

  if (paymentError) {
    console.error("Error creating payment record:", paymentError);
    throw paymentError;
  }

  // Create series access
  const seriesAccessId = uuidv4();
  const { error: seriesAccessError } = await supabase.from("SeriesAccess").insert({
    id: seriesAccessId,
    userId,
    seriesId,
    paymentId,
    grantedAt: new Date().toISOString(),
  });

  if (seriesAccessError) {
    console.error("Error creating series access:", seriesAccessError);
    throw seriesAccessError;
  }

  // Create RecordingAccess for ALL recordings in series
  const recordingIdList = recordingIds ? recordingIds.split(",") : [];

  if (recordingIdList.length > 0) {
    const recordingAccessRecords = recordingIdList.map((recordingId: string) => ({
      id: uuidv4(),
      userId,
      recordingId: recordingId.trim(),
      paymentId: null, // Series purchase, not individual
      grantedAt: new Date().toISOString(),
    }));

    // Use upsert to handle any duplicate access gracefully
    for (const accessRecord of recordingAccessRecords) {
      const { error: accessError } = await supabase
        .from("RecordingAccess")
        .upsert(accessRecord, { onConflict: "userId,recordingId" });

      if (accessError) {
        console.error(`Error creating recording access for ${accessRecord.recordingId}:`, accessError);
        // Continue with other recordings even if one fails
      }
    }
  }

  // Transfer payout to guide if they have Stripe Connect set up
  if (series.guide?.stripeConnectId && series.guide?.stripeConnectOnboarded) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(guidePayout * 100), // Convert to cents
        currency: "usd",
        destination: series.guide.stripeConnectId,
        transfer_group: `series_${series.id}`,
        metadata: {
          seriesId: series.id,
          contributorId: series.guide.id,
          buyerId: userId,
        },
      });

      // Record the payout
      await supabase.from("Payment").insert({
        id: uuidv4(),
        userId: series.guide.id,
        type: "GUIDE_PAYOUT",
        amount: guidePayout,
        currency: "usd",
        status: "COMPLETED",
        stripePaymentId: transfer.id,
        metadata: { seriesId: series.id, transferId: transfer.id, purchasePaymentId: paymentId },
        createdAt: new Date().toISOString(),
      });

      console.log(`Payout created for series ${series.id}: $${guidePayout.toFixed(2)}`);
    } catch (payoutError) {
      // Log but don't fail the purchase - the series access was still granted
      console.error("Error creating series payout:", payoutError);
    }
  } else {
    console.log(`Skipping payout for series ${series.id}: guide not onboarded to Stripe Connect`);
  }

  console.log(`Series purchase completed: user ${userId}, series ${seriesId}, recordings: ${recordingIdList.length}`);
}

async function handleGroupSessionPayment(
  session: Stripe.Checkout.Session,
  userId: string,
  groupSessionId: string
) {
  const paymentId = uuidv4();
  const amount = (session.amount_total || 0) / 100;

  // Create payment record
  const { error: paymentError } = await supabase.from("Payment").insert({
    id: paymentId,
    userId,
    type: "GROUP_SESSION_PAYMENT",
    amount,
    currency: session.currency || "usd",
    status: "COMPLETED",
    stripePaymentId: session.payment_intent as string,
    stripeSessionId: session.id,
    metadata: { groupSessionId, description: "Group Session Registration" },
    createdAt: new Date().toISOString(),
  });

  if (paymentError) {
    console.error("Error creating group session payment:", paymentError);
    throw paymentError;
  }

  // Create participant record
  const { error: participantError } = await supabase.from("GroupSessionParticipant").insert({
    id: uuidv4(),
    groupSessionId,
    userId,
    pricePaid: amount,
    paymentId,
    stripeSessionId: session.id,
    status: "REGISTERED",
    createdAt: new Date().toISOString(),
  });

  if (participantError) {
    console.error("Error creating group session participant:", participantError);
    throw participantError;
  }

  // Send signup confirmation email
  const { data: user } = await supabase
    .from("User")
    .select("email, name")
    .eq("id", userId)
    .single();

  const { data: groupSession } = await supabase
    .from("GroupSession")
    .select("title, scheduledAt, contributorId")
    .eq("id", groupSessionId)
    .single();

  if (user?.email && groupSession) {
    await sendGroupSessionSignupEmail(
      user.email,
      user.name || "there",
      groupSession.title,
      new Date(groupSession.scheduledAt)
    );
  }

  // Notify guide of new participant
  if (groupSession) {
    const { data: guide } = await supabase
      .from("User")
      .select("email, name")
      .eq("id", groupSession.contributorId)
      .single();

    if (guide?.email) {
      // Reuse the signup email pattern but for the guide
      console.log(`New participant ${user?.name} signed up for group session ${groupSession.title} (guide: ${guide.email})`);
    }
  }

  console.log(`Group session payment completed: user ${userId}, session ${groupSessionId}`);
}

