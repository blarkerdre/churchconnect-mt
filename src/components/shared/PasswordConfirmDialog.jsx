import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

/**
 * Lightweight destructive-action confirmation dialog.
 * Requires the signed-in user to re-enter their password before proceeding.
 *
 * Props:
 *  - open, onOpenChange
 *  - title?: string                 (default "Confirm delete")
 *  - description?: string|ReactNode (body text shown above password field)
 *  - confirmLabel?: string          (default "Delete")
 *  - isPending?: boolean
 *  - onConfirm: () => void | Promise
 */
export default function PasswordConfirmDialog({
  open,
  onOpenChange,
  title = "Confirm delete",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  isPending = false,
  onConfirm,
}) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setVerifying(false);
    }
  }, [open]);

  const canSubmit = password.length > 0 && !verifying && !isPending;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    if (!user?.email) {
      toast({ title: "Not signed in", description: "Please sign in again.", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        toast({ title: "Password incorrect", description: "Re-enter your password to continue.", variant: "destructive" });
        setVerifying(false);
        return;
      }
      setVerifying(false);
      await onConfirm?.();
      onOpenChange?.(false);
    } catch (err) {
      setVerifying(false);
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> {title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-foreground/90">
            {description}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Re-enter your password to confirm</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
              placeholder="Your account password"
              autoComplete="current-password"
              autoFocus
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSubmit}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {(verifying || isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
