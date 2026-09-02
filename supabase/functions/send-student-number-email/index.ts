// Send the student-number notification email to a Bible School applicant
// after their course registration has been approved. Admin-only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendLoggedTemplateEmail } from "../_shared/managed-email.ts";

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerUserId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const registration_id: string | undefined = body?.registration_id;
    if (!registration_id) {
      return json({ error: "Missing registration_id" }, 400);
    }

    const { data: reg, error: regErr } = await admin
      .from("course_registrations")
      .select("id, tenant_id, course_id, member_id, status, student_number, members(first_name, last_name, email)")
      .eq("id", registration_id)
      .maybeSingle();
    if (regErr || !reg) return json({ error: "Registration not found" }, 404);

    // Authorize caller as tenant admin/owner
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", reg.tenant_id)
      .eq("user_id", callerUserId)
      .maybeSingle();
    const isAdminRole = membership && ["owner", "admin"].includes(membership.role);
    if (!isAdminRole) return json({ error: "Forbidden" }, 403);

    if (!["approved", "active"].includes(reg.status)) {
      return json({ error: "Registration must be approved first" }, 400);
    }
    if (!reg.student_number) {
      return json({ error: "Registration has no student number yet" }, 400);
    }
    if (!reg.members?.email) {
      return json({ error: "Member has no email on file" }, 400);
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("name")
      .eq("id", reg.tenant_id)
      .maybeSingle();
    const tenantName = tenant?.name || "your church";

    let courseName = "Bible School";
    if (reg.course_id) {
      const { data: c } = await admin.from("exam_titles").select("name").eq("id", reg.course_id).maybeSingle();
      if (c?.name) courseName = c.name;
    }

    const emailLower = reg.members.email.trim().toLowerCase();

    let emailSent = true;
    let emailError: string | null = null;
    try {
      const result = await sendLoggedTemplateEmail({
        supabase: admin,
        templateName: "bible-school-student-number",
        to: emailLower,
        tenantId: reg.tenant_id,
        idempotencyKey: `bs-student-number-${reg.id}`,
        templateData: {
          firstName: reg.members.first_name,
          courseName,
          tenantName,
          courses: [{ name: courseName, student_number: reg.student_number }],
        },
      });
      if (!result.sent) {
        emailSent = false;
        emailError = "Recipient has unsubscribed or bounced";
        console.warn("bible-school-student-number email suppressed", { emailLower });
      }
    } catch (e) {
      emailSent = false;
      emailError = (e as Error).message || String(e);
      console.error("sendLoggedTemplateEmail failed:", e);
    }

    return json({ ok: true, email_sent: emailSent, email_error: emailError });
  } catch (e) {
    console.error("send-student-number-email error:", e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
