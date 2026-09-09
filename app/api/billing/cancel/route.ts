import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!currentSub || currentSub.plan_id === "free") {
      return NextResponse.json(
        { error: "No active paid subscription found to cancel." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedSub, error: updateErr } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: now,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateErr) {
      console.error("Cancel Subscription Error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const periodEndFormatted = currentSub.current_period_end
      ? new Date(currentSub.current_period_end).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "end of current billing period";

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      message: `Your subscription has been set to cancel. It will remain active until ${periodEndFormatted}.`,
    });
  } catch (err: any) {
    console.error("POST Cancel Subscription Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to cancel subscription." },
      { status: 500 }
    );
  }
}
