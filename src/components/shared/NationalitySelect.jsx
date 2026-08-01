import React, { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES } from "@/lib/countries";

/**
 * Searchable nationality picker. Value in/out is a plain demonym string
 * (e.g. "British"). Legacy free-text values are preserved and displayed.
 */
export default function NationalitySelect({ value, onChange, placeholder = "Select nationality", disabled = false, className }) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.nationality.toLowerCase() === String(value || "").toLowerCase());
  const label = selected ? `${selected.nationality} (${selected.country})` : (value || "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[calc(100vw-2rem)] sm:w-[320px]">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search country or nationality…" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {value ? (
                <CommandItem
                  value="__clear__ clear none"
                  onSelect={() => { onChange(""); setOpen(false); }}
                >
                  <X className="mr-2 h-4 w-4 opacity-60" />
                  Clear selection
                </CommandItem>
              ) : null}
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.country}
                  value={`${c.country} ${c.nationality}`}
                  onSelect={() => { onChange(c.nationality); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.country === c.country ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.nationality}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{c.country}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
