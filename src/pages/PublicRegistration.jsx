import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, Church } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const CHURCH_UNITS = [
  "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "None"
];
const STATUSES = ["First Timer", "New Convert", "Active", "Inactive"];
const GENDERS = ["Male", "Female"];

const emptyForm = {
  first_name: "", last_name: "", email: "", phone: "", address: "",
  date_of_birth: "", gender: "", membership_status: "First Timer",
  church_unit: "", notes: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  city: "Cardiff", postcode: "",
  water_baptism: false, holy_spirit_baptism: false,
  winners_satellite: false, wsf_centre_id: "",
  bfc_completed: false, bcc_completed: false, lcc_completed: false, ldc_completed: false,
  gdpr_consent: false,
};

export default function PublicRegistration() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wsfCentres, setWsfCentres] = useState([]);

  useEffect(() => {
    supabase.from("wsf_centres").select("*").eq("is_active", true).order("name")
      .then(({ data }) => setWsfCentres(data || []));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const SwitchRow = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    if (!form.gdpr_consent) {
      toast({ title: "GDPR consent is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("members").insert({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        membership_status: form.membership_status,
        church_unit: form.church_unit || null,
        notes: form.notes || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        water_baptism: form.water_baptism,
        holy_spirit_baptism: form.holy_spirit_baptism,
        winners_satellite: form.winners_satellite,
        wsf_centre_id: form.wsf_centre_id || null,
        bfc_completed: form.bfc_completed,
        bcc_completed: form.bcc_completed,
        lcc_completed: form.lcc_completed,
        ldc_completed: form.ldc_completed,
        gdpr_consent: true,
        gdpr_consent_date: new Date().toISOString(),
      });
      if (error) throw error;

      // Auto-create followup for first timer / new convert (without member_id since anon can't select back)
      if (form.membership_status === "First Timer" || form.membership_status === "New Convert") {
        await supabase.from("followups").insert({
          followup_type: form.membership_status === "First Timer" ? "First Timer" : "New Convert",
          description: `New ${form.membership_status.toLowerCase()} registered: ${form.first_name} ${form.last_name}`,
          status: "Pending",
          priority: "High",
        });
      }

      setSubmitted(true);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Welcome!</h2>
            <p className="text-muted-foreground">Your registration has been received. We're glad you're here!</p>
            <Button onClick={() => { setSubmitted(false); setForm(emptyForm); }}>
              Register Another
            </Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4 flex items-start justify-center pt-8">
      <Card className="max-w-2xl w-full border-0 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Church className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">Member Registration</CardTitle>
          <p className="text-sm text-muted-foreground">Fill in your details to register</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Post Code</Label><Input value={form.postcode} onChange={e => set("postcode", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Membership Status</Label>
                  <Select value={form.membership_status} onValueChange={v => set("membership_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Church Units (select multiple)</Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-background min-h-[40px]">
                    {CHURCH_UNITS.filter(u => u !== "None").map(unit => {
                      const selected = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
                      const isSelected = selected.includes(unit);
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => {
                            const current = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
                            const updated = isSelected
                              ? current.filter(u => u !== unit)
                              : [...current, unit];
                            set("church_unit", updated.join(", "));
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {unit}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Church Growth Indices */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Growth Indices</h3>
              <div className="space-y-3">
                <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
                <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
                <SwitchRow id="winners_satellite" label="Winners Satellite Fellowship" checked={form.winners_satellite} onChange={v => {
                  set("winners_satellite", v);
                  if (v && !form.wsf_centre_id && (form.postcode || form.address || form.city)) {
                    const memberArea = `${form.postcode || ""} ${form.address || ""} ${form.city || ""}`.toLowerCase();
                    const postcodePrefix = (form.postcode || "").trim().split(" ")[0]?.toLowerCase();
                    const scored = wsfCentres.map(c => {
                      const loc = (c.location || "").toLowerCase();
                      let score = 0;
                      if (postcodePrefix && loc.includes(postcodePrefix)) score += 10;
                      if (form.city && loc.includes(form.city.toLowerCase())) score += 5;
                      if (form.postcode && loc.includes(form.postcode.toLowerCase())) score += 8;
                      const addressWords = memberArea.split(/\s+/).filter(w => w.length > 2);
                      addressWords.forEach(w => { if (loc.includes(w)) score += 2; });
                      return { ...c, score };
                    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
                    if (scored.length > 0) {
                      set("wsf_centre_id", scored[0].id);
                    }
                  }
                }} />
                {form.winners_satellite && (
                  <div className="space-y-1.5 pl-4">
                    <Label>WSF Centre {form.wsf_centre_id && wsfCentres.find(c => c.id === form.wsf_centre_id) ? <span className="text-xs text-muted-foreground font-normal ml-1">(auto-suggested by location)</span> : null}</Label>
                    <Select value={form.wsf_centre_id || ""} onValueChange={v => set("wsf_centre_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select WSF Centre" /></SelectTrigger>
                      <SelectContent>{wsfCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <SwitchRow id="bfc_completed" label="Believers Foundation Class (BFC)" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
                <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
                <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
                <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Prayer Request / Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
            </div>

            {/* GDPR Consent */}
            <div className={`rounded-xl border p-4 space-y-2 transition-colors ${form.gdpr_consent ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/30 bg-destructive/5"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
                <span className="text-sm text-foreground leading-relaxed">
                  I consent to processing my personal data including attendance records in accordance with <strong>UK GDPR</strong>.
                </span>
              </label>
              {!form.gdpr_consent && <p className="text-xs text-destructive pl-7">⚠️ Consent is required to complete registration.</p>}
            </div>

            <Button type="submit" className="w-full" disabled={saving || !form.first_name || !form.last_name || !form.gdpr_consent}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Register
            </Button>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
