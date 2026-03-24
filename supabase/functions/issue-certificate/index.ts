import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Check caller is admin or unit_leader
    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: userId });
    const { data: isLeaderResult } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "unit_leader",
    });
    if (!isAdminResult && !isLeaderResult) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { member_id, training_type, completion_date, notes, tenant_id } = body;

    if (!member_id || !training_type) {
      return new Response(
        JSON.stringify({ error: "member_id and training_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("training_completions")
      .select("id")
      .eq("member_id", member_id)
      .eq("training_type", training_type)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Certificate already issued for this training" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get member info
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("*")
      .eq("id", member_id)
      .single();
    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get template (case-insensitive + fallback to "Default" template)
    let { data: template } = await supabase
      .from("certificate_templates")
      .select("*")
      .ilike("training_type", training_type.trim())
      .maybeSingle();

    if (!template) {
      const { data: defaultTpl } = await supabase
        .from("certificate_templates")
        .select("*")
        .ilike("training_type", "default")
        .maybeSingle();
      template = defaultTpl;
    }

    const churchName = template?.church_name || "Winners Chapel International Cardiff";
    const signatoryName = template?.signatory_name || "";
    const signatoryTitle = template?.signatory_title || "";
    const bgColor = template?.background_color || "#1a2d4d";
    const accentColor = template?.accent_color || "#c5a028";
    const customMessage =
      template?.custom_message ||
      "This is to certify that the above named has successfully completed";
    const backgroundImageUrl = template?.background_image_url || null;
    const textPositions = template?.text_positions || { name_y: 280, training_y: 340, date_y: 380, signatory_y: 500 };

    // Generate certificate number
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
    const certificateNumber = `CERT-${prefix}-${year}-${seq}`;

    const certDate = completion_date || new Date().toISOString().split("T")[0];
    const formattedDate = new Date(certDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const memberName = `${member.first_name} ${member.last_name}`;

    // Build SVG certificate
    let svgCert: string;

    if (backgroundImageUrl) {
      // Generate a signed URL for the background image to embed in SVG
      const { data: bgSignedData } = await supabase.storage
        .from("church-documents")
        .createSignedUrl(backgroundImageUrl, 60 * 60); // 1 hour

      // Download the image and convert to base64 for embedding
      let bgDataUri = "";
      if (bgSignedData?.signedUrl) {
        try {
          const imgResp = await fetch(bgSignedData.signedUrl);
          const imgBuf = await imgResp.arrayBuffer();
          const contentType = imgResp.headers.get("content-type") || "image/png";
          const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
          bgDataUri = `data:${contentType};base64,${base64}`;
        } catch (e) {
          console.warn("Failed to fetch background image, falling back to default design:", e);
        }
      }

      const nameY = textPositions.name_y || 280;
      const trainingY = textPositions.training_y || 340;
      const dateY = textPositions.date_y || 380;
      const sigY = textPositions.signatory_y || 500;
      const certNumY = dateY + 25;

      svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="842" height="595" viewBox="0 0 842 595">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;family=Inter:wght@400;500;600&amp;display=swap');
    </style>
  </defs>
  ${bgDataUri ? `<image href="${bgDataUri}" width="842" height="595" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="842" height="595" fill="${bgColor}"/>`}
  <!-- Member name -->
  <text x="421" y="${nameY}" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="32" fill="${bgColor}">${escapeXml(memberName)}</text>
  <!-- Training type -->
  <text x="421" y="${trainingY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="18" fill="${bgColor}">${escapeXml(training_type)}</text>
  <!-- Date -->
  <text x="421" y="${dateY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#666">Completed on ${formattedDate}</text>
  <!-- Certificate number -->
  <text x="421" y="${certNumY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="10" fill="#aaa">Certificate No: ${certificateNumber}</text>
  ${signatoryName ? `
  <line x1="301" y1="${sigY - 20}" x2="541" y2="${sigY - 20}" stroke="#ccc" stroke-width="1"/>
  <text x="421" y="${sigY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="13" fill="${bgColor}">${escapeXml(signatoryName)}</text>
  <text x="421" y="${sigY + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="11" fill="#888">${escapeXml(signatoryTitle)}</text>
  ` : ""}
</svg>`;
    } else {
      // Default SVG-generated design
      svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="842" height="595" viewBox="0 0 842 595">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;family=Inter:wght@400;500;600&amp;display=swap');
    </style>
  </defs>
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

    // Upload SVG to storage
    const filePath = `certificates/${member_id}/${certificateNumber}.svg`;
    const { error: uploadErr } = await supabase.storage
      .from("church-documents")
      .upload(filePath, new Blob([svgCert], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload certificate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert completion record
    const { data: completion, error: insertErr } = await supabase
      .from("training_completions")
      .insert({
        member_id,
        training_type,
        completion_date: certDate,
        certificate_number: certificateNumber,
        certificate_url: filePath,
        issued_by: userId,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
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
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

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

        const senderDomain = "notify.churchmanagementsuite.org";
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
        });
      } catch (emailErr) {
        console.warn("Failed to send certificate email:", emailErr);
        // Don't fail the whole operation
      }
    }

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
    return new Response(JSON.stringify({ error: err.message }), {
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
