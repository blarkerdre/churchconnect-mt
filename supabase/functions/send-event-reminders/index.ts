import { createClient } from "npm:@supabase/supabase-js@2";

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

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get all events with reminders that haven't been fully sent yet
    const { data: events, error: fetchError } = await supabase
      .from("events")
      .select("id, title, event_date, location, start_time, audience, reminder_days_before, reminder_hours_before, reminder_sent, tenant_id")
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

      let shouldNotify = false;

      // Check day-based reminders
      const dayReminders: number[] = event.reminder_days_before || [];
      if (dayReminders.includes(diffDays)) {
        shouldNotify = true;
      }

      // Check hour-based reminders
      const hourReminders: number[] = event.reminder_hours_before || [];
      if (hourReminders.length > 0 && event.start_time) {
        const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
        const diffMs = eventDateTime.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        if (hourReminders.includes(diffHours)) {
          shouldNotify = true;
        }
      }

      if (!shouldNotify) continue;

      // Build notification message
      const timeStr = event.start_time ? ` at ${event.start_time}` : "";
      const locStr = event.location ? ` - ${event.location}` : "";
      const message = diffDays > 0
        ? `${event.title} is in ${diffDays} day${diffDays !== 1 ? "s" : ""}${timeStr}${locStr}`
        : `${event.title} is today${timeStr}${locStr}`;

      // Use notify_all_users with tenant_id to scope notifications
      const rpcParams: Record<string, unknown> = {
        _title: `Event Reminder: ${event.title}`,
        _message: message,
        _type: "event",
        _reference_id: event.id,
        _reference_type: "event",
      };
      if (event.tenant_id) {
        rpcParams._tenant_id = event.tenant_id;
      }

      const { error: notifyError } = await supabase.rpc("notify_all_users", rpcParams);

      if (notifyError) {
        console.error(`Failed to notify for event ${event.id}:`, notifyError);
        continue;
      }

      notificationCount++;

      // If this is the last reminder (event day or past all reminders), mark as sent
      const minDayReminder = dayReminders.length > 0 ? Math.min(...dayReminders) : Infinity;
      const minHourReminder = hourReminders.length > 0 ? Math.min(...hourReminders) : Infinity;
      
      if (diffDays <= minDayReminder && (minHourReminder === Infinity || diffDays === 0)) {
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
