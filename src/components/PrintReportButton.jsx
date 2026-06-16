import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/**
 * Renders a "Print Report" button.
 * `buildRows` is called at print time and should return { title, headers: [], rows: [[]] }
 */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function PrintReportButton({ buildRows, label = "Print Report" }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    const { title, headers, rows } = buildRows();
    setPrinting(true);

    const tableRows = rows.map(r =>
      `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join("")}</tr>`
    ).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1e3a5f; }
          p.meta { font-size: 11px; color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e3a5f; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f8fafc; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${escHtml(title)}</h1>
        <p class="meta">Generated: ${escHtml(new Date().toLocaleString("en-GB"))}</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    setPrinting(false);
  };

  return (
    <Button variant="outline" onClick={handlePrint} disabled={printing}>
      <Printer className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}