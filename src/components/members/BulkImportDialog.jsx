import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { normalizePhone } from "@/lib/phone-utils";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const EXPECTED_COLUMNS = [
  "first_name", "last_name", "email", "phone", "gender",
  "membership_status", "church_unit", "address", "city", "postcode",
  "date_of_birth", "emergency_contact_name", "emergency_contact_phone",
];

const VALID_STATUSES = ["Active", "New Convert", "First Timer"];
const VALID_GENDERS = ["Male", "Female"];

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map(line => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
  return { headers, rows };
}

function validateRow(row, idx) {
  const errors = [];
  if (!row.first_name) errors.push("Missing first_name");
  if (!row.last_name) errors.push("Missing last_name");
  if (row.membership_status && !VALID_STATUSES.includes(row.membership_status)) {
    errors.push(`Invalid status "${row.membership_status}"`);
  }
  if (row.gender && !VALID_GENDERS.includes(row.gender)) {
    errors.push(`Invalid gender "${row.gender}"`);
  }
  return errors;
}

function buildMemberData(row) {
  const data = {
    first_name: row.first_name,
    last_name: row.last_name,
  };
  if (row.email) data.email = row.email.toLowerCase().trim();
  if (row.phone) data.phone = normalizePhone(row.phone) || row.phone;
  if (row.gender && VALID_GENDERS.includes(row.gender)) data.gender = row.gender;
  if (row.membership_status && VALID_STATUSES.includes(row.membership_status)) data.membership_status = row.membership_status;
  if (row.church_unit) data.church_unit = row.church_unit;
  if (row.address) data.address = row.address;
  if (row.city) data.city = row.city;
  if (row.postcode) data.postcode = row.postcode;
  if (row.date_of_birth) data.date_of_birth = row.date_of_birth;
  if (row.emergency_contact_name) data.emergency_contact_name = row.emergency_contact_name;
  if (row.emergency_contact_phone) data.emergency_contact_phone = row.emergency_contact_phone;
  return data;
}

export default function BulkImportDialog({ open, onOpenChange, onComplete }) {
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [parsedRows, setParsedRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [results, setResults] = useState({ created: 0, updated: 0, skipped: 0 });
  const fileRef = useRef(null);
  const { withTenant } = useTenantQuery();

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setRowErrors([]);
    setResults({ created: 0, updated: 0, skipped: 0 });
  };

  const handleClose = (val) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows } = parseCSV(ev.target.result);
      const errors = rows.map((r, i) => ({ row: i + 2, errors: validateRow(r, i) })).filter(e => e.errors.length > 0);
      setParsedRows(rows);
      setRowErrors(errors);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const validRows = parsedRows.filter((_, i) => !rowErrors.find(e => e.row === i + 2));

  const handleImport = async () => {
    setStep("importing");
    let created = 0, updated = 0, skipped = 0;

    // Fetch existing members by email for matching
    const emails = validRows.map(r => r.email?.toLowerCase().trim()).filter(Boolean);
    let existingMap = {};
    if (emails.length > 0) {
      const { data } = await scopeQuery(supabase.from("members").select("id, email").in("email", emails));
      if (data) data.forEach(m => { existingMap[m.email.toLowerCase()] = m.id; });
    }

    // Process in batches of 50
    const BATCH = 50;
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);
      const toInsert = [];
      const toUpdate = [];

      for (const row of batch) {
        const memberData = buildMemberData(row);
        const email = memberData.email;
        if (email && existingMap[email]) {
          toUpdate.push({ id: existingMap[email], ...memberData });
        } else if (email) {
          toInsert.push(memberData);
        } else {
          // No email — always insert as new
          toInsert.push(memberData);
        }
      }

      if (toInsert.length > 0) {
        const { data, error } = await supabase.from("members").insert(toInsert.map(m => withTenant(m))).select("id");
        if (error) { skipped += toInsert.length; } else { created += data.length; }
      }

      for (const { id, ...updateData } of toUpdate) {
        const { error } = await supabase.from("members").update(updateData).eq("id", id);
        if (error) { skipped++; } else { updated++; }
      }
    }

    skipped += rowErrors.length;
    setResults({ created, updated, skipped });
    setStep("done");
    onComplete?.();
  };

  const handleDownloadTemplate = () => {
    const csv = EXPECTED_COLUMNS.join(",") + "\nJohn,Doe,john@example.com,07700900000,Male,Active,Ushering,123 Main St,Cardiff,CF10 1AA,1990-01-15,Jane Doe,07700900001";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "members_import_template.csv";
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Members</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create or update members in bulk. Members are matched by email address.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a CSV file with columns: <span className="font-medium text-foreground">first_name, last_name, email</span> (required), plus optional fields like phone, gender, membership_status, church_unit, etc.
              </p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              <div className="flex justify-center gap-2">
                <Button onClick={() => fileRef.current?.click()}>
                  <FileText className="h-4 w-4 mr-2" /> Select CSV File
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  Download Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm">{parsedRows.length} rows found</Badge>
              <Badge className="bg-chart-3/10 text-chart-3 border-0 text-sm">{validRows.length} valid</Badge>
              {rowErrors.length > 0 && (
                <Badge className="bg-destructive/10 text-destructive border-0 text-sm">
                  {rowErrors.length} with errors
                </Badge>
              )}
            </div>

            {rowErrors.length > 0 && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-1 max-h-32 overflow-y-auto">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Rows with errors (will be skipped):
                </p>
                {rowErrors.slice(0, 10).map(e => (
                  <p key={e.row} className="text-xs text-destructive/80">
                    Row {e.row}: {e.errors.join(", ")}
                  </p>
                ))}
                {rowErrors.length > 10 && <p className="text-xs text-destructive/60">...and {rowErrors.length - 10} more</p>}
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Email</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Phone</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((r, i) => {
                    const hasError = rowErrors.find(e => e.row === i + 2);
                    return (
                      <tr key={i} className={`border-b ${hasError ? "bg-destructive/5" : ""}`}>
                        <td className="p-2 text-muted-foreground">{i + 2}</td>
                        <td className="p-2">{r.first_name} {r.last_name}</td>
                        <td className="p-2">{r.email || "—"}</td>
                        <td className="p-2">{r.phone || "—"}</td>
                        <td className="p-2">{r.membership_status || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="text-xs text-muted-foreground p-2">...and {parsedRows.length - 5} more rows</p>
              )}
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing {validRows.length} members...</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-chart-3">
              <CheckCircle2 className="h-6 w-6" />
              <p className="font-medium">Import Complete</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-chart-3/10 rounded-md p-3">
                <p className="text-xl font-bold text-chart-3">{results.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="bg-primary/10 rounded-md p-3">
                <p className="text-xl font-bold text-primary">{results.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="bg-muted rounded-md p-3">
                <p className="text-xl font-bold text-muted-foreground">{results.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                Import {validRows.length} Members
              </Button>
            </div>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
