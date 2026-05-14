import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const { tenant_id, email, role = "member" } = await req.json();
    console.log("invite-to-tenant called", { caller: caller.id, tenant_id, email, role });

    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: "tenant_id and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin or tenant admin (tenant-scoped)
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id, _tenant_id: tenant_id });
    const { data: isTenantAdmin } = await supabase.rpc("is_tenant_admin", { _user_id: caller.id, _tenant_id: tenant_id });
    if (!isAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      if (tenantInfo) {
        const siteUrl = "https://app.churchmanagementsuite.org";
        const loginUrl = `${siteUrl}/t/${tenantInfo.slug}/auth`;

        console.log("Sending auto-add notification email", { email: normalizedEmail, tenant: churchName });

        const emailResult = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "tenant-invitation",
            recipientEmail: normalizedEmail,
            idempotencyKey: `tenant-autoadd-${existingProfile.user_id}-${tenant_id}`,
            tenant_id,
            templateData: {
              churchName,
              signupUrl: loginUrl,
              role,
            },
          },
        });

        if (emailResult.error) {
          console.error("Auto-add notification email failed", { error: emailResult.error, email: normalizedEmail });
        }
      }

      return new Response(JSON.stringify({ success: true, auto_added: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User doesn't exist — check for pending invitation
    const { data: existingInvite } = await supabase
      .from("tenant_invitations")
      .select("id")
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
        const signupUrl = `${siteUrl}/t/${tenant.slug}/auth`;

        const emailResult = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "tenant-invitation",
            recipientEmail: normalizedEmail,
            idempotencyKey: `tenant-invite-resend-${existingInvite.id}-${Date.now()}`,
            tenant_id,
            templateData: {
              churchName: tenant.name,
              signupUrl,
              role,
            },
          },
        });

        if (emailResult.error) {
          console.error("Resend invitation email failed", { error: emailResult.error });
          email_warning = "Invitation updated but email failed to send.";
        }
      }

      return new Response(JSON.stringify({
        success: true,
        invitation_id: existingInvite.id,
        reused_pending_invitation: true,
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
    if (tenant) {
      const siteUrl = "https://app.churchmanagementsuite.org";
      const signupUrl = `${siteUrl}/t/${tenant.slug}/auth`;

      console.log("Sending invitation email", { email: normalizedEmail, signupUrl, tenant: tenant.name });

      const emailResult = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "tenant-invitation",
          recipientEmail: normalizedEmail,
          idempotencyKey: `tenant-invite-${invitation.id}`,
          tenant_id,
          templateData: {
            churchName: tenant.name,
            signupUrl,
            role,
          },
        },
      });

      if (emailResult.error) {
        console.error("Invitation email failed", { error: emailResult.error, email: normalizedEmail });
        return new Response(JSON.stringify({
          success: true,
          invitation_id: invitation.id,
          auto_added: false,
          email_warning: "Invitation created but email failed to send. Please try resending.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailData = emailResult.data;
      if (emailData && (emailData.error || emailData.reason === "email_suppressed")) {
        console.warn("Invitation email issue", { data: emailData, email: normalizedEmail });
        return new Response(JSON.stringify({
          success: true,
          invitation_id: invitation.id,
          auto_added: false,
          email_warning: emailData.error || "Recipient email is suppressed.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, invitation_id: invitation.id, auto_added: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-to-tenant error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
