import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Phone, Mail, CheckCircle2, XCircle, SendHorizonal } from "lucide-react";

const statusColors = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  "New Convert": "bg-amber-50 text-amber-700 border-amber-200",
  "First Timer": "bg-blue-50 text-blue-700 border-blue-200",
};

const YesNo = ({ value }) =>
  value ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : (
    <XCircle className="h-4 w-4 text-slate-300" />
  );

export default function MemberTable({ members, onEdit, onDelete, onEmail, readOnly = false, canDelete = true }) {
  if (members.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No members found</p>
        <p className="text-sm mt-1">Register your first member to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Contact</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Church Unit</TableHead>
            <TableHead className="font-semibold text-center">Baptised</TableHead>
            <TableHead className="font-semibold text-center">WSF</TableHead>
            <TableHead className="font-semibold text-center">HS Baptism</TableHead>
            {(!readOnly || onEmail) && <TableHead className="font-semibold text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id} className="hover:bg-slate-50/50">
              <TableCell>
                <div>
                  <p className="font-medium text-slate-800">{m.first_name} {m.last_name}</p>
                  {m.gender && <p className="text-xs text-slate-400">{m.gender}</p>}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  {m.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3 w-3" /> {m.phone}
                    </div>
                  )}
                  {m.email && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="h-3 w-3" /> {m.email}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={`text-xs border ${statusColors[m.membership_status] || statusColors.Active}`}>
                  {m.membership_status || "Active"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-600">{m.church_unit !== "None" && m.church_unit ? m.church_unit : "—"}</TableCell>
              <TableCell className="text-center"><YesNo value={m.water_baptism} /></TableCell>
              <TableCell className="text-center"><YesNo value={m.winners_satellite} /></TableCell>
              <TableCell className="text-center"><YesNo value={m.holy_spirit_baptism} /></TableCell>
              {(!readOnly || onEmail) && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!readOnly && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(m)}>
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    )}
                    {onEmail && m.membership_status === "Inactive" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Send re-engagement email" onClick={() => onEmail(m)}>
                        <SendHorizonal className="h-3.5 w-3.5 text-[#1e3a5f]" />
                      </Button>
                    )}
                    {!readOnly && canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}