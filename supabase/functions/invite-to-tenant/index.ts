import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Sends an invitation email and NEVER fails silently: every failure path
  // writes a `failed` row into email_send_log so invitation emails show up in
  // the Email Dashboard like every other email.
  async function sendInviteEmail(
    supabase: any,
    supabaseUrl: string,
    serviceKey: string,
    opts: {
      recipient: string;
      tenant_id: string;
      idempotencyKey: string;
      templateData: Record<string, unknown>;
      invitationId?: string;
      context: string;
    },
  ): Promise<string | undefined> {
    const logFailure = async (message: string) => {
      try {
        await supabase.from("email_send_log").insert({
          message_id: opts.idempotencyKey,
          template_name: "tenant-invitation",
          recipient_email: opts.recipient,
          status: "failed",
          error_message: `${opts.context}: ${message}`.slice(0, 1000),
          tenant_id: opts.tenant_id,
          metadata: opts.invitationId ? { invitation_id: opts.invitationId } : null,
        });
      } catch (logErr) {
        console.error("Failed to log invitation email failure", logErr);
      }
    };

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "x-internal-service-key": serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName: "tenant-invitation",
          recipientEmail: opts.recipient,
          idempotencyKey: opts.idempotencyKey,
          tenant_id: opts.tenant_id,
          templateData: opts.templateData,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || data?.message || `Email service returned HTTP ${response.status}`;
        console.error("Invitation email failed", { context: opts.context, error: msg });
        await logFailure(msg);
        return `Invitation created, but the email could not be sent (${msg}).`;
      }

      if (data && data.error) {
        console.error("Invitation email rejected", { context: opts.context, data });
        await logFailure(String(data.error));
        return `Invitation created, but the email could not be sent (${data.error}).`;
      }
      if (data && data.reason === "email_suppressed") {
        console.warn("Invitation email suppressed", { recipient: opts.recipient });
        return "Invitation created, but this address has unsubscribed or bounced, so no email was sent.";
      }
      return undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Invitation email threw", { context: opts.context, error: msg });
      await logFailure(msg);
      return `Invitation created, but the email could not be sent (${msg}).`;
    }
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, email, role: rawRole = "member" } = await req.json();
    console.log("invite-to-tenant called", { caller: caller.id, tenant_id, email, role: rawRole });

    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: "tenant_id and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role against an allowlist
    const ALLOWED_ROLES = ["member", "admin", "owner"];
    if (!ALLOWED_ROLES.includes(rawRole)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const role = rawRole;

    // Verify caller is admin or tenant admin (tenant-scoped)
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id, _tenant_id: tenant_id });
    const { data: isTenantAdmin } = await supabase.rpc("is_tenant_admin", { _user_id: caller.id, _tenant_id: tenant_id });
    if (!isAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Privilege-escalation guard: only owners or super_admins may assign 'owner' or 'admin' roles.
    if (role === "owner" || role === "admin") {
      const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
      const { data: callerMembership } = await supabase
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", caller.id)
        .maybeSingle();
      const callerIsOwner = callerMembership?.role === "owner";
      if (!isSuperAdmin && !callerIsOwner) {
        return new Response(JSON.stringify({ error: "Only owners or super-admins can assign owner/admin roles" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      // Check if already a member of this tenant
      const { data: existingMembership } = await supabase
        .from("tenant_memberships")
        .select("id, role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", existingProfile.user_id)
        .maybeSingle();

      if (existingMembership) {
        // Idempotent: if already a member, update role if different and return success
        if (existingMembership.role !== role) {
          await supabase.from("tenant_memberships")
            .update({ role })
            .eq("id", existingMembership.id);
        }
        return new Response(JSON.stringify({ success: true, already_member: true, auto_added: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-add existing user to tenant
      const { error: membershipError } = await supabase.from("tenant_memberships").insert({
        tenant_id,
        user_id: existingProfile.user_id,
        role,
      });
      if (membershipError) throw membershipError;

      // Fetch tenant details for notification
      const { data: tenantInfo } = await supabase
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      const churchName = tenantInfo?.name || "a church";

      // Notify them in-app
      await supabase.from("notifications").insert({
        user_id: existingProfile.user_id,
        title: `You've been added to ${churchName}`,
        message: `An admin has added you to ${churchName}. Switch to it using the tenant switcher.`,
        type: "general",
        tenant_id,
      });

      // Send notification email
      let email_warning: string | undefined;
      if (tenantInfo) {
        const siteUrl = "https://app.churchmanagementsuite.org";
        const loginUrl = `${siteUrl}/t/${tenantInfo.slug}/auth`;

        console.log("Sending auto-add notification email", { email: normalizedEmail, tenant: churchName });

        email_warning = await sendInviteEmail(supabase, supabaseUrl, serviceKey, {
          recipient: normalizedEmail,
          tenant_id,
          idempotencyKey: `tenant-autoadd-${existingProfile.user_id}-${tenant_id}`,
          templateData: { churchName, signupUrl: loginUrl, role },
          context: "auto-add notification",
        });
      }

      return new Response(JSON.stringify({ success: true, auto_added: true, email_sent: !email_warning, email_warning }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // User doesn't exist — check for pending invitation
    const { data: existingInvite } = await supabase
      .from("tenant_invitations")
      .select("id, token")
      .eq("tenant_id", tenant_id)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      // Reuse existing pending invitation: update role/timestamp and resend email
      await supabase.from("tenant_invitations")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", existingInvite.id);

      // Fetch tenant details and resend email
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      let email_warning: string | undefined;
      if (tenant) {
        const siteUrl = "https://app.churchmanagementsuite.org";
        const signupUrl = `${siteUrl}/accept-invite?token=${existingInvite.token}`;

        email_warning = await sendInviteEmail(supabase, supabaseUrl, serviceKey, {
          recipient: normalizedEmail,
          tenant_id,
          idempotencyKey: `tenant-invite-resend-${existingInvite.id}-${Date.now()}`,
          templateData: { churchName: tenant.name, signupUrl, role },
          invitationId: existingInvite.id,
          context: "resend invitation",
        });
      } else {
        email_warning = "Invitation updated, but the church could not be resolved so no email was sent.";
      }

      return new Response(JSON.stringify({
        success: true,
        invitation_id: existingInvite.id,
        reused_pending_invitation: true,
        email_sent: !email_warning,
        email_warning,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invitation record
    const { data: invitation, error: invError } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id,
        email: normalizedEmail,
        role,
        invited_by: caller.id,
      })
      .select()
      .single();

    if (invError) throw invError;

    // Fetch tenant details for the email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single();

    // Send invitation email via transactional email system
    let email_warning: string | undefined;
    if (tenant) {
      const siteUrl = "https://app.churchmanagementsuite.org";
      const signupUrl = `${siteUrl}/accept-invite?token=${invitation.token}`;

      console.log("Sending invitation email", { email: normalizedEmail, signupUrl, tenant: tenant.name });

      email_warning = await sendInviteEmail(supabase, supabaseUrl, serviceKey, {
        recipient: normalizedEmail,
        tenant_id,
        idempotencyKey: `tenant-invite-${invitation.id}`,
        templateData: { churchName: tenant.name, signupUrl, role },
        invitationId: invitation.id,
        context: "new invitation",
      });
    } else {
      email_warning = "Invitation created, but the church could not be resolved so no email was sent.";
    }

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      auto_added: false,
      email_sent: !email_warning,
      email_warning,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("invite-to-tenant error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
