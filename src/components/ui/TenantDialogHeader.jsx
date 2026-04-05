import React from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/contexts/TenantContext";

export default function TenantDialogHeader({ children, className }) {
  const { currentTenant } = useTenant();
  const logoUrl = currentTenant?.logo_url;

  return (
    <DialogHeader className={className}>
      <div className="flex items-center gap-3">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="h-8 w-auto object-contain shrink-0"
          />
        )}
        <DialogTitle className="flex items-center gap-2">{children}</DialogTitle>
      </div>
    </DialogHeader>
  );
}
