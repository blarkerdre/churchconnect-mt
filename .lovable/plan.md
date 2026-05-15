## Goal
Make the downloaded invoice/receipt PDF always fit on a single A4 page.

## Change
In `src/components/tenants/InvoiceEditorDialog.jsx` — `downloadPdf()`:

- Replace the multi-page `addImage` + `while (heightLeft > 0) pdf.addPage()` loop with a single fit-to-page render.
- Compute the image dimensions so the captured preview is scaled to fit within both the page width (A4 width − 20mm margin) and the page height (A4 height − 20mm margin), preserving aspect ratio.
- Center the image horizontally and place it at the top margin.

## Technical detail
```js
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const maxW = pageWidth - 20;
const maxH = pageHeight - 20;
const ratio = Math.min(maxW / canvas.width, maxH / canvas.height) * (canvas.width / (canvas.width)); 
// simpler: scale by px→mm via min ratio
const imgWidth  = canvas.width  * Math.min(maxW / canvas.width, maxH / canvas.height);
const imgHeight = canvas.height * Math.min(maxW / canvas.width, maxH / canvas.height);
const x = (pageWidth - imgWidth) / 2;
pdf.addImage(imgData, "PNG", x, 10, imgWidth, imgHeight);
```

No changes to `InvoicePreview.jsx` or backend — content is unchanged, only scaled to fit.
