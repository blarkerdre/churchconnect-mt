import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * Reusable granular-consent block. `value` is an object with keys:
 *   privacy, marketing, photos, pastoral_contact, third_party_sharing
 * onChange receives the updated object.
 */
export default function ConsentTogglesGroup({ value, onChange, showPrivacy = true, compact = false }) {
  const v = value || {};
  const set = (k) => (checked) => onChange({ ...v, [k]: checked });

  const rows = [
    showPrivacy && {
      key: "privacy",
      label: "I accept the Privacy Notice",
      desc: "Required for us to hold and process your church-membership data.",
      required: true,
    },
    { key: "consent_marketing", label: "Marketing communications", desc: "Newsletters, event promotion, sermon summaries." },
    { key: "consent_photos", label: "Photos & media", desc: "You may appear in service photos, videos, and social posts." },
    { key: "consent_pastoral_contact", label: "Pastoral contact", desc: "Leaders may reach out for prayer, follow-up and welfare checks.", defaultTrue: true },
    { key: "consent_third_party_sharing", label: "Share with WCI network", desc: "Only for referrals to sister churches or global reports." },
  ].filter(Boolean);

  return (
    <Card className="border-primary/20">
      <CardContent className={compact ? "p-3 space-y-3" : "p-4 space-y-4"}>
        {rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-3">
            <div className="text-sm min-w-0">
              <Label className="font-medium">
                {r.label}{r.required && <span className="text-destructive"> *</span>}
              </Label>
              <p className="text-muted-foreground text-xs mt-0.5">{r.desc}</p>
            </div>
            <Switch
              checked={!!v[r.key]}
              onCheckedChange={set(r.key)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground border-t pt-2">
          You can change these at any time from <span className="font-medium">My Data</span> in your profile menu.
        </p>
      </CardContent>
    </Card>
  );
}
