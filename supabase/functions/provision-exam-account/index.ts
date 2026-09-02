// Provision a lightweight Lovable Cloud account for an approved Bible School
// applicant and email them a magic link that signs them in and drops them
// straight into the exam page. Admin-only.

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

    // Validate caller JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerUserId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const application_id: string | undefined = body?.application_id;
    const registration_id: string | undefined = body?.registration_id;
    console.log("[provision-exam-account] entry", { application_id, registration_id, caller: callerUserId });
    if (!application_id && !registration_id) {
      return json({ error: "Missing application_id or registration_id" }, 400);
    }

    // Load application — either directly, or derived from a course_registrations row.
    let app: any = null;
    if (application_id) {
      const { data, error } = await admin
        .from("wofbi_applications")
        .select("id, tenant_id, course_id, member_id, first_name, last_name, email, phone, status")
        .eq("id", application_id)
        .maybeSingle();
      if (error || !data) return json({ error: "Application not found" }, 404);
      app = data;
    } else {
      const { data: reg, error: regErr } = await admin
        .from("course_registrations")
        .select("id, tenant_id, course_id, member_id, status, members(first_name, last_name, email, phone)")
        .eq("id", registration_id!)
        .maybeSingle();
      if (regErr || !reg) return json({ error: "Registration not found" }, 404);
      if (!["approved", "active"].includes(reg.status)) {
        return json({ error: "Registration must be approved before sending exam link" }, 400);
      }
      if (!reg.members?.email) return json({ error: "Member has no email on file" }, 400);
      // Try to find a matching wofbi_applications row (tenant + member + course)
      const { data: matchedApp } = await admin
        .from("wofbi_applications")
        .select("id, tenant_id, course_id, member_id, first_name, last_name, email, phone, status")
        .eq("tenant_id", reg.tenant_id)
        .eq("member_id", reg.member_id)
        .eq("course_id", reg.course_id)
        .maybeSingle();
      app = matchedApp || {
        id: null,
        tenant_id: reg.tenant_id,
        course_id: reg.course_id,
        member_id: reg.member_id,
        first_name: reg.members.first_name,
        last_name: reg.members.last_name,
        email: reg.members.email,
        phone: reg.members.phone,
        status: "approved",
      };
    }

    // Authorize: caller must be super_admin, or admin/owner of this tenant
    const { data: superRow } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", callerUserId)
      .eq("role", "super_admin")
      .is("tenant_id", null)
      .maybeSingle();
    const isSuperAdmin = !!superRow;

    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", app.tenant_id)
      .eq("user_id", callerUserId)
      .maybeSingle();
    const isAdminRole = isSuperAdmin || (membership && ["owner", "admin"].includes(membership.role));
    console.log("[provision-exam-account] loaded", { tenant_id: app.tenant_id, course_id: app.course_id, member_id: app.member_id, status: app.status, email: app.email, role: membership?.role, isSuperAdmin });
    if (!isAdminRole) return json({ error: "Forbidden" }, 403);

    if (app.status !== "approved") {
      return json({ error: "Application must be approved before provisioning" }, 400);
    }
    if (!app.email) return json({ error: "Application has no email" }, 400);

    // Look up tenant slug + name for redirect + email
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug, name")
      .eq("id", app.tenant_id)
      .maybeSingle();
    const slug = tenant?.slug || "";
    const tenantName = tenant?.name || "your church";

    // Load course name (optional)
    let courseName = "Bible School";
    if (app.course_id) {
      const { data: c } = await admin.from("exam_titles").select("name").eq("id", app.course_id).maybeSingle();
      if (c?.name) courseName = c.name;
    }

    // 1. Ensure auth user
    let userId: string | null = null;
    const emailLower = app.email.trim().toLowerCase();
    // Find existing user by paging listUsers
    let page = 1;
    while (!userId) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) { console.error("[provision-exam-account] listUsers error", listErr); break; }
      const found = list.users.find((u: any) => (u.email || "").toLowerCase() === emailLower);
      if (found) { userId = found.id; break; }
      if (!list.users.length || list.users.length < 200) break;
      page++;
      if (page > 25) break;
    }
    console.log("[provision-exam-account] listUsers result", { existingUserId: userId, pagesScanned: page });
    if (!userId) {
      console.log("[provision-exam-account] creating auth user", { emailLower });
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: emailLower,
        email_confirm: true,
        user_metadata: { full_name: `${app.first_name} ${app.last_name}`.trim(), ...(slug ? { tenant_slug: slug } : {}) },
      });
      if (createErr) {
        console.error("[provision-exam-account] createUser failed", { message: createErr.message, status: (createErr as any).status, code: (createErr as any).code, name: createErr.name, raw: JSON.stringify(createErr) });
        return json({ error: `Failed to create user: ${createErr.message || createErr.name || "unknown"}`, code: (createErr as any).code, status: (createErr as any).status }, 500);
      }
      userId = newUser.user.id;
      console.log("[provision-exam-account] created auth user", { userId });
    }

    // 2. Ensure member row for this tenant + user
    let memberId: string | null = app.member_id;
    if (!memberId) {
      const { data: existingMember } = await admin
        .from("members")
        .select("id")
        .eq("tenant_id", app.tenant_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingMember) {
        memberId = existingMember.id;
      } else {
        // Try match by email within tenant
        const { data: byEmail } = await admin
          .from("members")
          .select("id, user_id")
          .eq("tenant_id", app.tenant_id)
          .ilike("email", emailLower)
          .maybeSingle();
        if (byEmail) {
          memberId = byEmail.id;
          if (!byEmail.user_id) {
            await admin.from("members").update({ user_id: userId }).eq("id", memberId).eq("tenant_id", app.tenant_id);
          }
        } else {
          const { data: created, error: memErr } = await admin
            .from("members")
            .insert({
              tenant_id: app.tenant_id,
              user_id: userId,
              first_name: app.first_name,
              last_name: app.last_name,
              email: emailLower,
              phone: app.phone || null,
              status: "active",
            })
            .select("id")
            .single();
          if (memErr) return json({ error: `Failed to create member: ${memErr.message}` }, 500);
          memberId = created.id;
        }
      }
      // Link back on application (only if we have an application row)
      if (app.id) {
        await admin.from("wofbi_applications").update({ member_id: memberId }).eq("id", app.id).eq("tenant_id", app.tenant_id);
      }
    }

    // 3. Ensure course registration exists and is approved/active
    const courses: Array<{ name: string; student_number: string | null }> = [];
    if (app.course_id && memberId) {
      const { data: reg } = await admin
        .from("course_registrations")
        .select("id, status, student_number")
        .eq("tenant_id", app.tenant_id)
        .eq("member_id", memberId)
        .eq("course_id", app.course_id)
        .maybeSingle();
      if (!reg) {
        await admin.from("course_registrations").insert({
          tenant_id: app.tenant_id,
          member_id: memberId,
          course_id: app.course_id,
          status: "active",
          registered_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: callerUserId,
          registration_origin: "admin",
        });
      } else if (!["approved", "active"].includes(reg.status)) {
        await admin
          .from("course_registrations")
          .update({ status: "active", approved_at: new Date().toISOString(), approved_by: callerUserId })
          .eq("id", reg.id)
          .eq("tenant_id", app.tenant_id);
      }
      // Re-read to capture the trigger-assigned student_number
      const { data: regAfter } = await admin
        .from("course_registrations")
        .select("student_number")
        .eq("tenant_id", app.tenant_id)
        .eq("member_id", memberId)
        .eq("course_id", app.course_id)
        .maybeSingle();
      courses.push({ name: courseName, student_number: regAfter?.student_number || null });
    }

    // 4. Generate magic link
    const origin =
      req.headers.get("origin") ||
      Deno.env.get("SITE_URL") ||
      "https://app.churchmanagementsuite.org";
    const nextPath = slug ? `/t/${slug}/exam-management` : "/exam-management";
    const redirectTo = `${origin}/auth/exam-callback?next=${encodeURIComponent(nextPath)}`;

    console.log("[provision-exam-account] generating magic link", { emailLower, redirectTo });
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: emailLower,
      options: { redirectTo },
    });
    if (linkErr) {
      console.error("[provision-exam-account] generateLink failed", { message: linkErr.message, status: (linkErr as any).status, code: (linkErr as any).code, name: linkErr.name });
      return json({ error: `Failed to generate magic link: ${linkErr.message}`, code: (linkErr as any).code, status: (linkErr as any).status }, 500);
    }
    const magicLink = linkData?.properties?.action_link;
    if (!magicLink) {
      console.error("[provision-exam-account] no action_link in generateLink response", { linkData });
      return json({ error: "No action_link returned" }, 500);
    }
    console.log("[provision-exam-account] magic link generated", { hasLink: true });

    // 5. Send email via the managed email helper.
    let emailSent = true;
    let emailError: string | null = null;
    try {
      console.log("[provision-exam-account] sending via sendLoggedTemplateEmail", { emailLower, template: "bible-school-exam-ready", tenant_id: app.tenant_id });
      const result = await sendLoggedTemplateEmail({
        supabase: admin,
        templateName: "bible-school-exam-ready",
        to: emailLower,
        tenantId: app.tenant_id,
        idempotencyKey: `bs-exam-ready-${app.id || registration_id || memberId}-${Date.now()}`,
        templateData: {
          firstName: app.first_name,
          courseName,
          magicLink,
          tenantName,
          courses,
        },
      });
      if (!result.sent) {
        emailSent = false;
        emailError = "Recipient has unsubscribed or bounced";
        console.warn("[provision-exam-account] bible-school-exam-ready email suppressed", { emailLower });
      } else {
        console.log("[provision-exam-account] sendLoggedTemplateEmail ok");
        if (app.course_id && memberId) {
          // Stamp exam_link_sent_at so the UI can accurately show "Sent" / "Resend link".
          await admin
            .from("course_registrations")
            .update({ exam_link_sent_at: new Date().toISOString() })
            .eq("tenant_id", app.tenant_id)
            .eq("member_id", memberId)
            .eq("course_id", app.course_id);
        }
      }
    } catch (e) {
      emailSent = false;
      emailError = (e as Error).message || String(e);
      console.error("[provision-exam-account] sendLoggedTemplateEmail threw", e);
      // Non-fatal — return link so admin can share manually if needed.
    }

    console.log("[provision-exam-account] done", { memberId, userId, emailSent, emailError });
    return json({ ok: true, member_id: memberId, user_id: userId, magic_link: magicLink, email_sent: emailSent, email_error: emailError });
  } catch (e) {
    console.error("provision-exam-account error:", e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
