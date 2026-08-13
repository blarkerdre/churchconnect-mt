import { useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";

/**
 * Church switcher used in the sidebar (expanded and collapsed) and in the
 * top header badge, so accounts belonging to more than one church can always
 * reach it — including on mobile.
 *
 * Selecting a church calls `onSelect(tenantId)`; the caller owns the
 * password-confirmation flow.
 */
export default function TenantSwitcherMenu({
  memberships = [],
  tenantId,
  currentTenant,
  onSelect,
  variant = "sidebar",
}) {
  const [open, setOpen] = useState(false);

  if (memberships.length <= 1) return null;

  const label = currentTenant?.name || "Select church";

  const trigger =
    variant === "collapsed" ? (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={`Switch church (currently ${label})`}
        aria-label="Switch church"
        className="w-full flex items-center justify-center py-1.5 rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
      >
        <Building2 className="h-4 w-4" />
      </button>
    ) : variant === "badge" ? (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Switch church"
        className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1 max-w-[200px] hover:bg-primary/20 transition-colors"
      >
        {currentTenant?.logo_url && (
          <img src={currentTenant.logo_url} alt="" className="h-3 w-3 rounded object-contain shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
    );

  return (
    <div className={variant === "sidebar" ? "mt-3 relative" : "relative"} data-tour="tenant-switcher">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 bg-popover border border-border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto ${
              variant === "sidebar" ? "left-0 right-0 top-full mt-1" : "right-0 top-full mt-1 min-w-[200px]"
            }`}
          >
            {memberships.map((m) => {
              const t = m.tenants;
              const isSelected = tenantId === m.tenant_id;
              return (
                <button
                  key={m.id || m.tenant_id}
                  onClick={() => {
                    setOpen(false);
                    onSelect(m.tenant_id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent transition-colors ${
                    isSelected ? "bg-accent/50 font-medium" : ""
                  }`}
                >
                  {t?.logo_url && (
                    <img src={t.logo_url} alt="" className="h-4 w-4 rounded object-contain shrink-0" />
                  )}
                  <span className="truncate flex-1">{t?.name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground capitalize shrink-0">{m.role}</span>
                  {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
