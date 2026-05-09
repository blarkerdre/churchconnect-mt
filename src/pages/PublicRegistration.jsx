import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, Church, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { suggestClosestWSFCentre } from "@/lib/wsf-suggest";
import { normalizePhone } from "@/lib/phone-utils";
import { usePublicConsentText, renderConsentText } from "@/hooks/useConsentText";
import WelcomeQuestions from "@/components/members/WelcomeQuestions";
const STATUSES = ["First Timer", "New Convert", "Visitor", "Active"];
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
  website: "", // honeypot
  // Welcome questions (First Timer / New Convert)
  worshipped_before: false, worshipped_when_where: "", worshipped_at_other_wci: false, would_like_to_join: false,
  live_work_in_city: false, how_did_you_hear: "", attended_foundation_school: false,
  wofbi_highest_level: "None", baptized_by_immersion: false, preferred_contact_modes: "",
};

const HIDE_SPIRITUAL_STATUSES = ["First Timer", "New Convert", "Visitor"];
const SHOW_BAPTISM_STATUSES = ["First Timer", "New Convert"];

export default function PublicRegistration() {
  const { tenantSlug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const tenantSlug = routeSlug || searchParams.get("tenant") || null;
  const [CHURCH_UNITS, setChurchUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wsfCentres, setWsfCentres] = useState([]);
  const [resolvedTenantId, setResolvedTenantId] = useState(null);
  const [tenantLookupDone, setTenantLookupDone] = useState(false);
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    if (tenantSlug) {
      supabase.rpc("get_tenant_by_slug", { _slug: tenantSlug })
        .then(({ data }) => {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.id) setResolvedTenantId(row.id);
          if (row?.name) setTenantName(row.name);
          setTenantLookupDone(true);
        });
    } else {
      setTenantLookupDone(true);
    }
  }, [tenantSlug]);

  useEffect(() => {
    supabase.rpc("get_active_church_unit_names", { _tenant_slug: tenantSlug || null })
      .then(({ data }) => setChurchUnits((data || []).map(u => u.name)));
  }, [tenantSlug]);

  useEffect(() => {
    supabase.rpc("get_active_wsf_centre_names")
      .then(({ data }) => setWsfCentres(data || []));
  }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const showChurchUnits = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showSpiritualDev = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showBaptism = SHOW_BAPTISM_STATUSES.includes(form.membership_status);
  const isFirstTimerOrNewConvert = ["First Timer", "New Convert"].includes(form.membership_status);

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
    if (!resolvedTenantId) {
      toast({ title: "Invalid registration link", description: "Please ask your church for the correct registration link.", variant: "destructive" });
      return;
    }
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
      const res = await supabase.functions.invoke("public-register", {
        body: {
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
          church_unit: showChurchUnits ? (form.church_unit || null) : null,
          notes: form.notes || null,
          emergency_contact_name: isFirstTimerOrNewConvert ? null : (form.emergency_contact_name || null),
          emergency_contact_phone: isFirstTimerOrNewConvert ? null : (form.emergency_contact_phone || null),
          water_baptism: form.water_baptism,
          holy_spirit_baptism: form.holy_spirit_baptism,
          winners_satellite: form.winners_satellite,
          wsf_centre_id: form.wsf_centre_id || null,
          bfc_completed: form.bfc_completed,
          bcc_completed: form.bcc_completed,
          lcc_completed: form.lcc_completed,
          ldc_completed: form.ldc_completed,
          gdpr_consent: form.gdpr_consent,
          website: form.website, // honeypot
          // Welcome question fields
          ...(isFirstTimerOrNewConvert ? {
            worshipped_before: form.worshipped_before,
            worshipped_when_where: form.worshipped_when_where || null,
            would_like_to_join: form.would_like_to_join,
            live_work_in_city: form.live_work_in_city,
            how_did_you_hear: form.how_did_you_hear || null,
            attended_foundation_school: form.attended_foundation_school,
            wofbi_highest_level: form.wofbi_highest_level || null,
            baptized_by_immersion: form.baptized_by_immersion,
            preferred_contact_modes: form.preferred_contact_modes || null,
          } : {}),
          ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
          ...(tenantSlug ? { tenant_slug: tenantSlug } : {}),
        },
      });

      if (res.error) throw new Error(res.error.message || "Registration failed");
      if (res.data?.error) throw new Error(res.data.error);

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
            {/* Honeypot — hidden from real users */}
            <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" value={form.website} onChange={e => set("website", e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            {/* Personal Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} maxLength={100} required /></div>
                <div className="space-y-1.5"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} maxLength={100} required /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} maxLength={255} /></div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label>Phone</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs">
                          <p>Use international format with country code, e.g. <strong>+447888873207</strong></p>
                          <p className="mt-1 text-muted-foreground">UK numbers starting with 0 are auto-converted (07xxx → +447xxx)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+447888873207" maxLength={20} />
                  {form.phone && !normalizePhone(form.phone) && (
                    <p className="text-[11px] text-destructive">Invalid format. Use +country code then number, e.g. +447888873207</p>
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => { set("address", e.target.value); if (form.winners_satellite) { const best = suggestClosestWSFCentre(wsfCentres, { ...form, address: e.target.value }); if (best) set("wsf_centre_id", best.id); } }} maxLength={300} /></div>
                <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={e => { set("city", e.target.value); if (form.winners_satellite) { const best = suggestClosestWSFCentre(wsfCentres, { ...form, city: e.target.value }); if (best) set("wsf_centre_id", best.id); } }} maxLength={100} /></div>
                <div className="space-y-1.5"><Label>Post Code</Label><Input value={form.postcode} onChange={e => { set("postcode", e.target.value); if (form.winners_satellite) { const best = suggestClosestWSFCentre(wsfCentres, { ...form, postcode: e.target.value }); if (best) set("wsf_centre_id", best.id); } }} maxLength={20} /></div>
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
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s === "Active" ? "Active Member" : s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Church Units — only for Active/Inactive */}
            {showChurchUnits && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Units</h3>
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
                {(form.church_unit || "").trim() && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                    <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Your unit selection will be sent to the leader for approval after registration.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Baptism — only for First Timer / New Convert */}
            {showBaptism && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Baptism</h3>
                <div className="space-y-3">
                  <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
                  <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
                </div>
              </div>
            )}

            {/* Spiritual Development — only for Active/Inactive */}
            {showSpiritualDev && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Spiritual Development</h3>
                <div className="space-y-3">
                  <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
                  <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
                  <SwitchRow id="winners_satellite" label="Home Cell Fellowship" checked={form.winners_satellite} onChange={v => {
                    set("winners_satellite", v);
                    if (v && !form.wsf_centre_id) {
                      const best = suggestClosestWSFCentre(wsfCentres, form);
                      if (best) set("wsf_centre_id", best.id);
                    }
                  }} />
                  {form.winners_satellite && (
                    <div className="space-y-1.5 pl-4">
                       <Label>Home Cell Centre {form.wsf_centre_id && wsfCentres.find(c => c.id === form.wsf_centre_id) ? <span className="text-xs text-muted-foreground font-normal ml-1">(auto-suggested by location)</span> : null}</Label>
                       <Select value={form.wsf_centre_id || ""} onValueChange={v => set("wsf_centre_id", v)}>
                         <SelectTrigger><SelectValue placeholder="Select Home Cell Centre" /></SelectTrigger>
                        <SelectContent>{wsfCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</SelectItem>)}</SelectContent>
                      </Select>
                      {form.wsf_centre_id && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                          <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            Your Home Cell selection will be sent to the leader for approval after registration.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <SwitchRow id="bfc_completed" label="Believers Foundation Class (BFC)" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />

                   {/* Bible School */}
                   <div className="mt-2">
                     <p className="text-xs font-semibold text-muted-foreground mb-2">Bible School</p>
                    <div className="space-y-3">
                      <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
                      <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
                      <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Visitor BFC prompt */}
            {form.membership_status === "Visitor" && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Foundation Class</h3>
                <SwitchRow id="bfc_completed" label="Have you completed Believers Foundation Class (BFC)?" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
              </div>
            )}

            {/* Welcome Questions — First Timer / New Convert only */}
            {isFirstTimerOrNewConvert && (
              <WelcomeQuestions form={form} set={set} tenantName={tenantName} />
            )}

            {/* Emergency Contact — hidden for First Timer / New Convert */}
            {!isFirstTimerOrNewConvert && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Contact Name (Optional)</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} maxLength={100} /></div>
                  <div className="space-y-1.5"><Label>Contact Phone (Optional)</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} maxLength={20} /></div>
                </div>
              </div>
            )}

            {/* Prayer Request */}
            <div className="space-y-1.5">
              <Label>Prayer Request</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} maxLength={2000} placeholder="Share any prayer requests here..." />
            </div>

            {/* GDPR Consent */}
            <ConsentBlock form={form} set={set} resolvedTenantId={resolvedTenantId} />

            <Button type="submit" className="w-full" disabled={saving || submitted || !form.first_name || !form.last_name || !form.gdpr_consent}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? "Registering…" : "Register"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}

function ConsentBlock({ form, set, resolvedTenantId }) {
  const { consentText, privacyUrl } = usePublicConsentText(resolvedTenantId);
  return (
    <div className={`rounded-xl border p-4 space-y-2 transition-colors ${form.gdpr_consent ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/30 bg-destructive/5"}`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
        <span className="text-sm text-foreground leading-relaxed">
          {renderConsentText(consentText, privacyUrl)}
        </span>
      </label>
      {!form.gdpr_consent && <p className="text-xs text-destructive pl-7">⚠️ Consent is required to complete registration.</p>}
    </div>
  );
}
