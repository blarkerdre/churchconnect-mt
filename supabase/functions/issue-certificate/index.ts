import { createClient } from "npm:@supabase/supabase-js@2";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { writeAudit } from "../_shared/audit.ts";

// Initialise resvg wasm once per cold-start
let _wasmReady: Promise<void> | null = null;
async function ensureWasm() {
  if (!_wasmReady) {
    _wasmReady = (async () => {
      const wasmResp = await fetch(
        "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm"
      );
      const wasmBuf = await wasmResp.arrayBuffer();
      await initWasm(wasmBuf);
    })();
  }
  return _wasmReady;
}

// Cache font buffers per cold-start so resvg can render text.
let _fontsPromise: Promise<Uint8Array[]> | null = null;
async function loadFonts(): Promise<Uint8Array[]> {
  if (!_fontsPromise) {
    // Google Fonts gstatic TTF URLs (resvg-wasm needs TTF/OTF — fontsource jsdelivr
    // packages no longer ship .ttf, only .woff2, which resvg-wasm cannot consume).
    const urls = [
      // Playfair Display 700 (serif headings)
      "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf",
      // Inter 400 / 500 / 600 / 700 (body)
      "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
      "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf",
      "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf",
      "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
      // Great Vibes — script face for Bible School certificate title
      "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN-XCg6UKDXlq.ttf",
      // Pinyon Script — cursive course-name face
      "https://fonts.gstatic.com/s/pinyonscript/v22/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf",
    ];
    _fontsPromise = Promise.all(
      urls.map(async (u) => {
        try {
          const r = await fetch(u);
          if (!r.ok) {
            console.warn("Font fetch failed:", u, r.status);
            return null;
          }
          return new Uint8Array(await r.arrayBuffer());
        } catch (e) {
          console.warn("Font fetch error:", u, e);
          return null;
        }
      })
    ).then((arr) => {
      const buffers = arr.filter((x): x is Uint8Array => !!x);
      if (buffers.length === 0) {
        console.error("loadFonts: no font buffers loaded — text will not render");
      }
      return buffers;
    });
  }
  return _fontsPromise;
}

