import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Download, Eye, FileText, Loader2, Receipt } from "lucide-react";
import InvoicePreview from "@/components/tenants/InvoicePreview";
import { saveNodeAsPdf } from "@/lib/pdf-from-node";

const label = (d) => (d.document_type === "receipt" ? "Receipt" : "Invoice");
const sourceLabel = (d) => (d.source === "sms" ? "SMS" : d.source === "subscription" ? "Subscription" : "Other");

export default function ChurchInvoicesCard({ tenantId, churchName }) {
  const [open, setOpen] = useState(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["church-invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const download = async () => {
    if (!ref.current || !open) return;
    setBusy(true);
    try {
      await saveNodeAsPdf(ref.current, `${label(open)}-${open.invoice_number}.pdf`);
    } catch (e) {
      toast({ title: "Download failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const show = (d, dl) => { setOpen(d); setAutoDownload(dl); };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4 text-accent" /> Invoices & receipts</h4>
      {isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No invoices or receipts yet.</p>
      ) : (
        <div className="divide-y rounded-lg border max-h-96 overflow-y-auto">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 p-2 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                  {d.document_type === "receipt" ? <Receipt className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {label(d)} {d.invoice_number}
                  <Badge variant="outline" className="text-[10px]">{sourceLabel(d)}</Badge>
                  {d.document_type === "invoice" && (
                    <Badge variant={d.status === "paid" ? "default" : d.status === "void" ? "destructive" : "secondary"} className="text-[10px]">
                      {d.status === "sent" ? "Unpaid" : d.status === "void" ? "Cancelled" : "Paid"}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">{d.issue_date} · {d.currency} {Number(d.total || 0).toFixed(2)}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => show(d, false)}><Eye className="h-3.5 w-3.5 mr-1" />Preview</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => show(d, true)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open && `${label(open)} ${open.invoice_number}`}</DialogTitle></DialogHeader>
          <div className="overflow-x-auto">
            <InvoicePreview
              ref={(node) => {
                ref.current = node;
                if (node && autoDownload) { setAutoDownload(false); setTimeout(download, 50); }
              }}
              invoice={open}
              churchName={churchName}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={download} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
