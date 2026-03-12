import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Church, CheckCircle2, Loader2 } from "lucide-react";

const GENDERS = ["Male", "Female"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const HOW_HEARD = ["Friend/Family", "Social Media", "Website", "Flyer", "Walk-in", "Outreach", "Other"];

export default function PublicMemberRegistration() {
    const [form, setForm] = useState({
        first_name: "", last_name: "", other_names: "", email: "", phone: "",
        address: "", city: "", postcode: "", date_of_birth: "", gender: "",
        marital_status: "", how_heard: "", salvation_date: "", notes: ""
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.first_name || !form.last_name) {
            setError("Please fill in your first and last name.");
            return;
        }
        setLoading(true);
        const response = await base44.functions.invoke("submitPublicMember", form);
        setLoading(false);
        if (response.data?.success) {
            setSubmitted(true);
        } else {
            setError(response.data?.error || "Something went wrong. Please try again.");
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome!</h2>
                    <p className="text-slate-500 mb-6">Thank you for registering with <strong>Winners Chapel International Cardiff</strong>. Our team will be in touch soon.</p>
                    <p className="text-xs text-slate-400">God bless you 🙏</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] py-10 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="h-16 w-16 rounded-2xl bg-[#c9a84c] flex items-center justify-center mx-auto mb-4">
                        <Church className="h-8 w-8 text-[#0f1f33]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Winners Chapel International</h1>
                    <p className="text-white/60 mt-1">Cardiff — Member Registration</p>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-1">New Member Form</h2>
                    <p className="text-sm text-slate-500 mb-6">Please fill in your details below. Fields marked * are required.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>First Name *</Label>
                                <Input className="mt-1" value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="e.g. John" />
                            </div>
                            <div>
                                <Label>Last Name *</Label>
                                <Input className="mt-1" value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="e.g. Doe" />
                            </div>
                        </div>

                        <div>
                            <Label>Other Names / Middle Name</Label>
                            <Input className="mt-1" value={form.other_names} onChange={e => set("other_names", e.target.value)} placeholder="Optional" />
                        </div>

                        {/* Contact */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Email Address</Label>
                                <Input className="mt-1" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="your@email.com" />
                            </div>
                            <div>
                                <Label>Phone Number</Label>
                                <Input className="mt-1" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+44 7xxx xxxxxx" />
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <Label>Street Address</Label>
                            <Input className="mt-1" value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Example Street" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>City</Label>
                                <Input className="mt-1" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Cardiff" />
                            </div>
                            <div>
                                <Label>Postcode</Label>
                                <Input className="mt-1" value={form.postcode} onChange={e => set("postcode", e.target.value)} placeholder="CF10 1AB" />
                            </div>
                        </div>

                        {/* Personal */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label>Date of Birth</Label>
                                <Input className="mt-1" type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
                            </div>
                            <div>
                                <Label>Gender</Label>
                                <Select value={form.gender} onValueChange={v => set("gender", v)}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Marital Status</Label>
                                <Select value={form.marital_status} onValueChange={v => set("marital_status", v)}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{MARITAL_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Church Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>How did you hear about us?</Label>
                                <Select value={form.how_heard} onValueChange={v => set("how_heard", v)}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{HOW_HEARD.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Date of Salvation (if known)</Label>
                                <Input className="mt-1" type="date" value={form.salvation_date} onChange={e => set("salvation_date", e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <Label>Additional Notes / Prayer Requests</Label>
                            <Textarea className="mt-1" rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Anything you'd like to share..." />
                        </div>

                        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                        <Button type="submit" disabled={loading} className="w-full bg-[#1e3a5f] hover:bg-[#0f1f33] text-white py-3 text-base font-semibold rounded-xl">
                            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit Registration"}
                        </Button>

                        <p className="text-xs text-slate-400 text-center">
                            Your data is handled securely in accordance with UK GDPR. For questions, contact us at church.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}