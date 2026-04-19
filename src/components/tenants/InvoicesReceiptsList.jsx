import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Receipt, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import InvoiceEditorDialog from "./InvoiceEditorDialog";

export default function InvoicesReceiptsList({ tenant, payments = [] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const tenantId = tenant?.id;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["tenant-invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ document_type, payment_id }) => {
      const { data, error } = await supabase.functions.invoke("generate-tenant-invoice", {
        body: { tenant_id: tenantId, document_type, payment_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-invoices", tenantId] });
      setEditing(invoice);
    },
    onError: (err) => toast({ title: "Generate failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("tenant_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      queryClient.invalidateQueries({ queryKey: ["tenant-invoices", tenantId] });
    },
    onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const statusVariant = (status) => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "default";
      case "draft": return "secondary";
      case "void": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Invoices & Receipts</h4>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate({ document_type: "invoice" })}
          >
            {generateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
            New Invoice
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={generateMutation.isPending || payments.length === 0}
            onClick={() => {
              const latestCompleted = payments.find((p) => p.status === "completed");
              if (!latestCompleted) {
                toast({ title: "No completed payment", description: "Record a payment first.", variant: "destructive" });
                return;
              }
              generateMutation.mutate({ document_type: "receipt", payment_id: latestCompleted.id });
            }}
          >
            <Receipt className="h-3 w-3 mr-1" />
            New Receipt
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          No invoices or receipts yet.
        </p>
      ) : (
        <div className="max-h-64 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Number</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Total</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
                  <TableCell className="text-xs capitalize">{inv.document_type}</TableCell>
                  <TableCell className="text-xs font-medium">
                    {inv.currency} {Number(inv.total).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {inv.document_type === "receipt" ? inv.issue_date : (inv.due_date || inv.issue_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(inv.status)} className="text-[10px] capitalize">{inv.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(inv)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Delete ${inv.invoice_number}?`)) {
                            deleteMutation.mutate(inv.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <InvoiceEditorDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          invoice={editing}
          tenant={tenant}
        />
      )}
    </div>
  );
}
