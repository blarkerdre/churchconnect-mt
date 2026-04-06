import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const CONTACT_MODES = ["Phone Call", "Text/SMS", "WhatsApp", "Email"];
const WOFBI_LEVELS = [
  { value: "None", label: "None" },
  { value: "BCC", label: "Basic Certificate Course (BCC)" },
  { value: "LCC", label: "Leadership Certificate Course (LCC)" },
  { value: "LDC", label: "Leadership Diploma Course (LDC)" },
];

const SwitchRow = ({ id, label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
  </div>
);

export default function WelcomeQuestions({ form, set, tenantName }) {
  const churchName = tenantName || "our church";

  const contactModes = (form.preferred_contact_modes || "").split(",").map(s => s.trim()).filter(Boolean);
  const toggleContactMode = (mode) => {
    const current = contactModes.includes(mode)
      ? contactModes.filter(m => m !== mode)
      : [...contactModes, mode];
    set("preferred_contact_modes", current.join(", "));
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Welcome Questions</h3>
      <div className="space-y-3">
        <SwitchRow
          id="worshipped_before"
          label={`Have you worshipped with us at ${churchName}?`}
          checked={form.worshipped_before}
          onChange={v => set("worshipped_before", v)}
        />
        {form.worshipped_before && (
          <div className="space-y-1.5 pl-4">
            <Label>Please tell us when and where</Label>
            <Input
              value={form.worshipped_when_where || ""}
              onChange={e => set("worshipped_when_where", e.target.value)}
              placeholder="e.g. Last Sunday at the main auditorium"
              maxLength={500}
            />
          </div>
        )}

        <SwitchRow
          id="worshipped_at_other_wci"
          label="Have you worshipped with us at any other Winners Chapel International?"
          checked={form.worshipped_at_other_wci}
          onChange={v => set("worshipped_at_other_wci", v)}
        />

        <SwitchRow
          id="would_like_to_join"
          label={`Would you like to join ${churchName}?`}
          checked={form.would_like_to_join}
          onChange={v => set("would_like_to_join", v)}
        />

        <SwitchRow
          id="live_work_in_city"
          label="Do you live or work in this city or its environ?"
          checked={form.live_work_in_city}
          onChange={v => set("live_work_in_city", v)}
        />

        <div className="space-y-1.5">
          <Label>How did you hear about us?</Label>
          <Input
            value={form.how_did_you_hear || ""}
            onChange={e => set("how_did_you_hear", e.target.value)}
            placeholder="e.g. Friend, Social Media, Google..."
            maxLength={300}
          />
        </div>

        <SwitchRow
          id="attended_foundation_school"
          label="Have you attended Winning Foundation School?"
          checked={form.attended_foundation_school}
          onChange={v => set("attended_foundation_school", v)}
        />

        <div className="space-y-1.5">
          <Label>Have you attended our Bible School? Please select the highest level achieved</Label>
          <Select value={form.wofbi_highest_level || "None"} onValueChange={v => set("wofbi_highest_level", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WOFBI_LEVELS.map(l => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SwitchRow
          id="baptized_by_immersion"
          label="Have you been baptized in water by immersion?"
          checked={form.baptized_by_immersion}
          onChange={v => set("baptized_by_immersion", v)}
        />

        <div className="space-y-2">
          <Label>Please indicate your preferred mode(s) of contact</Label>
          <div className="flex flex-wrap gap-2">
            {CONTACT_MODES.map(mode => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg hover:bg-muted/50 border border-border">
                <Checkbox
                  checked={contactModes.includes(mode)}
                  onCheckedChange={() => toggleContactMode(mode)}
                />
                <span>{mode}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
