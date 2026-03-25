import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, Trash2, ShieldAlert, Download, RotateCcw, Archive, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import JSZip from "jszip";

const CONFIRMATION_PHRASE = "DELETE ALL DATA";

function jsonToCsv(data) {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export default function DangerZoneSection() {
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const { data: archives, isLoading: archivesLoading } = useQuery({
    queryKey: ["purged-archives", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("purged_data_archives")
        .select("id, purged_at, expires_at, status")
        .eq("tenant_id", tenantId)
        .eq("status", "archived")
        .gt("expires_at", new Date().toISOString())
        .order("purged_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const resetAndClose = () => {
    setDialogOpen(false);
    setStep(1);
    setPhrase("");
    setPassword("");
    setLoading(false);
  };

  const handleExport = async () => {
    if (!tenantId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-tenant-data", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const exportData = data.data;
      const zip = new JSZip();

      for (const [table, rows] of Object.entries(exportData)) {
        if (rows && rows.length > 0) {
          const csv = jsonToCsv(rows);
          zip.file(`${table}.csv`, csv);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `church-data-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Data exported successfully", description: "Your ZIP file has been downloaded." });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleProceedToPassword = () => {
    if (phrase !== CONFIRMATION_PHRASE) {
      toast({ title: "Confirmation phrase does not match", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handlePurge = async () => {
    if (!password.trim()) {
      toast({ title: "Password is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purge-all-data", {
        body: { password, tenant_id: tenantId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const msg = data?.archive_id
        ? `Data archived for ${data.recovery_days} days. You can restore it from this page.`
        : "The application data has been reset.";

      toast({ title: "All data purged successfully", description: msg });
      resetAndClose();

      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }, 2000);
    } catch (err) {
      toast({
        title: "Purge failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedArchive) return;
    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("restore-purged-data", {
        body: { archive_id: selectedArchive.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Data restored successfully",
        description: data.warnings?.length
          ? `Restored with ${data.warnings.length} warning(s). Some records may need manual review.`
          : "All data has been restored.",
      });
      setRestoreDialogOpen(false);
      setSelectedArchive(null);
      queryClient.invalidateQueries({ queryKey: ["purged-archives"] });
    } catch (err) {
      toast({
        title: "Restore failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Recovery Section */}
      {archives && archives.length > 0 && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2 text-primary">
              <Archive className="h-4 w-4" /> Data Recovery
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Previously deleted data available for restoration
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {archives.map((archive) => (
                <div
                  key={archive.id}
                  className="flex items-center justify-between p-3 bg-muted/50 border rounded-lg"
                >
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      Purged {formatDistanceToNow(new Date(archive.purged_at), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDistanceToNow(new Date(archive.expires_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setSelectedArchive(archive);
                      setRestoreDialogOpen(true);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" /> Danger Zone
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Irreversible actions that affect all application data
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export */}
          <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Export All Data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Download all tenant data as a ZIP file containing CSV files. Recommended before any data deletion.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? "Exporting..." : "Export All Data"}
            </Button>
          </div>

          {/* Delete */}
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Delete All Data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Permanently delete all member records, attendance, follow-ups, events, communications,
                  and other transactional data. Data will be <strong>archived for 30 days</strong> and can be restored from this page.
                  App configuration (units, settings, exam questions) will be preserved.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete All Data
            </Button>
          </div>
        </CardContent>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={dialogOpen} onOpenChange={(open) => !loading && (open ? setDialogOpen(true) : resetAndClose())}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {step === 1 ? "Confirm Data Deletion" : "Re-authenticate"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  {step === 1 ? (
                    <>
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive font-medium">
                        ⚠️ This will delete ALL records including members, attendance, follow-ups, events,
                        communications, pastoral care, transportation, audit logs, and all user accounts except yours.
                      </div>
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-md text-sm text-primary font-medium">
                        📦 Data will be archived for 30 days and can be restored from the Danger Zone settings page.
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-foreground mb-1">What will be preserved:</p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                          <li>App settings &amp; feature configuration</li>
                          <li>Church units &amp; WSF centres</li>
                          <li>Certificate templates</li>
                          <li>Exam questions, subjects &amp; courses</li>
                          <li>Pickup locations</li>
                          <li>Your super admin account</li>
                        </ul>
                      </div>
                      <div>
                        <Label className="text-sm">
                          Type <span className="font-mono font-bold text-destructive">{CONFIRMATION_PHRASE}</span> to continue
                        </Label>
                        <Input
                          value={phrase}
                          onChange={(e) => setPhrase(e.target.value)}
                          placeholder="Type the confirmation phrase"
                          className="mt-1.5 font-mono"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        Enter your account password to confirm your identity and proceed with the data purge.
                      </p>
                      <div>
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="mt-1.5"
                          autoComplete="current-password"
                          onKeyDown={(e) => e.key === "Enter" && !loading && handlePurge()}
                        />
                      </div>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              {step === 1 ? (
                <Button
                  variant="destructive"
                  onClick={handleProceedToPassword}
                  disabled={phrase !== CONFIRMATION_PHRASE}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handlePurge}
                  disabled={loading || !password.trim()}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Permanently Delete All Data
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={restoreDialogOpen} onOpenChange={(open) => !restoring && setRestoreDialogOpen(open)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Restore Archived Data
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will restore all data from the archive created{" "}
                {selectedArchive && formatDistanceToNow(new Date(selectedArchive.purged_at), { addSuffix: true })}.
                Existing data will not be removed — restored records will be added back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
              <Button onClick={handleRestore} disabled={restoring}>
                {restoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Restore Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
