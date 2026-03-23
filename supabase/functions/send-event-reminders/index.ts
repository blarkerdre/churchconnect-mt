import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Get all events with reminders that haven't been fully sent yet
    const { data: events, error: fetchError } = await supabase
      .from("events")
      .select("id, title, event_date, location, start_time, audience, reminder_days_before, reminder_sent")
      .not("reminder_days_before", "is", null)
      .eq("reminder_sent", false)
      .gte("event_date", today);

    if (fetchError) throw fetchError;

    let notificationCount = 0;

    for (const event of events || []) {
      const eventDate = new Date(event.event_date);
      const todayDate = new Date(today);
      const diffDays = Math.round(
        (eventDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const reminders: number[] = event.reminder_days_before || [];
      if (!reminders.includes(diffDays)) continue;

      // Build notification message
      const timeStr = event.start_time ? ` at ${event.start_time}` : "";
      const locStr = event.location ? ` - ${event.location}` : "";
      const message = `${event.title} is in ${diffDays} day${diffDays !== 1 ? "s" : ""}${timeStr}${locStr}`;

      // Use notify_all_users to send to all users with roles
      const { error: notifyError } = await supabase.rpc("notify_all_users", {
        _title: `Event Reminder: ${event.title}`,
        _message: message,
        _type: "event",
        _reference_id: event.id,
        _reference_type: "event",
      });

      if (notifyError) {
        console.error(`Failed to notify for event ${event.id}:`, notifyError);
        continue;
      }

      notificationCount++;

      // If this is the last reminder (1 day before or event day), mark as sent
      const minReminder = Math.min(...reminders);
      if (diffDays <= minReminder) {
        await supabase
          .from("events")
          .update({ reminder_sent: true })
          .eq("id", event.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notificationCount,
        events_checked: events?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
