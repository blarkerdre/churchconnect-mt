import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate caller using anon client with user's token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Use service role client for admin operations
    const supabase = createClient(supabaseUrl, serviceKey);

    // Require tenant_id query param and confirm caller is admin of that tenant (or super_admin)
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    const { data: callerIsSuperAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "super_admin" });

    if (!callerIsSuperAdmin) {
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "tenant_id query param is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isTenantAdmin } = await supabase.rpc("is_admin", { _user_id: callerId, _tenant_id: tenantId });
      if (!isTenantAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required for this tenant" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build the set of user_ids the caller is allowed to see
    let allowedIds: Set<string> | null = null;
    if (!callerIsSuperAdmin && tenantId) {
      const { data: members } = await supabase
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId);
      allowedIds = new Set((members || []).map((m: { user_id: string }) => m.user_id));
    }

    // Fetch all users and filter banned ones (scoped to tenant when not super_admin)
    const bannedUserIds: string[] = [];
    let page = 1;
    const perPage = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const now = new Date();
      for (const u of users) {
        if (u.banned_until && new Date(u.banned_until) > now) {
          if (!allowedIds || allowedIds.has(u.id)) bannedUserIds.push(u.id);
        }
      }

      hasMore = users.length === perPage;
      page++;
    }

    return new Response(JSON.stringify({ banned_user_ids: bannedUserIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-list-banned-users error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
