import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Render a DOM node to a single-page A4 PDF and save it. */
export async function saveNodeAsPdf(node, filename) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const w = pdf.internal.pageSize.getWidth() - 20;
  const h = pdf.internal.pageSize.getHeight() - 20;
  const s = Math.min(w / canvas.width, h / canvas.height);
  const iw = canvas.width * s;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pdf.internal.pageSize.getWidth() - iw) / 2, 10, iw, canvas.height * s);
  pdf.save(filename);
}
