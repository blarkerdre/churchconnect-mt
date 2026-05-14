import { forwardRef } from "react";

/**
 * Visual preview of an invoice/receipt.
 * Mirrors the email template styling and is used both for on-screen preview
 * and as the source for client-side PDF capture (html2canvas + jsPDF).
 */
const InvoicePreview = forwardRef(function InvoicePreview({ invoice, churchName }, ref) {
  if (!invoice) return null;

  const isReceipt = invoice.document_type === "receipt";
  const heading = isReceipt ? "Receipt" : "Invoice";
  const billTo = invoice.bill_to || {};
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const fmt = (n) => Number(n || 0).toFixed(2);

  const ISSUER = {
    name: "DomiFort Solutions Limited",
    address: "Flat 9, 2 Oriana Court, Crunden Road, South Croydon, United Kingdom, CR2 6GZ",
    companyReg: "17169095",
    email: "info@domifortsolutions.com",
    website: "www.domifortsolutions.com",
    sortCode: "04-06-05",
    accountNumber: "31369676",
  };

  return (
    <div
      ref={ref}
      style={{
        backgroundColor: "#ffffff",
        color: "#333333",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "24px",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#1e3a5f",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#faf6f0" }}>{heading}</div>
        <div style={{ fontSize: "12px", color: "#d4b86a", letterSpacing: "1px", marginTop: "4px" }}>
          {invoice.invoice_number}
        </div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: "13px", marginBottom: "8px" }}>
        <span style={{ display: "inline-block", width: "80px", color: "#999" }}>Issued</span>
        <span>{invoice.issue_date}</span>
      </div>
      {!isReceipt && invoice.due_date && (
        <div style={{ fontSize: "13px", marginBottom: "8px" }}>
          <span style={{ display: "inline-block", width: "80px", color: "#999" }}>Due</span>
          <span>{invoice.due_date}</span>
        </div>
      )}
      {isReceipt && (
        <div style={{ fontSize: "13px", marginBottom: "8px" }}>
          <span style={{ display: "inline-block", width: "80px", color: "#999" }}>Status</span>
          <span style={{ color: "#0a7d3b", fontWeight: "bold" }}>PAID</span>
        </div>
      )}

      <hr style={{ border: "none", borderTop: "1px solid #e8e0d4", margin: "16px 0" }} />

      {/* From */}
      <div style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
        From
      </div>
      <div style={{ fontSize: "13px", lineHeight: 1.6, marginBottom: "16px" }}>
        <strong>{ISSUER.name}</strong>
        <br />{ISSUER.address}
        <br />Company Reg: {ISSUER.companyReg}
        <br />{ISSUER.email} · {ISSUER.website}
      </div>

      {/* Bill To */}
      <div style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
        Bill To
      </div>
      <div style={{ fontSize: "14px", lineHeight: 1.6, marginBottom: "16px" }}>
        <strong>{billTo.name || churchName || "—"}</strong>
        {billTo.email && <><br />{billTo.email}</>}
        {billTo.address && <><br />{billTo.address}</>}
      </div>

      {/* Line items */}
      <div
        style={{
          backgroundColor: "#faf6f0",
          border: "1px solid #e8e0d4",
          borderRadius: "8px",
          padding: "16px 20px",
        }}
      >
        <div style={{ fontSize: "13px", borderBottom: "1px solid #e8e0d4", paddingBottom: "8px", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
          <strong>Description</strong>
          <strong>Amount</strong>
        </div>
        {lineItems.length === 0 && (
          <div style={{ fontSize: "13px", color: "#999", padding: "8px 0" }}>No line items.</div>
        )}
        {lineItems.map((item, idx) => (
          <div key={idx} style={{ fontSize: "13px", padding: "6px 0", display: "flex", justifyContent: "space-between" }}>
            <span>
              {item.description || "—"}
              {item.quantity && Number(item.quantity) !== 1 ? ` × ${item.quantity}` : ""}
            </span>
            <span>{invoice.currency} {fmt(item.amount)}</span>
          </div>
        ))}
        <hr style={{ border: "none", borderTop: "1px solid #e8e0d4", margin: "12px 0" }} />
        <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
          <span>Subtotal</span>
          <span>{invoice.currency} {fmt(invoice.subtotal)}</span>
        </div>
        {Number(invoice.tax_amount) > 0 && (
          <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>Tax</span>
            <span>{invoice.currency} {fmt(invoice.tax_amount)}</span>
          </div>
        )}
        <div
          style={{
            fontSize: "15px",
            color: "#1e3a5f",
            display: "flex",
            justifyContent: "space-between",
            paddingTop: "8px",
            marginTop: "8px",
            borderTop: "2px solid #1e3a5f",
          }}
        >
          <strong>Total</strong>
          <strong>{invoice.currency} {fmt(invoice.total)}</strong>
        </div>
      </div>

      {/* Payment Details (invoices only) */}
      {!isReceipt && (
        <>
          <div style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", margin: "16px 0 4px" }}>
            Payment Details
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.7, padding: "12px 16px", backgroundColor: "#f6f8fb", border: "1px solid #e0e6ef", borderRadius: "6px" }}>
            <div><strong>Account Name:</strong> {ISSUER.name}</div>
            <div><strong>Sort Code:</strong> {ISSUER.sortCode}</div>
            <div><strong>Account Number:</strong> {ISSUER.accountNumber}</div>
            <div><strong>Reference:</strong> {invoice.invoice_number}</div>
          </div>
        </>
      )}

      {invoice.notes && (
        <>
          <div style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", margin: "16px 0 4px" }}>
            Notes
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.5 }}>{invoice.notes}</div>
        </>
      )}

      {invoice.terms && (
        <>
          <div style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", margin: "16px 0 4px" }}>
            Terms
          </div>
          <div style={{ fontSize: "12px", color: "#666", lineHeight: 1.5 }}>{invoice.terms}</div>
        </>
      )}

      <hr style={{ border: "none", borderTop: "1px solid #e8e0d4", margin: "20px 0" }} />
      <div style={{ fontSize: "11px", color: "#999" }}>
        Issued by {ISSUER.name} · Company No. {ISSUER.companyReg} · {ISSUER.email} · {ISSUER.website}
      </div>
    </div>
  );
});

export default InvoicePreview;
