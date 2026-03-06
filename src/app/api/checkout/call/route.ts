import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, string>).id;
    const body = await req.json();
    const { contributorId, scheduledAt, durationMinutes, questionsInAdvance } = body;

    if (!contributorId || !scheduledAt) {
      return NextResponse.json(
        { error: "Guide ID and scheduled time are required" },
        { status: 400 }
      );
    }

    // Get the guide
    const { data: guide, error: contribError } = await supabase
      .from("User")
      .select("*, profile:Profile(*)")
      .eq("id", contributorId)
      .single();

    if (contribError || !guide?.profile?.isAvailableForCalls) {
      return NextResponse.json(
        { error: "This guide is not available for calls" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    const duration = durationMinutes || 30;

    // Reject past dates
    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Cannot book a call in the past. Please choose a future date and time." },
        { status: 400 }
      );
    }

    // Reject times not on 15-min intervals
    const minutes = scheduledDate.getMinutes();
    if (![0, 15, 30, 45].includes(minutes)) {
      return NextResponse.json(
        { error: "Call times must be on 15-minute intervals (e.g., 9:00, 9:15, 9:30, 9:45)." },
        { status: 400 }
      );
    }

    // Validate against guide's availability
    const { data: availabilitySlots } = await supabase
      .from("Availability")
      .select("*")
      .eq("contributorId", contributorId);

    if (availabilitySlots && availabilitySlots.length > 0) {
      // Guide has set availability - validate the requested time
      const dayOfWeek = scheduledDate.getDay();
      const requestedTime = scheduledDate.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: availabilitySlots[0]?.timezone || "America/New_York",
      });

      // Calculate end time of the call
      const endDate = new Date(scheduledDate.getTime() + duration * 60 * 1000);
      const requestedEndTime = endDate.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: availabilitySlots[0]?.timezone || "America/New_York",
      });

      // Find a matching availability slot
      const matchingSlot = availabilitySlots.find((slot) => {
        if (slot.dayOfWeek !== dayOfWeek) return false;
        // Check if the entire call fits within the availability window
        return requestedTime >= slot.startTime && requestedEndTime <= slot.endTime;
      });

      if (!matchingSlot) {
        return NextResponse.json(
          {
            error: "The selected time is outside the guide's available hours. Please choose a different time.",
          },
          { status: 400 }
        );
      }
    }
    // If no availability slots are set, allow any time (backward compatibility)

    // Check if the date is blocked (guide's time off) — check both BlockedDate and DateOverride tables
    const requestedDateStr = scheduledDate.toISOString().split("T")[0];

    const [{ data: blockedDate }, { data: blockedOverride }] = await Promise.all([
      supabase
        .from("BlockedDate")
        .select("id")
        .eq("contributorId", contributorId)
        .eq("date", requestedDateStr)
        .maybeSingle(),
      supabase
        .from("DateOverride")
        .select("id")
        .eq("contributorId", contributorId)
        .eq("date", requestedDateStr)
        .eq("isBlocked", true)
        .maybeSingle(),
    ]);

    if (blockedDate || blockedOverride) {
      return NextResponse.json(
        { error: "The guide is unavailable on this date. Please choose a different day." },
        { status: 400 }
      );
    }

    // Get buffer time from guide's profile
    const bufferMinutes = guide.profile.callBufferMinutes ?? 15;
    const bufferMs = bufferMinutes * 60 * 1000;

    // Check for conflicting calls (including buffer time)
    // Widen the search window to account for buffer + max possible call duration
    const searchWindowMs = Math.max(2 * 60 * 60 * 1000, (duration + bufferMinutes) * 60 * 1000 + bufferMs);

    const { data: existingCalls } = await supabase
      .from("Call")
      .select("id, scheduledAt, durationMinutes")
      .eq("contributorId", contributorId)
      .in("status", ["REQUESTED", "CONFIRMED"])
      .gte("scheduledAt", new Date(scheduledDate.getTime() - searchWindowMs).toISOString())
      .lte("scheduledAt", new Date(scheduledDate.getTime() + searchWindowMs).toISOString());

    if (existingCalls && existingCalls.length > 0) {
      const requestedStart = scheduledDate.getTime();
      const requestedEnd = requestedStart + duration * 60 * 1000;

      for (const call of existingCalls) {
        const existingStart = new Date(call.scheduledAt).getTime() - bufferMs;
        const existingEnd = existingStart + (call.durationMinutes || 30) * 60 * 1000 + bufferMs + bufferMs;

        // Simple interval overlap: two intervals overlap if one starts before the other ends
        if (requestedStart < existingEnd && requestedEnd > existingStart) {
          return NextResponse.json(
            { error: "This time slot is already booked. Please choose a different time." },
            { status: 409 }
          );
        }
      }
    }

    // Calculate pricing
    const rate = guide.profile.hourlyRate || 50;
    const price = duration === 60 ? rate : rate / 2;

    // Create Stripe Checkout session
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const formattedDate = scheduledDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${duration}-minute call with ${guide.name || "Guide"}`,
              description: `Scheduled for ${formattedDate}`,
              metadata: {
                contributorId,
                durationMinutes: String(duration),
              },
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "call_payment",
        userId,
        contributorId,
        scheduledAt: scheduledDate.toISOString(),
        durationMinutes: String(duration),
        questionsInAdvance: questionsInAdvance || "",
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=call`,
      cancel_url: `${baseUrl}/book/${contributorId}`,
      customer_email: session.user.email || undefined,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating call checkout session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
