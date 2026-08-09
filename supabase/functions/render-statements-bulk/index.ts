import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";
import JSZip from "npm:jszip@3.10.1";
import {
  buildStatementSharedContext,
  collectStatementInputsBulk,
  renderStatementOnDoc,
} from "../_shared/generate-statement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "exam-statements";
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24; // 24 hours
const MAX_MEMBERS = 15;

function safeName(s: string) {
  return String(s || "student").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "_") ||
    "student";
}

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
    const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const tenantId = body?.tenant_id;
    const courseId = body?.course_id;
    const memberIds: string[] = Array.isArray(body?.member_ids) ? body.member_ids : [];
    const mode = body?.mode === "zip" ? "zip" : "merged";

    if (!tenantId || !courseId || memberIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "tenant_id, course_id and member_ids are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (memberIds.length > MAX_MEMBERS) {
      return new Response(
        JSON.stringify({ error: `A maximum of ${MAX_MEMBERS} students can be processed per request` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await admin.rpc("is_admin", {
      _user_id: userId,
      _tenant_id: tenantId,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const failed: Array<{ member_id: string; error: string }> = [];
    let generated = 0;
    let bytes: Uint8Array | null = null;
    let contentType = "application/pdf";
    let ext = "pdf";

    if (mode === "merged") {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let first = true;
      for (const mid of memberIds) {
        try {
          const collected = await collectStatementInput(admin, tenantId, courseId, mid);
          if (!first) doc.addPage();
          first = false;
          await renderStatementOnDoc(doc, collected.statementInput);
          generated += 1;
        } catch (e) {
          failed.push({ member_id: mid, error: (e as Error).message });
        }
      }
      if (generated === 0) {
        return new Response(
          JSON.stringify({ error: "No statements could be generated", failed }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      bytes = new Uint8Array(doc.output("arraybuffer"));
    } else {
      const zip = new JSZip();
      for (const mid of memberIds) {
        try {
          const collected = await collectStatementInput(admin, tenantId, courseId, mid);
          const pdf = await buildStatementPdf(collected.statementInput);
          zip.file(`${safeName(collected.memberName)}_statement.pdf`, pdf);
          generated += 1;
        } catch (e) {
          failed.push({ member_id: mid, error: (e as Error).message });
        }
      }
      if (generated === 0) {
        return new Response(
          JSON.stringify({ error: "No statements could be generated", failed }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      bytes = await zip.generateAsync({ type: "uint8array" });
      contentType = "application/zip";
      ext = "zip";
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = ext === "zip" ? "statements-of-result" : "statement-of-result-merged";
    const path = `${tenantId}/${courseId}/bulk/${stamp}-${baseName}.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes!, { contentType, upsert: true });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRES_IN, {
        download: `${baseName}.${ext}`,
      });
    if (signErr || !signed?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        generated,
        failed,
        path,
        signed_url: signed.signedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("render-statements-bulk error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
