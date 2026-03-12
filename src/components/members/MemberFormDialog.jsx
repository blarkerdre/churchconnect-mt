import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Info, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const CHURCH_UNITS = [
  "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "None"
];
const STATUSES = ["Active", "Inactive", "New Convert", "First Timer"];
const MARITAL = ["Single", "Married", "Divorced", "Widowed"];
const GENDERS = ["Male", "Female"];

const emptyMember = {
  first_name: "", last_name: "", other_names: "", email: "", phone: "", address: "",
  date_of_birth: "", gender: "", marital_status: "", membership_status: "Active",
  church_units: [], join_date: "", notes: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  city: "", postcode: "",
  water_baptism: false, water_baptism_date: "",
  holy_spirit_baptism: false,
  winners_satellite: false, wsf_centre_id: "", wsf_centre_name: "",
  salvation_date: "", workers_in_training: false,
  bfc_completed: false, bcc_completed: false, lcc_completed: false, ldc_completed: false,
};

// Simple postcode district extractor (e.g. "CF10 1AB" → "CF10")
function postcodeDistrict(pc) {
  return (pc || "").trim().toUpperCase().split(" ")[0];
}

// Sort centres: those whose postcode district matches the member's come first
function sortCentresByPostcode(centres, memberPostcode) {
  if (!memberPostcode) return centres;
  const district = postcodeDistrict(memberPostcode);
  return [...centres].sort((a, b) => {
    const aMatch = postcodeDistrict(a.postcode) === district ? 0 : 1;
    const bMatch = postcodeDistrict(b.postcode) === district ? 0 : 1;
    return aMatch - bMatch;
  });
}

