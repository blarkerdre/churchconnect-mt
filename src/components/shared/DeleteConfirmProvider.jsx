import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";
import DangerConfirmDialog from "@/components/exams/DangerConfirmDialog";

const DeleteConfirmContext = createContext(null);

/**
 * App-wide destructive-action gate.
 *
 * Usage:
 *   const confirmDelete = useConfirmDelete();
 *   ...
 *   const ok = await confirmDelete({
 *     title: "Delete contact",
 *     description: "This removes the contact permanently.",
 *   });
 *   if (!ok) return;
 *
 * High-impact (cascading) deletes additionally require typing the item name:
 *   await confirmDelete({
 *     title: "Delete session",
 *     itemName: session.title,
 *     impacts: ["All check-ins for this session are removed"],
 *     highImpact: true,
 *   });
 *
 * Resolves `true` only after the signed-in user's password has been verified.
 */
export function DeleteConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const settle = useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const confirmDelete = useCallback((options = {}) => {
    // If a previous prompt is somehow still pending, cancel it first.
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        title: options.title || "Confirm delete",
        description: options.description || "This action cannot be undone.",
        itemName: options.itemName || "",
        confirmText: options.confirmText,
        impacts: options.impacts || [],
        confirmLabel: options.confirmLabel || "Delete",
        highImpact: Boolean(options.highImpact),
      });
    });
  }, []);

  const open = Boolean(request);
  const highImpact = Boolean(request?.highImpact);

  return (
    <DeleteConfirmContext.Provider value={confirmDelete}>
      {children}

      {open && !highImpact && (
        <PasswordConfirmDialog
          open
          onOpenChange={(next) => { if (!next) settle(false); }}
          title={request.title}
          description={request.description}
          confirmLabel={request.confirmLabel}
          onConfirm={() => settle(true)}
        />
      )}

      {open && highImpact && (
        <DangerConfirmDialog
          open
          onOpenChange={(next) => { if (!next) settle(false); }}
          title={request.title}
          entityName={request.itemName || request.title}
          confirmText={request.confirmText}
          impacts={
            request.impacts.length > 0
              ? request.impacts
              : [request.description].filter(Boolean)
          }
          confirmLabel={request.confirmLabel}
          onConfirm={() => settle(true)}
        />
      )}
    </DeleteConfirmContext.Provider>
  );
}

export function useConfirmDelete() {
  const ctx = useContext(DeleteConfirmContext);
  if (!ctx) {
    throw new Error("useConfirmDelete must be used inside <DeleteConfirmProvider>");
  }
  return ctx;
}

export default DeleteConfirmProvider;
