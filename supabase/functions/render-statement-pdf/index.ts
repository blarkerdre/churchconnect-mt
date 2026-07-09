import { createClient } from "npm:@supabase/supabase-js@2";
import { generateAndUploadStatement } from "../_shared/generate-statement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, course_id, member_id } = body;
    if (!tenant_id || !course_id || !member_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id, course_id, member_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await admin.rpc("is_admin", {
      _user_id: userId,
      _tenant_id: tenant_id,
    });

    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: selfMember } = await admin
        .from("members")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .eq("id", member_id)
        .maybeSingle();
      allowed = !!selfMember;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await generateAndUploadStatement(admin, tenant_id, course_id, member_id);

    return new Response(
      JSON.stringify({
        success: true,
        path: result.path,
        signed_url: result.signed_url,
        expires_at: result.expires_at,
        student_number: result.student_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("render-statement-pdf error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