export default function MemberFormDialog({ open, onOpenChange, member, onSave }) {
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [contactPrefs, setContactPrefs] = useState({ phone: false, email: false, whatsapp: false, homeVisit: false });
  const [gdprConsent, setGdprConsent] = useState(false);

  const { data: wsfCentres = [] } = useQuery({
    queryKey: ["wsf-centres"],
    queryFn: () => base44.entities.WSFCentre.list("-created_date", 100),
  });

  useEffect(() => {
    setForm(member ? { ...emptyMember, ...member } : emptyMember);
    setSubmitted(false);
    setContactPrefs({ phone: false, email: false, whatsapp: false, homeVisit: false });
    setGdprConsent(false);
  }, [member, open]);

  const handleSave = async () => {
    setSaving(true);
    const savedMember = await onSave(form);

    // Auto follow-up for New Convert / First Timer (on creation OR when status changes to these)
    const isNewPerson = !member;
    const statusChangedToSpecial = member &&
      !["First Timer", "New Convert"].includes(member.membership_status) &&
      ["First Timer", "New Convert"].includes(form.membership_status);

    const needsFollowup = ["New Convert", "First Timer"].includes(form.membership_status);
    if ((isNewPerson || statusChangedToSpecial) && needsFollowup) {
      const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ");
      const followupType = form.membership_status === "New Convert"
        ? "New Convert Follow-up"
        : "First Timer Follow-up";

      // Create follow-up record (member id attached for potential conversion later)
      await base44.entities.Followup.create({
        person_name: fullName,
        person_type: form.membership_status,
        member_id: savedMember?.id || "",
        category: form.membership_status === "New Convert" ? "New Convert" : "First Timer",
        type: followupType,
        assigned_to: "Follow-up Team",
        status: "Pending",
        priority: "High",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        notes: `Auto-created when ${form.membership_status} was registered.${form.phone ? ` Phone: ${form.phone}` : ""}${form.email ? ` Email: ${form.email}` : ""}`,
      });

      // Notify follow-up team via announcement
      const contactPrefsList = Object.entries(contactPrefs).filter(([,v]) => v).map(([k]) => ({
        phone: "Phone Call", email: "Email", whatsapp: "WhatsApp", homeVisit: "Home Visit"
      }[k])).join(", ");

      await base44.entities.Announcement.create({
        title: `New ${form.membership_status}: ${fullName}`,
        body: `${fullName} has just been registered as a ${form.membership_status}. Please reach out and follow up promptly.\n\n${form.phone ? `📞 ${form.phone}\n` : ""}${form.email ? `✉️ ${form.email}\n` : ""}${form.address ? `📍 ${[form.address, form.city, form.postcode].filter(Boolean).join(", ")}` : ""}${contactPrefsList ? `\n\n📋 Preferred contact: ${contactPrefsList}` : ""}\n\nA follow-up task has been assigned to the Follow-up Team with a 7-day due date.`,
        audience: "Follow-up",
        pinned: true,
        author_name: "System",
        author_email: "",
      });

      setSaving(false);
      setSubmitted(true);
      return;
    }

    setSaving(false);
    onOpenChange(false);
  };

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  // Calculate form completion percentage
  const calculateCompletion = () => {
    const requiredFields = ["first_name", "last_name"];
    const importantFields = ["email", "phone", "address", "city", "postcode", "date_of_birth", "gender", "marital_status"];
    const allFields = [...requiredFields, ...importantFields];
    
    let filledCount = 0;
    allFields.forEach(field => {
      const value = form[field];
      if (value && value !== "" && value !== false) filledCount++;
    });
    
    return Math.round((filledCount / allFields.length) * 100);
  };

  const completion = calculateCompletion();

  const SwitchRow = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-3">
            <DialogTitle>{member ? "Edit Member" : "Register New Member"}</DialogTitle>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{completion}%</span>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">Thank You!</h3>
              <p className="text-slate-600 text-sm max-w-xs">
                Welcome to Winners Chapel Cardiff! You've been successfully registered and our Follow-up Team will be in touch with you shortly.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="bg-[#1e3a5f] hover:bg-[#152d4a] mt-2">Close</Button>
          </div>
        ) : (
        <div className="space-y-6 py-4">

          {/* Personal Details */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Other Names / Middle Names</Label>
                <Input value={form.other_names} onChange={(e) => set("other_names", e.target.value)} placeholder="e.g. Emmanuel, Grace" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Street Address</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Cardiff" />
              </div>
              <div className="space-y-1.5">
                <Label>Post Code</Label>
                <Input value={form.postcode} onChange={(e) => set("postcode", e.target.value)} placeholder="e.g. CF10 1AB" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Marital Status</Label>
                <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{MARITAL.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Membership Status</Label>
                <Select value={form.membership_status} onValueChange={(v) => set("membership_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Contact preferences for First Timer / New Convert */}
              {["First Timer", "New Convert"].includes(form.membership_status) && !member && (
                <div className="md:col-span-2 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-700">How would you like to be contacted?</p>
                    <p className="text-xs text-slate-400 mb-2">Select all that apply</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "phone", label: "📞 Phone Call" },
                        { key: "email", label: "✉️ Email" },
                        { key: "whatsapp", label: "💬 WhatsApp" },
                        { key: "homeVisit", label: "🏠 Home Visit" },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                          <input
                            type="checkbox"
                            checked={contactPrefs[key]}
                            onChange={(e) => setContactPrefs(p => ({ ...p, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          <span className="text-sm text-slate-600">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Church Growth Indices */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Church Growth Indices</h3>
            <div className="space-y-3">
              <SwitchRow
                id="water_baptism"
                label="Water Baptism"
                description="Has the member been water baptised?"
                checked={form.water_baptism}
                onChange={(v) => set("water_baptism", v)}
              />
              {form.water_baptism && (
                <div className="space-y-1.5 pl-4">
                  <Label>Baptism Date</Label>
                  <Input type="date" value={form.water_baptism_date} onChange={(e) => set("water_baptism_date", e.target.value)} />
                </div>
              )}

              <SwitchRow
                id="holy_spirit_baptism"
                label="Holy Spirit Baptism"
                description="Has the member received the baptism of the Holy Spirit?"
                checked={form.holy_spirit_baptism}
                onChange={(v) => set("holy_spirit_baptism", v)}
              />

              <SwitchRow
                id="winners_satellite"
                label="Winners Satellite Fellowship"
                description="Is the member part of a Winners Satellite Fellowship group?"
                checked={form.winners_satellite}
                onChange={(v) => set("winners_satellite", v)}
              />
              {form.winners_satellite && (
                <div className="space-y-1.5 pl-4">
                  <Label>WSF Centre</Label>
                  {form.postcode && (
                    <p className="text-xs text-slate-400">Centres closest to <span className="font-medium text-slate-600">{form.postcode.toUpperCase()}</span> shown first</p>
                  )}
                  <Select
                    value={form.wsf_centre_id || ""}
                    onValueChange={(v) => {
                      const c = wsfCentres.find(x => x.id === v);
                      set("wsf_centre_id", v);
                      set("wsf_centre_name", c?.name || "");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select WSF Centre" /></SelectTrigger>
                    <SelectContent>
                      {sortCentresByPostcode(wsfCentres, form.postcode).map((c, idx, arr) => {
                        const district = postcodeDistrict(form.postcode);
                        const isNearby = district && postcodeDistrict(c.postcode) === district;
                        const prevIsNearby = idx > 0 && district && postcodeDistrict(arr[idx - 1].postcode) === district;
                        return (
                          <React.Fragment key={c.id}>
                            {idx > 0 && isNearby !== prevIsNearby && (
                              <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider">Other centres</div>
                            )}
                            <SelectItem value={c.id}>
                              {isNearby ? "📍 " : ""}{c.name} — {c.postcode}
                            </SelectItem>
                          </React.Fragment>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <SwitchRow
                id="workers_in_training"
                label="Workers in Training (WIT)"
                description="Currently enrolled in the Workers in Training programme?"
                checked={form.workers_in_training}
                onChange={(v) => set("workers_in_training", v)}
              />
              <SwitchRow
                id="bfc_completed"
                label="Believers Foundation Class (BFC)"
                description="Has the member completed the BFC?"
                checked={form.bfc_completed}
                onChange={(v) => {
                  set("bfc_completed", v);
                  // Auto-convert New Convert/First Timer to Active when BFC is completed
                  if (v && ["New Convert", "First Timer"].includes(form.membership_status)) {
                    set("membership_status", "Active");
                  }
                }}
              />
              <SwitchRow
                id="bcc_completed"
                label="Basic Certificate Course (BCC)"
                description="Has the member completed the BCC?"
                checked={form.bcc_completed}
                onChange={(v) => set("bcc_completed", v)}
              />
              <SwitchRow
                id="lcc_completed"
                label="Leadership Certificate Course (LCC)"
                description="Has the member completed the LCC?"
                checked={form.lcc_completed}
                onChange={(v) => set("lcc_completed", v)}
              />
              <SwitchRow
                id="ldc_completed"
                label="Leadership Diploma Course (LDC)"
                description="Has the member completed the LDC?"
                checked={form.ldc_completed}
                onChange={(v) => set("ldc_completed", v)}
              />
            </div>
          </div>

          {/* Church Units */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Church Units / Departments</h3>
            <div className="space-y-2">
              <Label>Which church units is the member part of?</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CHURCH_UNITS.filter(u => u !== "None").map((unit) => (
                  <label key={unit} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.church_units?.includes(unit) || false}
                      onChange={(e) => {
                        const units = form.church_units || [];
                        if (e.target.checked) {
                          set("church_units", [...units, unit]);
                        } else {
                          set("church_units", units.filter(u => u !== unit));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-600">{unit}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notes / Comment */}
          <div className="space-y-1.5">
            <Label>{["First Timer", "New Convert"].includes(form.membership_status) ? "Comment" : "Notes"}</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>

          {/* GDPR Consent — only shown for new registrations */}
          {!member && (
            <div className={`rounded-xl border p-4 space-y-2 transition-colors ${gdprConsent ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gdprConsent}
                  onChange={e => setGdprConsent(e.target.checked)}
                  className="mt-0.5 rounded accent-[#1e3a5f] h-4 w-4 shrink-0"
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                  I consent to <strong>Church Management Suite</strong> processing my personal data including attendance records
                  in accordance with the{" "}
                  <a
                    href="/PrivacyPolicy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1e3a5f] underline font-medium"
                    onClick={e => e.stopPropagation()}
                  >
                    Privacy Policy
                  </a>
                  . I understand my data may include special category information (religious belief) under{" "}
                  <strong>UK GDPR Article 9</strong>.
                </span>
              </label>
              {!gdprConsent && (
                <p className="text-xs text-amber-700 pl-7">⚠️ Consent is required to complete registration.</p>
              )}
            </div>
          )}
        </div>
        )}
        {!submitted && (
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || (!member && !gdprConsent)} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {!member && ["First Timer", "New Convert"].includes(form.membership_status) ? "Send" : member ? "Update" : "Register"}
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}