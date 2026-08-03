import React, { createContext, useCallback, useContext, useState } from "react";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";

const DeleteConfirmContext = createContext(null);

/**
 * App-wide destructive-action gate.
 *
 * Usage:
 *   const confirmDelete = useConfirmDelete();
 *   confirmDelete({
 *     title: "Delete member",
 *     description: "This permanently removes Jane Doe.",
 *     onConfirm: () => mutation.mutate(id),
 *   });
 *
 * The signed-in user must re-enter their account password every time before
 * onConfirm runs. There is no "remember me" window.
 */
export function DeleteConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [pending, setPending] = useState(false);

  const confirmDelete = useCallback((options) => {
    if (!options?.onConfirm) return;
    setRequest({
      title: options.title || "Confirm delete",
      description: options.description || "This action cannot be undone.",
      confirmLabel: options.confirmLabel || "Delete",
      onConfirm: options.onConfirm,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!request) return;
    setPending(true);
    try {
      await request.onConfirm();
    } finally {
      setPending(false);
      setRequest(null);
    }
  }, [request]);

  return (
    <DeleteConfirmContext.Provider value={confirmDelete}>
      {children}
      <PasswordConfirmDialog
        open={!!request}
        onOpenChange={(open) => {
          if (!open && !pending) setRequest(null);
        }}
        title={request?.title}
        description={request?.description}
        confirmLabel={request?.confirmLabel}
        isPending={pending}
        onConfirm={handleConfirm}
      />
    </DeleteConfirmContext.Provider>
  );
}

export function useConfirmDelete() {
  const ctx = useContext(DeleteConfirmContext);
  if (!ctx) {
    // Fail safe: without the provider, do nothing rather than delete unguarded.
    return () => {
      console.warn("useConfirmDelete used outside DeleteConfirmProvider");
    };
  }
  return ctx;
}

export default DeleteConfirmProvider;
