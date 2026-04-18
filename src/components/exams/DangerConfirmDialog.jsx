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
 * Reusable destructive-action confirmation dialog with:
 *  - Red warning header & cascading impact list
 *  - Type-to-confirm input (must match `confirmText`)
 *  - Password re-authentication via supabase.auth.signInWithPassword
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open) => void
 *  - title: string                  — dialog title (e.g. "Delete Course")
 *  - entityName: string             — name shown in body (e.g. course name)
 *  - confirmText?: string           — text user must type (defaults to entityName)
 *  - impacts: string[]              — bullet list of cascade warnings
 *  - confirmLabel?: string          — confirm button label (default "Delete")
 *  - isPending?: boolean            — shows spinner on confirm
 *  - onConfirm: () => void | Promise — runs after password verification
 */
export default function DangerConfirmDialog({
  open,
  onOpenChange,
  title = "Confirm destructive action",
  entityName = "",
  confirmText,
  impacts = [],
  confirmLabel = "Delete",
  isPending = false,
  onConfirm,
}) {
  const { user } = useAuth();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const expected = (confirmText ?? entityName ?? "").trim();

  useEffect(() => {
    if (!open) {
      setTyped("");
      setPassword("");
      setVerifying(false);
    }
  }, [open]);

  const typedMatches = expected.length > 0 && typed.trim() === expected;
  const canSubmit = typedMatches && password.length > 0 && !verifying && !isPending;

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
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="font-medium text-destructive">
              This action is permanent and cannot be undone.
            </p>
            {impacts.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-foreground/90">
                {impacts.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Type <span className="font-mono font-semibold text-foreground">{expected}</span> to confirm
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expected}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Re-enter your password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
              autoComplete="current-password"
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
