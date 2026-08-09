import { supabase } from "@/integrations/supabase/client";

/**
 * Create a signed URL for a stored certificate file, with a legacy fallback
 * for rows saved before the tenant_id/ prefix was applied.
 */
export async function signedCertificateUrl(path, { tenantId, download } = {}) {
  if (!path) return null;
  const opts = download ? { download } : undefined;
  const trySign = (p) =>
    supabase.storage.from("church-documents").createSignedUrl(p, 600, opts);

  let { data, error } = await trySign(path);
  if ((error || !data?.signedUrl) && tenantId && !path.startsWith(`${tenantId}/`)) {
    const retry = await trySign(`${tenantId}/${path}`);
    data = retry.data;
  }
  return data?.signedUrl || null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(blob);
  });
}

/**
 * Bulk download issued certificates as a merged landscape A4 PDF or a ZIP of images.
 *
 * certs: [{ id, certificate_number, certificate_url }]
 * mode: "merged" | "zip"
 * Returns { downloaded, skipped }.
 */
export async function bulkDownloadCertificates({
  certs = [],
  mode = "merged",
  tenantId = null,
  baseName = "certificates",
  onProgress,
}) {
  const withFile = certs.filter((c) => c.certificate_url);
  const skipped = certs.length - withFile.length;
  if (withFile.length === 0) return { downloaded: 0, skipped };

  const files = [];
  let i = 0;
  for (const c of withFile) {
    i += 1;
    onProgress?.(i, withFile.length);
    const url = await signedCertificateUrl(c.certificate_url, { tenantId });
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      files.push({ cert: c, blob: await res.blob() });
    } catch {
      // skip unreadable file
    }
  }
  if (files.length === 0) throw new Error("No certificate files could be fetched");

  const extOf = (c) => {
    const p = String(c.certificate_url || "");
    if (p.endsWith(".pdf")) return "pdf";
    if (p.endsWith(".svg")) return "svg";
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "jpg";
    return "png";
  };

  if (mode === "zip") {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    files.forEach((f, idx) => {
      const name = f.cert.certificate_number || f.cert.id || `certificate-${idx + 1}`;
      zip.file(`${name}.${extOf(f.cert)}`, f.blob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    let first = true;
    let added = 0;
    for (const f of files) {
      const dataUrl = await blobToDataUrl(f.blob);
      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) continue;
      if (!first) doc.addPage();
      first = false;
      added += 1;
      const props = doc.getImageProperties(dataUrl);
      const ratio = props.width / props.height;
      let w = pw - 10;
      let h = w / ratio;
      if (h > ph - 10) {
        h = ph - 10;
        w = h * ratio;
      }
      doc.addImage(dataUrl, (pw - w) / 2, (ph - h) / 2, w, h);
    }
    if (added === 0) throw new Error("Selected certificates are not image files that can be merged");
    doc.save(`${baseName}.pdf`);
  }

  return { downloaded: files.length, skipped };
}
