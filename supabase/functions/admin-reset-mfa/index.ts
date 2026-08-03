import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { user_id, tenant_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") {
      return json({ error: "user_id is required" }, 400);
    }

    if (user_id === caller.id) {
      return json({ error: "Use My Profile → Security to manage your own 2FA" }, 400);
    }

    const { data: callerIsSuperAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });

    if (!callerIsSuperAdmin) {
      if (!tenant_id) return json({ error: "tenant_id is required" }, 400);

      const { data: callerIsTenantAdmin } = await supabase.rpc("is_admin", {
        _user_id: caller.id,
        _tenant_id: tenant_id,
      });
      if (!callerIsTenantAdmin) return json({ error: "Admin access required for this tenant" }, 403);

      const { data: targetBelongs } = await supabase.rpc("user_belongs_to_tenant", {
        _user_id: user_id,
        _tenant_id: tenant_id,
      });
      if (!targetBelongs) return json({ error: "Target user is not a member of this tenant" }, 403);

      const { data: targetIsSuperAdmin } = await supabase.rpc("has_role", {
        _user_id: user_id,
        _role: "super_admin",
      });
      if (targetIsSuperAdmin) {
        return json({ error: "Only super-admins can reset 2FA for super-admin accounts" }, 403);
      }
    }

    const { data: factorsData, error: listError } = await supabase.auth.admin.mfa.listFactors({
      userId: user_id,
    });
    if (listError) {
      console.error("admin-reset-mfa list error:", listError);
      return json({ error: "An unexpected error occurred" }, 400);
    }

    const factors = factorsData?.factors || [];
    let removed = 0;
    for (const factor of factors) {
      const { error: delError } = await supabase.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: user_id,
      });
      if (delError) {
        console.error("admin-reset-mfa delete error:", delError);
        return json({ error: "An unexpected error occurred" }, 400);
      }
      removed++;
    }

    console.log(`admin-reset-mfa: caller ${caller.id} removed ${removed} factor(s) for ${user_id}`);
    return json({ success: true, removed });
  } catch (err) {
    console.error("admin-reset-mfa error:", err);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
