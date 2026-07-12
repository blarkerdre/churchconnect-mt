import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "cc_consent_v1";

const DEFAULT = { necessary: true, functional: false, analytics: false };

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { ...DEFAULT, ...p };
  } catch { return null; }
}

export function hasConsent(category) {
  const c = getCookieConsent();
  if (!c) return category === "necessary";
  return !!c[category];
}

async function logConsent(prefs) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const [key, val] of Object.entries(prefs)) {
      await supabase.from("consent_events").insert({
        user_id: user.id,
        consent_type: `cookies.${key}`,
        granted: !!val,
        source: "cookie_banner",
      });
    }
  } catch { /* ignore */ }
}

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT);

  useEffect(() => {
    if (!getCookieConsent()) setOpen(true);
    const handler = () => { setPrefs(getCookieConsent() || DEFAULT); setOpen(true); };
    window.addEventListener("open-cookie-preferences", handler);
    return () => window.removeEventListener("open-cookie-preferences", handler);
  }, []);

  const save = (p) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, ts: Date.now() }));
    logConsent(p);
    setOpen(false);
    setExpanded(false);
    window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: p }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none">
      <Card className="max-w-3xl mx-auto shadow-2xl border-primary/20 pointer-events-auto">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Cookies & storage preferences</p>
              <p className="text-muted-foreground">
                We use strictly-necessary storage to keep you signed in and remember your church.
                Optional functional storage saves your onboarding progress and preferences.
                See our <Link to="/privacy" className="underline text-primary">Privacy Notice</Link> for details.
              </p>
            </div>
          </div>

          {expanded && (
            <div className="space-y-3 border-t pt-3">
              <ConsentRow label="Strictly necessary" description="Authentication, tenant selection. Required."
                checked disabled />
              <ConsentRow label="Functional" description="Tour progress, dialog dismissals, UI preferences."
                checked={prefs.functional} onChange={(v) => setPrefs({ ...prefs, functional: v })} />
              <ConsentRow label="Analytics" description="Anonymous usage patterns (none active today)."
                checked={prefs.analytics} onChange={(v) => setPrefs({ ...prefs, analytics: v })} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            {!expanded ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>Manage</Button>
                <Button variant="outline" size="sm" onClick={() => save({ necessary: true, functional: false, analytics: false })}>
                  Reject optional
                </Button>
                <Button size="sm" onClick={() => save({ necessary: true, functional: true, analytics: true })}>
                  Accept all
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>Back</Button>
                <Button size="sm" onClick={() => save(prefs)}>Save preferences</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-sm">
        <Label className="font-medium">{label}</Label>
        <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
