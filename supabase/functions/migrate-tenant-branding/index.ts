import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOURCE = "profile-photos";
const DEST = "tenant-branding";

// Matches "<uuid>/tenant-(logo|favicon|og|pwa-icon).<ext>"
const BRANDING_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/tenant-(logo|favicon|og|pwa-icon)\.[a-zA-Z0-9]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authn: require a logged-in super_admin or tenant admin for the listed tenants.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);
    const isSuperAdmin = (roleRows ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Super admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Page through ALL files in profile-photos at root prefix.
    // We list per top-level folder (tenant_id) by first listing the root.
    const moved: string[] = [];
    const skipped: string[] = [];
    const errors: { path: string; error: string }[] = [];

    const { data: rootEntries, error: rootErr } = await supabase.storage
      .from(SOURCE)
      .list("", { limit: 1000 });
    if (rootErr) throw rootErr;

    for (const entry of rootEntries ?? []) {
      // Only descend into UUID-shaped folders (tenant ids)
      if (!entry.id || entry.metadata) continue; // entries with metadata are files at root (none expected)
      if (!/^[0-9a-fA-F-]{36}$/.test(entry.name)) continue;

      const { data: files, error: listErr } = await supabase.storage
        .from(SOURCE)
        .list(entry.name, { limit: 1000 });
      if (listErr) {
        errors.push({ path: entry.name, error: listErr.message });
        continue;
      }

      for (const f of files ?? []) {
        const fullPath = `${entry.name}/${f.name}`;
        if (!BRANDING_RE.test(fullPath)) {
          continue;
        }

        // Skip if already exists in dest
        const { data: existing } = await supabase.storage
          .from(DEST)
          .list(entry.name, { limit: 1000, search: f.name });
        if ((existing ?? []).some((x) => x.name === f.name)) {
          skipped.push(fullPath);
          continue;
        }

        // Download then upload
        const { data: blob, error: dlErr } = await supabase.storage.from(SOURCE).download(fullPath);
        if (dlErr || !blob) {
          errors.push({ path: fullPath, error: dlErr?.message ?? "download failed" });
          continue;
        }

        const { error: upErr } = await supabase.storage
          .from(DEST)
          .upload(fullPath, blob, { upsert: true, contentType: blob.type || undefined });
        if (upErr) {
          errors.push({ path: fullPath, error: upErr.message });
          continue;
        }
        moved.push(fullPath);
      }
    }

    // Rewrite tenants.logo_url and tenants.settings.* URL hosts/buckets
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, logo_url, settings");
    if (tErr) throw tErr;

    const urlsRewritten: { id: string; fields: string[] }[] = [];
    const fromFragment = `/object/public/${SOURCE}/`;
    const toFragment = `/object/public/${DEST}/`;

    for (const t of tenants ?? []) {
      const fields: string[] = [];
      let nextLogo: string | null = t.logo_url;
      const nextSettings: Record<string, unknown> = { ...(t.settings || {}) };

      if (typeof t.logo_url === "string" && t.logo_url.includes(fromFragment)) {
        nextLogo = t.logo_url.replace(fromFragment, toFragment);
        fields.push("logo_url");
      }
      for (const key of ["favicon_url", "og_image_url", "pwa_icon_url"]) {
        const val = nextSettings[key];
        if (typeof val === "string" && val.includes(fromFragment)) {
          nextSettings[key] = val.replace(fromFragment, toFragment);
          fields.push(`settings.${key}`);
        }
      }

      if (fields.length > 0) {
        const { error: updErr } = await supabase
          .from("tenants")
          .update({ logo_url: nextLogo, settings: nextSettings })
          .eq("id", t.id);
        if (updErr) {
          errors.push({ path: `tenants/${t.id}`, error: updErr.message });
        } else {
          urlsRewritten.push({ id: t.id, fields });
        }
      }
    }

    // Optionally delete originals after success (only ones we successfully moved)
    const { searchParams } = new URL(req.url);
    const purge = searchParams.get("purge") === "1";
    const purged: string[] = [];
    if (purge && moved.length > 0) {
      const { error: rmErr } = await supabase.storage.from(SOURCE).remove(moved);
      if (rmErr) errors.push({ path: "(purge)", error: rmErr.message });
      else purged.push(...moved);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        moved_count: moved.length,
        skipped_count: skipped.length,
        urls_rewritten: urlsRewritten,
        purged_count: purged.length,
        errors,
        moved,
        skipped,
        hint: purge ? "Originals removed." : "Re-run with ?purge=1 to delete originals after verifying.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