async function renderSvgToPng(svg: string): Promise<Uint8Array> {
  await ensureWasm();
  const fontBuffers = await loadFonts();
  const resvg = new Resvg(svg, {
    background: "rgba(255,255,255,1)",
    fitTo: { mode: "width", value: 1684 }, // 2x for crisp output
    font: {
      loadSystemFonts: false,
      fontBuffers,
      defaultFontFamily: "Inter",
      serifFamily: "Playfair Display",
      sansSerifFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { member_id, training_type, completion_date, notes, tenant_id, reissue, completion_id, preview, grade_classification: gcInput } = body;
    const isPreview = preview === true;

    if (!member_id || !training_type || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "member_id, training_type and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tenant-scoped role checks: caller must be admin OR a unit_leader assigned to the "Training Rep" unit within this tenant
    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: userId, _tenant_id: tenant_id });
    let isTrainingRepLeader = false;
    if (!isAdminResult) {
      const { data: isLeaderResult } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "unit_leader",
        _tenant_id: tenant_id,
      });
      if (isLeaderResult) {
        const { data: assignment } = await supabase
          .from("unit_leader_assignments")
          .select("id")
          .eq("user_id", userId)
          .eq("tenant_id", tenant_id)
          .ilike("unit_name", "Training Rep")
          .maybeSingle();
        isTrainingRepLeader = !!assignment;
      }
    }
    if (!isAdminResult && !isTrainingRepLeader) {
      return new Response(
        JSON.stringify({ error: "Only admins and the Training Rep unit leader can issue certificates" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up existing completion. For reissue prefer completion_id (robust against
    // tenant-context drift); otherwise use tenant-scoped (member, training_type).
    let existing: any = null;
    if ((reissue || isPreview) && completion_id) {
      const { data } = await supabase
        .from("training_completions")
        .select("*")
        .eq("id", completion_id)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from("training_completions")
        .select("*")
        .eq("member_id", member_id)
        .eq("training_type", training_type)
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      existing = data;
    }

    if (existing && !reissue && !isPreview) {
      return new Response(
        JSON.stringify({ error: "Certificate already issued for this training" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (reissue && !existing) {
      return new Response(
        JSON.stringify({ error: "No existing certificate found to reissue" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get member info — must belong to this tenant
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("*")
      .eq("id", member_id)
      .eq("tenant_id", tenant_id)
      .single();
    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get template (case-insensitive + fallback to "Default" template), scoped to tenant
    let { data: template } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("tenant_id", tenant_id)
      .ilike("training_type", training_type.trim())
      .maybeSingle();

    if (!template) {
      const { data: defaultTpl } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("tenant_id", tenant_id)
        .ilike("training_type", "default")
        .maybeSingle();
      template = defaultTpl;
    }

    const churchName = template?.church_name || "Winners Chapel International Cardiff";
    const signatoryName = template?.signatory_name || "";
    const signatoryTitle = template?.signatory_title || "";
    const bgColor = template?.background_color || "#1a2d4d";
    const accentColor = template?.accent_color || "#c5a028";
    const textColor = template?.text_color || bgColor || "#1a2d4d";
    const customMessage =
      template?.custom_message ||
      "This is to certify that the above named has successfully completed";
    const backgroundImageUrl = template?.background_image_url || null;
    const deanSignatureUrl = template?.dean_signature_url || null;
    const crestImageUrl = template?.crest_image_url || null;
    const nameColor = template?.name_color || "#5B2E91"; // Bible School purple by default
    const textPositions = template?.text_positions || { name_y: 280, training_y: 340, date_y: 380, signatory_y: 500 };

    // Detect Bible School course (matches an exam_titles row for this tenant)
    const { data: courseRow } = await supabase
      .from("exam_titles")
      .select("id, name, course_code")
      .eq("tenant_id", tenant_id)
      .ilike("name", training_type.trim())
      .maybeSingle();
    const isBibleSchool = !!courseRow;

    const certDate = completion_date || existing?.completion_date || new Date().toISOString().split("T")[0];

    let certificateNumber: string;
    let studentNumber: string | null = existing?.student_number ?? null;
    if (existing?.certificate_number) {
      certificateNumber = existing.certificate_number;
    } else if (isPreview) {
      certificateNumber = "PREVIEW-XXXX-XXXX-XXXX";
    } else if (isBibleSchool && courseRow) {
      // Allocate a Bible School student number: WCIC/BCC/AUGUST/2025/113
      const { data: sn, error: snErr } = await supabase.rpc("next_student_number", {
        _tenant_id: tenant_id,
        _course_id: courseRow.id,
        _completion_date: certDate,
      });
      if (snErr) {
        console.error("next_student_number error:", snErr);
        return new Response(JSON.stringify({ error: "Failed to allocate student number" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      studentNumber = sn as string;
      certificateNumber = studentNumber; // keep unique cert number aligned with student number
    } else {
      const year = new Date().getFullYear();
      const prefix = training_type
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase()
        .slice(0, 6);
      const { count } = await supabase
        .from("training_completions")
        .select("*", { count: "exact", head: true })
        .ilike("certificate_number", `CERT-${prefix}-${year}-%`);
      const seq = String((count || 0) + 1).padStart(4, "0");
      certificateNumber = `CERT-${prefix}-${year}-${seq}`;
    }

    if (isBibleSchool && isPreview) {
      // Preview: use a stable placeholder student number.
      const monthName = new Date(certDate)
        .toLocaleDateString("en-GB", { month: "long" })
        .toUpperCase();
      const year = new Date(certDate).getFullYear();
      const tCode = (courseRow?.course_code || "CRS").toUpperCase();
      studentNumber = `PREVIEW/${tCode}/${monthName}/${year}/PREVIEW`;
    }

    const formattedDate = new Date(certDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const memberName = `${member.first_name} ${member.last_name}`;

    // Helper: fetch a storage path and inline it as a base64 data URI
    const inlineStorageImage = async (path: string): Promise<string> => {
      const candidates = [path, path.startsWith(`${tenant_id}/`) ? null : `${tenant_id}/${path}`]
        .filter(Boolean) as string[];
      for (const p of candidates) {
        const { data: s } = await supabase.storage.from("church-documents").createSignedUrl(p, 3600);
        if (!s?.signedUrl) continue;
        try {
          const r = await fetch(s.signedUrl);
          if (!r.ok) continue;
          const buf = await r.arrayBuffer();
          const ct = r.headers.get("content-type") || "image/png";
          return `data:${ct};base64,${encodeBase64(new Uint8Array(buf))}`;
        } catch (_) { /* try next */ }
      }
      return "";
    };

    const gradeClassification =
      (typeof gcInput === "string" && gcInput.trim()) ||
      existing?.grade_classification ||
      "";

    // Build SVG certificate
    let svgCert: string;

    if (isBibleSchool && !backgroundImageUrl) {
      // Bible School layout matching the Word of Faith Bible Institute certificate
      const deanDataUri = deanSignatureUrl ? await inlineStorageImage(deanSignatureUrl) : "";
      const crestDataUri = crestImageUrl ? await inlineStorageImage(crestImageUrl) : "";
      const nameHex = /^#[0-9a-fA-F]{6}$/.test(nameColor) ? nameColor : "#5B2E91";
      const titleColor = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#B22222";
      const bodyDark = "#333333";
      const gradeColor = "#C0392B";
      const idLine = studentNumber || certificateNumber;

      svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="842" height="595" viewBox="0 0 842 595">
  <rect width="842" height="595" fill="#ffffff"/>
  <!-- Title -->
  <text x="421" y="90" text-anchor="middle" font-family="Great Vibes, cursive" font-weight="400" font-size="56" fill="${titleColor}">${escapeXml(churchName)}</text>
  <!-- Certify line -->
  <text x="421" y="165" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="20" fill="${titleColor}">This is to certify that</text>
  <!-- Student name -->
  <text x="421" y="215" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="34" fill="${nameHex}">${escapeXml(memberName)}</text>
  <!-- Student number -->
  <text x="421" y="248" text-anchor="middle" font-family="Playfair Display, serif" font-weight="400" font-size="15" fill="${bodyDark}">Student No. <tspan font-style="italic">${escapeXml(idLine)}</tspan></text>
  <!-- Fulfilment line -->
  <text x="421" y="295" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="17" fill="${bodyDark}">has fulfilled the requirement of the institute for the</text>
  <!-- Course name in script -->
  <text x="421" y="360" text-anchor="middle" font-family="Pinyon Script, cursive" font-weight="400" font-size="48" fill="#111111">${escapeXml(training_type)}</text>
  ${gradeClassification ? `
  <!-- Grade line -->
  <text x="330" y="420" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="18" fill="${bodyDark}">with</text>
  <text x="500" y="420" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="22" fill="${gradeColor}">${escapeXml(gradeClassification)}</text>
  ` : ""}
  <!-- Dean signature (left) -->
  ${deanDataUri ? `<image href="${deanDataUri}" x="115" y="480" width="150" height="45" preserveAspectRatio="xMidYMax meet"/>` : ""}
  <line x1="100" y1="530" x2="290" y2="530" stroke="#333" stroke-width="1"/>
  <text x="195" y="548" text-anchor="middle" font-family="Inter, sans-serif" font-style="italic" font-weight="700" font-size="12" fill="${bodyDark}">${escapeXml(signatoryTitle || "Dean")}</text>
  <!-- Crest (centre) -->
  ${crestDataUri ? `<image href="${crestDataUri}" x="376" y="470" width="90" height="90" preserveAspectRatio="xMidYMid meet"/>` : ""}
  <!-- Date (right) -->
  <text x="647" y="520" text-anchor="middle" font-family="Playfair Display, serif" font-style="italic" font-weight="700" font-size="14" fill="${bodyDark}">${escapeXml(formattedDate)}</text>
  <line x1="552" y1="530" x2="742" y2="530" stroke="#333" stroke-width="1"/>
  <text x="647" y="548" text-anchor="middle" font-family="Inter, sans-serif" font-style="italic" font-weight="700" font-size="12" fill="${bodyDark}">Date</text>
</svg>`;
    } else if (backgroundImageUrl) {
      // Generate a signed URL for the background image to embed in SVG.
      // Backward compatibility: older rows may have been saved without the tenant_id prefix.
      const candidatePaths = [
        backgroundImageUrl,
        backgroundImageUrl.startsWith(`${tenant_id}/`) ? null : `${tenant_id}/${backgroundImageUrl}`,
      ].filter(Boolean) as string[];

      let bgDataUri = "";
      for (const candidate of candidatePaths) {
        const { data: bgSignedData } = await supabase.storage
          .from("church-documents")
          .createSignedUrl(candidate, 60 * 60);
        if (!bgSignedData?.signedUrl) continue;
        try {
          const imgResp = await fetch(bgSignedData.signedUrl);
          if (!imgResp.ok) continue;
          const imgBuf = await imgResp.arrayBuffer();
          const contentType = imgResp.headers.get("content-type") || "image/png";
          const base64 = encodeBase64(new Uint8Array(imgBuf));
          bgDataUri = `data:${contentType};base64,${base64}`;
          break;
        } catch (e) {
          console.warn("Failed to fetch background image candidate:", candidate, e);
        }
      }
      if (!bgDataUri) {
        console.warn("Background image could not be embedded; falling back to solid color. Path:", backgroundImageUrl);
      }

      const nameY = textPositions.name_y || 280;
      const trainingY = textPositions.training_y || 340;
      const dateY = textPositions.date_y || 380;
      const sigY = textPositions.signatory_y || 500;
      const certNumY = dateY + 25;

      svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="842" height="595" viewBox="0 0 842 595">
  
  ${bgDataUri ? `<image href="${bgDataUri}" width="842" height="595" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="842" height="595" fill="${bgColor}"/>`}
  <!-- Member name -->
  <text x="421" y="${nameY}" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="32" fill="${textColor}" stroke="rgba(255,255,255,0.35)" stroke-width="0.6" paint-order="stroke">${escapeXml(memberName)}</text>
  <!-- Training type -->
  <text x="421" y="${trainingY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="18" fill="${textColor}">${escapeXml(training_type)}</text>
  <!-- Date -->
  <text x="421" y="${dateY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="${textColor}" opacity="0.75">Completed on ${formattedDate}</text>
  <!-- Certificate number -->
  <text x="421" y="${certNumY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="10" fill="${textColor}" opacity="0.6">Certificate No: ${certificateNumber}</text>
  ${signatoryName ? `
  <line x1="301" y1="${sigY - 20}" x2="541" y2="${sigY - 20}" stroke="${textColor}" stroke-opacity="0.4" stroke-width="1"/>
  <text x="421" y="${sigY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="13" fill="${textColor}">${escapeXml(signatoryName)}</text>
  <text x="421" y="${sigY + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="11" fill="${textColor}" opacity="0.75">${escapeXml(signatoryTitle)}</text>
  ` : ""}
</svg>`;
    } else {
      // Default SVG-generated design
      svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="842" height="595" viewBox="0 0 842 595">
  
  <!-- Background -->
  <rect width="842" height="595" fill="${bgColor}"/>
  <!-- Inner frame -->
  <rect x="24" y="24" width="794" height="547" rx="8" fill="white" stroke="${accentColor}" stroke-width="3"/>
  <!-- Decorative border -->
  <rect x="36" y="36" width="770" height="523" rx="4" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="8,4"/>
  <!-- Accent bar -->
  <rect x="321" y="60" width="200" height="4" rx="2" fill="${accentColor}"/>
  <!-- Church name -->
  <text x="421" y="100" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${bgColor}" letter-spacing="3">${churchName.toUpperCase()}</text>
  <!-- Title -->
  <text x="421" y="150" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="36" fill="${bgColor}">CERTIFICATE</text>
  <text x="421" y="180" text-anchor="middle" font-family="Inter, sans-serif" font-weight="500" font-size="14" fill="#666" letter-spacing="5">OF COMPLETION</text>
  <!-- Custom message -->
  <text x="421" y="220" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="12" fill="#888">${customMessage}</text>
  <!-- Member name -->
  <text x="421" y="280" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="32" fill="${bgColor}">${escapeXml(memberName)}</text>
  <!-- Underline -->
  <line x1="221" y1="295" x2="621" y2="295" stroke="${accentColor}" stroke-width="1.5"/>
  <!-- Training type -->
  <text x="421" y="340" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="18" fill="${bgColor}">${escapeXml(training_type)}</text>
  <!-- Date -->
  <text x="421" y="380" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#666">Completed on ${formattedDate}</text>
  <!-- Certificate number -->
  <text x="421" y="405" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="10" fill="#aaa">Certificate No: ${certificateNumber}</text>
  <!-- Signatory -->
  ${signatoryName ? `
  <line x1="301" y1="480" x2="541" y2="480" stroke="#ccc" stroke-width="1"/>
  <text x="421" y="500" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="13" fill="${bgColor}">${escapeXml(signatoryName)}</text>
  <text x="421" y="518" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="11" fill="#888">${escapeXml(signatoryTitle)}</text>
  ` : ""}
  <!-- Bottom accent -->
  <rect x="321" y="545" width="200" height="4" rx="2" fill="${accentColor}"/>
</svg>`;
    }

    // Rasterise SVG → PNG and upload to a tenant-scoped path
    let pngBytes: Uint8Array;
    try {
      pngBytes = await renderSvgToPng(svgCert);
    } catch (renderErr) {
      console.error("PNG render failed:", renderErr);
      return new Response(
        JSON.stringify({ error: "Failed to render certificate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preview mode: return image without persisting, uploading, emailing, or auditing.
    if (isPreview) {
      const base64 = encodeBase64(pngBytes);
      return new Response(
        JSON.stringify({
          preview: true,
          image_base64: base64,
          content_type: "image/png",
          certificate_number: certificateNumber,
          training_type,
          completion_date: certDate,
          member_name: memberName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }



    const filePath = `${tenant_id}/certificates/${member_id}/${certificateNumber}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("church-documents")
      .upload(filePath, pngBytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload certificate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert or update completion record (tenant-scoped)
    let completion: unknown = null;
    let insertErr: unknown = null;
    if (existing) {
      const { data, error } = await supabase
        .from("training_completions")
        .update({
          completion_date: certDate,
          certificate_url: filePath,
          issued_by: userId,
          ...(notes !== undefined ? { notes: notes || null } : {}),
        })
        .eq("id", existing.id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      completion = data;
      insertErr = error;
    } else {
      const { data, error } = await supabase
        .from("training_completions")
        .insert({
          member_id,
          training_type,
          completion_date: certDate,
          certificate_number: certificateNumber,
          certificate_url: filePath,
          issued_by: userId,
          notes: notes || null,
          tenant_id,
        })
        .select()
        .single();
      completion = data;
      insertErr = error;
    }

    if (insertErr) {
      console.error("issue-certificate insert error:", insertErr);
      return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update member boolean fields if applicable
    const fieldMap: Record<string, string> = {
      "Believers Foundation Class (BFC)": "bfc_completed",
      "BFC": "bfc_completed",
      "Basic Certificate Course (BCC)": "bcc_completed",
      "BCC": "bcc_completed",
      "Leadership Certificate Course (LCC)": "lcc_completed",
      "LCC": "lcc_completed",
      "Leadership Diploma Course (LDC)": "ldc_completed",
      "LDC": "ldc_completed",
    };
    const boolField = fieldMap[training_type];
    if (boolField) {
      await supabase
        .from("members")
        .update({ [boolField]: true })
        .eq("id", member_id);
    }

    // Email certificate to member if they have an email
    if (member.email) {
      try {
        const { data: signedUrl } = await supabase.storage
          .from("church-documents")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7, { download: `${certificateNumber}.png` }); // 7 days

        // Lookup or create unsubscribe token
        const { data: tokenRow } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", member.email)
          .maybeSingle();

        let unsubToken = tokenRow?.token;
        if (!unsubToken) {
          unsubToken = crypto.randomUUID();
          await supabase.from("email_unsubscribe_tokens").insert({
            email: member.email,
            token: unsubToken,
          });
        }

        const senderDomain = "notify.app.churchmanagementsuite.org";
        const messageId = `cert-${crypto.randomUUID()}`;
        const plainText = `Congratulations, ${member.first_name}!\n\nYou have successfully completed ${training_type} at ${churchName}.\n\nYour certificate number is: ${certificateNumber}\n\n${signedUrl?.signedUrl ? `Download your certificate: ${signedUrl.signedUrl}\n\n` : ""}You can also download your certificate anytime from your profile page.`;

        const emailPayload = {
          to: member.email,
          from: `Winners Chapel Cardiff <noreply@${senderDomain}>`,
          sender_domain: senderDomain,
          subject: `Your ${training_type} Certificate - ${churchName}`,
          text: plainText,
          html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:${bgColor};padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escapeXml(churchName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:${bgColor};font-size:22px;">Congratulations, ${escapeXml(member.first_name)}! 🎉</h2>
          <p style="margin:0 0 12px;color:#333;font-size:15px;line-height:1.6;">You have successfully completed <strong>${escapeXml(training_type)}</strong> at ${escapeXml(churchName)}.</p>
          <p style="margin:0 0 24px;color:#333;font-size:15px;">Your certificate number is: <strong>${certificateNumber}</strong></p>
          ${signedUrl?.signedUrl ? `<p style="text-align:center;"><a href="${signedUrl.signedUrl}" style="display:inline-block;padding:12px 24px;background-color:${bgColor};color:white;text-decoration:none;border-radius:6px;font-weight:600;">Download Certificate</a></p>` : ""}
          <p style="margin:24px 0 0;color:#888;font-size:12px;">You can also download your certificate anytime from your profile page.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          purpose: "transactional",
          label: "certificate",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
          unsubscribe_token: unsubToken,
          ...(tenant_id ? { tenant_id } : {}),
        };

        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: emailPayload,
        });

        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "certificate",
          recipient_email: member.email,
          status: "pending",
          ...(tenant_id ? { tenant_id } : {}),
        });
      } catch (emailErr) {
        console.warn("Failed to send certificate email:", emailErr);
        // Don't fail the whole operation
      }
    }

    await writeAudit(supabase, {
      tenant_id,
      user_id: userId,
      action: reissue ? "certificate_reissued" : "certificate_issued",
      entity_type: "training_completions",
      entity_id: (completion as { id?: string } | null)?.id ?? existing?.id ?? null,
      details: {
        member_id,
        training_type,
        completion_date,
        certificate_number: certificateNumber,
        notes,
        source: "issue-certificate",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        completion,
        certificate_number: certificateNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("issue-certificate error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
