import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Church } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const GENDERS = ["Male", "Female"];
const STATUSES = ["First Timer", "New Convert"];

export default function PublicRegistration() {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", address: "",
    city: "Cardiff", postcode: "", date_of_birth: "", gender: "",
    membership_status: "First Timer", notes: "", gdpr_consent: false,
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      const { data: inserted, error } = await supabase.from("members").insert({
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
        notes: form.notes || null,
        gdpr_consent: true,
        gdpr_consent_date: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      // Auto-create followup for first timer / new convert
      if (inserted && (form.membership_status === "First Timer" || form.membership_status === "New Convert")) {
        await supabase.from("followups").insert({
          member_id: inserted.id,
          followup_type: form.membership_status === "First Timer" ? "First Timer" : "New Convert",
          description: `New ${form.membership_status.toLowerCase()} registered: ${form.first_name} ${form.last_name}`,
          status: "Pending",
          priority: "High",
        }).throwOnError();
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
            <Button onClick={() => { setSubmitted(false); setForm({ first_name: "", last_name: "", email: "", phone: "", address: "", city: "Cardiff", postcode: "", date_of_birth: "", gender: "", membership_status: "First Timer", notes: "", gdpr_consent: false }); }}>
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
      <Card className="max-w-lg w-full border-0 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Church className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">Member Registration</CardTitle>
          <p className="text-sm text-muted-foreground">Fill in your details to register</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
              <div className="space-y-1"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
            </div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div className="space-y-1"><Label>Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
              <div className="space-y-1"><Label>Postcode</Label><Input value={form.postcode} onChange={e => set("postcode", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} /></div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>I am a</Label>
              <Select value={form.membership_status} onValueChange={v => set("membership_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Prayer Request / Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

            <div className={`rounded-xl border p-3 space-y-1 transition-colors ${form.gdpr_consent ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/30 bg-destructive/5"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
                <span className="text-sm text-foreground leading-relaxed">
                  I consent to processing my personal data in accordance with <strong>UK GDPR</strong>.
                </span>
              </label>
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
