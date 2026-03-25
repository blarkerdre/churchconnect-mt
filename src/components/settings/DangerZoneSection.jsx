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
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const CONFIRMATION_PHRASE = "DELETE ALL DATA";

export default function DangerZoneSection() {
  const { tenantId } = useTenantQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = warning + phrase, 2 = password
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resetAndClose = () => {
    setDialogOpen(false);
    setStep(1);
    setPhrase("");
    setPassword("");
    setLoading(false);
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

      toast({ title: "All data purged successfully", description: "The application data has been reset." });
      resetAndClose();

      // Sign out and reload after purge
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

  return (
    <Card className="border-destructive/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" /> Danger Zone
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Irreversible actions that affect all application data
        </p>
      </CardHeader>
      <CardContent>
        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Delete All Data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently delete all member records, attendance, follow-ups, events, communications,
                and other transactional data. App configuration (units, settings, exam questions) will be preserved.
                This action <strong>cannot be undone</strong>.
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
                      ⚠️ This will permanently delete ALL records including members, attendance, follow-ups, events,
                      communications, pastoral care, transportation, audit logs, and all user accounts except yours.
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
    </Card>
  );
}
