import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, MapPin, Phone, Clock, Users, Edit2, Trash2,
  CalendarDays, ClipboardList, HeartHandshake, UserCheck
} from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";
import WSFCentreFormDialog from "@/components/wsf/WSFCentreFormDialog";
import WSFAttendanceFormDialog from "@/components/wsf/WSFAttendanceFormDialog";
import { useCurrentUser } from "@/components/useCurrentUser";
import { format } from "date-fns";

export default function WSF() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isUnitLeader } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [centreDialog, setCentreDialog] = useState(false);
  const [editingCentre, setEditingCentre] = useState(null);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [activeTab, setActiveTab] = useState("centres");

  const { data: centres = [], isLoading: loadingCentres } = useQuery({
    queryKey: ["wsf-centres"],
    queryFn: () => base44.entities.WSFCentre.list("-created_date", 100),
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["wsf-attendance"],
    queryFn: () => base44.entities.WSFAttendance.list("-date", 200),
  });

  const createCentre = useMutation({
    mutationFn: d => base44.entities.WSFCentre.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-centres"] }),
  });
  const updateCentre = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WSFCentre.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-centres"] }),
  });
  const deleteCentre = useMutation({
    mutationFn: id => base44.entities.WSFCentre.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-centres"] }),
  });

  const createAttendance = useMutation({
    mutationFn: d => base44.entities.WSFAttendance.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-attendance"] }),
  });
  const updateAttendance = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WSFAttendance.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-attendance"] }),
  });
  const deleteAttendance = useMutation({
    mutationFn: id => base44.entities.WSFAttendance.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wsf-attendance"] }),
  });

  const handleSaveCentre = async (data) => {
    if (editingCentre) await updateCentre.mutateAsync({ id: editingCentre.id, data });
    else await createCentre.mutateAsync(data);
    setEditingCentre(null);
  };

  const handleSaveAttendance = async (data) => {
    if (editingAttendance) await updateAttendance.mutateAsync({ id: editingAttendance.id, data });
    else await createAttendance.mutateAsync(data);
    setEditingAttendance(null);
    setSelectedCentre(null);
  };

  // The centre this user leads (if they are a WSF leader / unit_leader)
  const myCentre = !isAdmin && user ? centres.find(c => c.leader_email && c.leader_email.toLowerCase() === user.email?.toLowerCase()) : null;

  const filteredCentres = centres.filter(c =>
    `${c.name} ${c.postcode} ${c.city} ${c.host_name || ""} ${c.leader_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const centreAttendance = (centreId) => attendance.filter(a => a.centre_id === centreId);
  const latestRecord = (centreId) => centreAttendance(centreId)[0];

  // Aggregate stats
  const totalCentres = centres.filter(c => c.active).length;
  const totalAttendance = attendance.reduce((s, a) => s + (a.total_attendees || 0), 0);
  const totalTestimonies = attendance.reduce((s, a) => s + (a.testimonies || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Centres", value: totalCentres, icon: MapPin, color: "text-blue-500 bg-blue-50" },
          { label: "Total Attendance (all)", value: totalAttendance, icon: Users, color: "text-emerald-500 bg-emerald-50" },
          { label: "Total Testimonies", value: totalTestimonies, icon: HeartHandshake, color: "text-amber-500 bg-amber-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WSF Leader banner — quick record for their own centre */}
      {myCentre && (
        <Card className="border-0 shadow-sm bg-[#1e3a5f] text-white mb-4">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Your Centre: {myCentre.name}</p>
                <p className="text-xs text-white/60">{myCentre.meeting_day}{myCentre.meeting_time ? ` · ${myCentre.meeting_time}` : ""} · {[myCentre.city, myCentre.postcode].filter(Boolean).join(", ")}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-white text-[#1e3a5f] hover:bg-white/90 shrink-0"
              onClick={() => { setEditingAttendance(null); setSelectedCentre(myCentre); setAttendanceDialog(true); }}
            >
              <ClipboardList className="h-4 w-4 mr-1.5" /> Record Attendance
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="centres" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Centres
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Attendance
            </TabsTrigger>
          </TabsList>

          {activeTab === "centres" && (
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or postcode..." className="pl-10" />
              </div>
              <PrintReportButton
                label="Print"
                buildRows={() => ({
                  title: "WSF Centres Report",
                  headers: ["Centre", "Leader", "Host", "Address", "Meeting Day", "Status"],
                  rows: filteredCentres.map(c => [
                    c.name,
                    c.leader_name || "",
                    c.host_name || "",
                    [c.address, c.city, c.postcode].filter(Boolean).join(", "),
                    c.meeting_day ? `${c.meeting_day}${c.meeting_time ? " " + c.meeting_time : ""}` : "",
                    c.active ? "Active" : "Inactive",
                  ]),
                })}
              />
              {isAdmin && (
                <Button onClick={() => { setEditingCentre(null); setCentreDialog(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a] shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Add Centre
                </Button>
              )}
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="flex items-center gap-2">
              <PrintReportButton
                label="Print"
                buildRows={() => ({
                  title: `WSF Attendance Report${selectedCentre ? " — " + selectedCentre.name : ""}`,
                  headers: ["Date", "Centre", "Total", "Male", "Female", "Teens", "Children", "Testimonies"],
                  rows: attendance
                    .filter(a => !selectedCentre || a.centre_id === selectedCentre.id)
                    .map(a => [
                      a.date, a.centre_name,
                      a.total_attendees || 0, a.male || 0, a.female || 0,
                      a.teens || 0, a.children || 0, a.testimonies || 0,
                    ]),
                })}
              />
              {isAdmin && (
                <Button onClick={() => { setEditingAttendance(null); setSelectedCentre(null); setAttendanceDialog(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a] shrink-0" disabled={centres.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Record Attendance
                </Button>
              )}
            </div>
          )}
        </div>

        {/* CENTRES TAB */}
        <TabsContent value="centres">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCentres.map(c => {
              const latest = latestRecord(c.id);
              return (
                <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                   <div className="flex items-start justify-between">
                     <div className="flex-1 min-w-0">
                       <h3 className="font-semibold text-slate-800 truncate">{c.name}</h3>
                       {c.host_name && <p className="text-xs text-slate-500">Host: {c.host_name}</p>}
                     </div>
                     <Badge className={c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                       {c.active ? "Active" : "Inactive"}
                     </Badge>
                   </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                   {c.leader_name && (
                     <div className="flex items-center gap-2 text-sm text-slate-600">
                       <UserCheck className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" />
                       <span className="font-medium text-[#1e3a5f]">Leader: {c.leader_name}</span>
                     </div>
                   )}
                   <div className="flex items-center gap-2 text-sm text-slate-600">
                     <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                     <span className="truncate">{[c.address, c.city, c.postcode].filter(Boolean).join(", ")}</span>
                   </div>
                   {c.phone && (
                     <div className="flex items-center gap-2 text-sm text-slate-600">
                       <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                       <span>{c.phone}</span>
                     </div>
                   )}
                   {c.meeting_day && (
                     <div className="flex items-center gap-2 text-sm text-slate-600">
                       <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                       <span>{c.meeting_day}{c.meeting_time ? ` at ${c.meeting_time}` : ""}</span>
                     </div>
                   )}
                   {latest && (
                     <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-100">
                       <CalendarDays className="h-3 w-3" />
                       Last: {format(new Date(latest.date), "dd MMM yyyy")} · {latest.total_attendees} attendees
                     </div>
                   )}
                   <div className="flex items-center gap-2 pt-2">
                     {(isAdmin || myCentre?.id === c.id) && (
                       <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
                         setSelectedCentre(c);
                         setEditingAttendance(null);
                         setAttendanceDialog(true);
                       }}>
                         <ClipboardList className="h-3 w-3 mr-1" /> Record
                       </Button>
                     )}
                     {isAdmin && (
                       <>
                         <Button size="sm" variant="ghost" onClick={() => { setEditingCentre(c); setCentreDialog(true); }}>
                           <Edit2 className="h-3.5 w-3.5" />
                         </Button>
                         <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                           if (window.confirm(`Delete "${c.name}"?`)) deleteCentre.mutate(c.id);
                         }}>
                           <Trash2 className="h-3.5 w-3.5" />
                         </Button>
                       </>
                     )}
                   </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredCentres.length === 0 && (
              <div className="col-span-3 text-center py-16 text-slate-400">
                <MapPin className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">No WSF centres found.</p>
                <p className="text-xs mt-1">Click "Add Centre" to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ATTENDANCE TAB */}
        <TabsContent value="attendance">
          <div className="space-y-3">
            {/* Filter by centre */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="sm"
                variant={!selectedCentre ? "default" : "outline"}
                onClick={() => setSelectedCentre(null)}
                className={!selectedCentre ? "bg-[#1e3a5f]" : ""}
              >All Centres</Button>
              {centres.map(c => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={selectedCentre?.id === c.id ? "default" : "outline"}
                  onClick={() => setSelectedCentre(c)}
                  className={selectedCentre?.id === c.id ? "bg-[#1e3a5f]" : ""}
                >
                  {c.name}
                </Button>
              ))}
            </div>

            {/* Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centre</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Male</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Female</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teens</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Children</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Testimonies</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance
                      .filter(a => !selectedCentre || a.centre_id === selectedCentre.id)
                      .map((a, i) => (
                        <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                          <td className="px-4 py-3 font-medium text-slate-700">{format(new Date(a.date), "dd MMM yyyy")}</td>
                          <td className="px-4 py-3 text-slate-600">{a.centre_name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-[#1e3a5f]">{a.total_attendees || 0}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{a.male || 0}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{a.female || 0}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{a.teens || 0}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{a.children || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className="bg-amber-100 text-amber-700 text-xs">{a.testimonies || 0}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => {
                                setEditingAttendance(a);
                                setSelectedCentre(centres.find(c => c.id === a.centre_id) || null);
                                setAttendanceDialog(true);
                              }}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => {
                                if (window.confirm("Delete this attendance record?")) deleteAttendance.mutate(a.id);
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {attendance.filter(a => !selectedCentre || a.centre_id === selectedCentre.id).length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No attendance records yet.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <WSFCentreFormDialog
        open={centreDialog}
        onOpenChange={setCentreDialog}
        centre={editingCentre}
        onSave={handleSaveCentre}
      />

      <WSFAttendanceFormDialog
        open={attendanceDialog}
        onOpenChange={setAttendanceDialog}
        centre={selectedCentre}
        attendance={editingAttendance}
        onSave={handleSaveAttendance}
        allCentres={centres}
      />
    </div>
  );
}