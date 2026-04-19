import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Download, Send, Loader2, Save } from "lucide-react";
import InvoicePreview from "./InvoicePreview";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function InvoiceEditorDialog({ open, onOpenChange, invoice, tenant }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previewRef = useRef(null);
  const [form, setForm] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Hydrate form from incoming invoice
  useEffect(() => {
    if (invoice) {
      const billTo = invoice.bill_to || {};
      setForm({
        ...invoice,
        bill_to_name: billTo.name || tenant?.name || "",
        bill_to_email: billTo.email || tenant?.contact_email || "",
        bill_to_address: billTo.address || "",
        line_items: Array.isArray(invoice.line_items) ? invoice.line_items : [],
        notes: invoice.notes || "",
        terms: invoice.terms || "",
        due_date: invoice.due_date || "",
      });
      setRecipientEmail(billTo.email || tenant?.contact_email || "");
    }
  }, [invoice, tenant]);

  // Recompute totals from line items
  const computed = useMemo(() => {
    const items = form?.line_items || [];
    const subtotal = items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
    const tax = Number(form?.tax_amount) || 0;
    return { subtotal, tax_amount: tax, total: subtotal + tax };
  }, [form?.line_items, form?.tax_amount]);

  const previewInvoice = useMemo(() => {
    if (!form) return null;
    return {
      ...form,
      bill_to: {
        name: form.bill_to_name,
        email: form.bill_to_email,
        address: form.bill_to_address,
      },
      subtotal: computed.subtotal,
      tax_amount: computed.tax_amount,
      total: computed.total,
    };
  }, [form, computed]);

  const updateLineItem = (idx, patch) => {
    setForm((f) => {
      const items = [...f.line_items];
      const next = { ...items[idx], ...patch };
      next.amount = (Number(next.quantity) || 0) * (Number(next.unit_price) || 0);
      items[idx] = next;
      return { ...f, line_items: items };
    });
  };

  const addLineItem = () => {
    setForm((f) => ({
      ...f,
      line_items: [...(f.line_items || []), { description: "", quantity: 1, unit_price: 0, amount: 0 }],
    }));
  };

  const removeLineItem = (idx) => {
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, i) => i !== idx) }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        line_items: form.line_items,
        bill_to: {
          name: form.bill_to_name,
          email: form.bill_to_email,
          address: form.bill_to_address,
        },
        notes: form.notes,
        terms: form.terms,
        due_date: form.due_date || null,
        subtotal: computed.subtotal,
        tax_amount: computed.tax_amount,
        total: computed.total,
      };
      const { error } = await supabase
        .from("tenant_invoices")
        .update(payload)
        .eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      queryClient.invalidateQueries({ queryKey: ["tenant-invoices", tenant?.id] });
    },
    onError: (err) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      // Save first to ensure latest data is sent
      await saveMutation.mutateAsync();
      const { data, error } = await supabase.functions.invoke("send-tenant-invoice", {
        body: { invoice_id: invoice.id, recipient_email: recipientEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Sent", description: `Email queued to ${recipientEmail}` });
      queryClient.invalidateQueries({ queryKey: ["tenant-invoices", tenant?.id] });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const downloadPdf = async () => {
    if (!previewRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 10;
      while (heightLeft > 0) {
        pdf.addPage();
        position = 10 - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const label = invoice.document_type === "receipt" ? "Receipt" : "Invoice";
      pdf.save(`${label}-${invoice.invoice_number}.pdf`);
    } catch (err) {
      toast({ title: "PDF generation failed", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!form) return null;

  const docLabel = invoice.document_type === "receipt" ? "Receipt" : "Invoice";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {docLabel} {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Editor */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Bill To</h4>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={form.bill_to_name} onChange={(e) => setForm({ ...form, bill_to_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.bill_to_email} onChange={(e) => setForm({ ...form, bill_to_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Textarea rows={2} value={form.bill_to_address} onChange={(e) => setForm({ ...form, bill_to_address: e.target.value })} />
                </div>
              </div>
            </div>

            {invoice.document_type === "invoice" && (
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Line Items</h4>
                <Button size="sm" variant="outline" onClick={addLineItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {form.line_items.length === 0 && (
                <p className="text-xs text-muted-foreground">No line items. Click "Add" to start.</p>
              )}
              {form.line_items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder="Description"
                      value={item.description || ""}
                      onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                      className="flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removeLineItem(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Qty</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={item.quantity ?? 1}
                        onChange={(e) => updateLineItem(idx, { quantity: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price ?? 0}
                        onChange={(e) => updateLineItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Amount</Label>
                      <Input readOnly value={Number(item.amount || 0).toFixed(2)} />
                    </div>
                  </div>
                </div>
              ))}

              <div className="text-xs text-right space-y-1 pt-2">
                <div>Subtotal: <span className="font-medium">{form.currency} {computed.subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-end gap-2">
                  <span>Tax:</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tax_amount || 0}
                    onChange={(e) => setForm({ ...form, tax_amount: Number(e.target.value) || 0 })}
                    className="w-24 h-7"
                  />
                </div>
                <div className="text-sm font-semibold">Total: {form.currency} {computed.total.toFixed(2)}</div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Terms</Label>
              <Textarea rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>

            <Separator />

            <div>
              <Label className="text-xs">Send To</Label>
              <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="recipient@church.com" />
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-auto max-h-[60vh] lg:max-h-[70vh] bg-white">
            <InvoicePreview ref={previewRef} invoice={previewInvoice} churchName={tenant?.name} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={downloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !recipientEmail}>
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
