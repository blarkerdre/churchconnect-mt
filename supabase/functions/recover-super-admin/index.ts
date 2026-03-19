import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECOVERY_SECRET = "WCP-RECOVER-2026-X9K4M";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { secret } = await req.json();
    if (secret !== RECOVERY_SECRET) {
      return new Response(JSON.stringify({ error: "Invalid recovery secret" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const email = "kugbiyiadeniyi@gmail.com";
    const tempPassword = "TempPass2026!Change";

    // Create the user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: "Super Admin" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign super_admin role
    if (newUser?.user) {
      await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: "super_admin" });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Super admin account recreated. Sign in with the temporary password and change it immediately.",
      user_id: newUser?.user?.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
