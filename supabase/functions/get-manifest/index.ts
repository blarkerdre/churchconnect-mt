import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/tenant-pwa-icons/${path}`;
}

async function objectExists(supabase: ReturnType<typeof createClient>, path: string) {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const { data, error } = await supabase.storage
    .from("tenant-pwa-icons")
    .list(folder, { limit: 100, search: file });
  if (error) return false;
  return (data || []).some((o) => o.name === file);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("tenant");
    const tenantIdParam = url.searchParams.get("tenantId");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let tenant: { id: string; name: string; slug: string; settings: any } | null = null;
    if (slug) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, settings")
        .eq("slug", slug)
        .maybeSingle();
      tenant = data as any;
    } else if (tenantIdParam) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, settings")
        .eq("id", tenantIdParam)
        .maybeSingle();
      tenant = data as any;
    }

    const fallback = {
      name: "Church Management Suite",
      short_name: "Church MS",
      description: "Multi-tenant Church Management Suite",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1e3a5f",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    };

    if (!tenant) {
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
      });
    }

    const name = tenant.name || "Church";
    const shortName = name.length > 12 ? name.slice(0, 12).trim() : name;
    const themeColor = tenant.settings?.primary_color || "#1e3a5f";
    const startUrl = `/t/${tenant.slug}`;

    const has192 = await objectExists(supabase, `${tenant.id}/icon-192.png`);
    const has512 = await objectExists(supabase, `${tenant.id}/icon-512.png`);

    const icons =
      has192 || has512
        ? [
            {
              src: has192 ? publicUrl(`${tenant.id}/icon-192.png`) : publicUrl(`${tenant.id}/icon-512.png`),
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: has512 ? publicUrl(`${tenant.id}/icon-512.png`) : publicUrl(`${tenant.id}/icon-192.png`),
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ]
        : fallback.icons;

    const manifest = {
      name,
      short_name: shortName,
      description: `Church Management Suite for ${name}`,
      id: startUrl,
      start_url: startUrl,
      scope: startUrl,
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: themeColor,
      icons,
    };

    return new Response(JSON.stringify(manifest), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
