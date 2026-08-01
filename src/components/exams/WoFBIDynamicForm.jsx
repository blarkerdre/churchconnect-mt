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

        if (f.type === "rating_grid") {
          const rows = f.rows || [];
          const scale = f.scale || [];
          const gridVal = (val && typeof val === "object") ? val : {};
          const setRow = (row, choice) => set(f.id, { ...gridVal, [row]: choice });
          return (
            <div key={f.id} className="space-y-2">
              {labelEl}
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Item</th>
                      {scale.map((c) => <th key={c} className="p-2 font-medium text-center whitespace-nowrap">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r} className="border-t">
                        <td className="p-2">{r}</td>
                        {scale.map((c) => (
                          <td key={c} className="p-2 text-center">
                            <input type="radio" className="accent-primary h-4 w-4"
                              name={`${f.id}-${r}`} disabled={disabled}
                              checked={gridVal[r] === c}
                              onChange={() => setRow(r, c)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile stacked */}
              <div className="sm:hidden space-y-3">
                {rows.map((r) => (
                  <div key={r} className="border rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium">{r}</p>
                    <RadioGroup value={gridVal[r] || ""} onValueChange={(v) => setRow(r, v)} disabled={disabled} className="space-y-1">
                      {scale.map((c) => (
                        <div key={c} className="flex items-center gap-2">
                          <RadioGroupItem value={c} id={`${f.id}-${r}-${c}`} />
                          <Label htmlFor={`${f.id}-${r}-${c}`} className="text-sm font-normal cursor-pointer">{c}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
              {help}
            </div>
          );
        }


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
