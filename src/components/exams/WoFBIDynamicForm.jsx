import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Renders a dynamic form from a field schema.
 * Props:
 *   fields: array of { id, type, label, required, options, placeholder, help_text }
 *   values: object { field_id: value }
 *   onChange: (id, value) => void
 *   disabled?: boolean
 */
export default function WoFBIDynamicForm({ fields = [], values = {}, onChange, disabled = false }) {
  const set = (id, v) => onChange && onChange(id, v);

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const val = values[f.id];
        if (f.type === "section_heading") {
          return (
            <div key={f.id} className="pt-3 pb-1 border-b">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">{f.label}</h3>
            </div>
          );
        }
        const labelEl = (
          <Label htmlFor={f.id} className="text-sm">
            {f.label} {f.required && <span className="text-destructive">*</span>}
          </Label>
        );
        const help = f.help_text ? (
          <p className="text-xs text-muted-foreground">{f.help_text}</p>
        ) : null;

        if (f.type === "textarea") {
          return (
            <div key={f.id} className="space-y-1">
              {labelEl}
              <Textarea id={f.id} value={val || ""} disabled={disabled}
                onChange={(e) => set(f.id, e.target.value)}
                placeholder={f.placeholder || ""} maxLength={2000} />
              {help}
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.id} className="space-y-1">
              {labelEl}
              <Select value={val || ""} onValueChange={(v) => set(f.id, v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder={f.placeholder || "Select..."} /></SelectTrigger>
                <SelectContent>
                  {(f.options || []).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {help}
            </div>
          );
        }
        if (f.type === "radio" || f.type === "yes_no") {
          const opts = f.type === "yes_no" ? ["Yes", "No"] : (f.options || []);
          return (
            <div key={f.id} className="space-y-1">
              {labelEl}
              <RadioGroup value={val || ""} onValueChange={(v) => set(f.id, v)} disabled={disabled}
                className="flex flex-wrap gap-4 pt-1">
                {opts.map((o) => (
                  <div key={o} className="flex items-center gap-2">
                    <RadioGroupItem value={o} id={`${f.id}-${o}`} />
                    <Label htmlFor={`${f.id}-${o}`} className="text-sm font-normal cursor-pointer">{o}</Label>
                  </div>
                ))}
              </RadioGroup>
              {help}
            </div>
          );
        }
        if (f.type === "checkbox") {
          return (
            <div key={f.id} className="space-y-1">
              <div className="flex items-start gap-2">
                <Checkbox id={f.id} checked={!!val} disabled={disabled}
                  onCheckedChange={(v) => set(f.id, !!v)} />
                <Label htmlFor={f.id} className="text-sm leading-snug cursor-pointer">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
              </div>
              {help}
            </div>
          );
        }
        // text, email, tel, date
        return (
          <div key={f.id} className="space-y-1">
            {labelEl}
            <Input id={f.id} type={f.type === "text" ? "text" : f.type}
              value={val || ""} disabled={disabled}
              onChange={(e) => set(f.id, e.target.value)}
              placeholder={f.placeholder || ""} maxLength={500} />
            {help}
          </div>
        );
      })}
    </div>
  );
}
