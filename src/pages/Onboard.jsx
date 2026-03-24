import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Church, User, Mail, Lock, ArrowRight, ArrowLeft, Check,
  Globe, Palette, Users, ToggleLeft, Loader2, Sparkles
} from "lucide-react";

const STEPS = [
  { id: "church", label: "Church Info", icon: Church },
  { id: "admin", label: "Admin Account", icon: User },
  { id: "features", label: "Features", icon: ToggleLeft },
  { id: "review", label: "Launch", icon: Sparkles },
];

const FEATURE_OPTIONS = [
  { key: "sms_enabled", label: "SMS & WhatsApp", desc: "Send SMS and WhatsApp messages to members" },
  { key: "exams_enabled", label: "WoFBI Exams", desc: "Bible institute course management and exams" },
  { key: "transportation", label: "Transportation", desc: "Manage transport bookings for services" },
  { key: "pastoral_care", label: "Pastoral Care", desc: "Track and manage pastoral care cases" },
  { key: "wsf_enabled", label: "WSF Centres", desc: "Winners Satellite Fellowship centre management" },
];

const TIMEZONE_OPTIONS = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function Onboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    church_name: "",
    slug: "",
    timezone: "Europe/London",
    admin_email: "",
    admin_password: "",
    admin_full_name: "",
    features: {
      sms_enabled: true,
      exams_enabled: true,
      transportation: true,
      pastoral_care: true,
      wsf_enabled: true,
    },
  });

  const update = (key, value) => {
    setForm((p) => {
      const next = { ...p, [key]: value };
      // Auto-generate slug from church name
      if (key === "church_name" && !p._slugEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const updateFeature = (key, value) => {
    setForm((p) => ({
      ...p,
      features: { ...p.features, [key]: value },
    }));
  };

  const canProceed = () => {
    if (step === 0) return form.church_name.trim().length >= 3 && form.slug.trim().length >= 3;
    if (step === 1) return form.admin_email.includes("@") && form.admin_password.length >= 6 && form.admin_full_name.trim().length >= 2;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-tenant", {
        body: {
          church_name: form.church_name.trim(),
          slug: form.slug.trim(),
          admin_email: form.admin_email.trim(),
          admin_password: form.admin_password,
          admin_full_name: form.admin_full_name.trim(),
          timezone: form.timezone,
          features: form.features,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Church registered successfully! 🎉",
        description: "Signing you in...",
      });

      // Auto sign-in with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.admin_email.trim(),
        password: form.admin_password,
      });

      if (signInError) {
        toast({
          title: "Registration complete",
          description: "Please sign in with your credentials.",
        });
        navigate("/auth");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast({
        title: "Registration failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <Church className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Register Your Church</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your church management platform</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center flex-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            {/* Step 1: Church Info */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="church_name">Church Name *</Label>
                  <div className="relative">
                    <Church className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="church_name"
                      placeholder="e.g. Winners Chapel International London"
                      value={form.church_name}
                      onChange={(e) => update("church_name", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug *</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="slug"
                      placeholder="e.g. wci-london"
                      value={form.slug}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, slug: slugify(e.target.value), _slugEdited: true }));
                      }}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your registration link: <span className="font-mono text-foreground">/t/{form.slug || "..."}/register</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={form.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Admin Account */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create the administrator account for your church.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="admin_full_name">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin_full_name"
                      placeholder="Pastor John Doe"
                      value={form.admin_full_name}
                      onChange={(e) => update("admin_full_name", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin_email"
                      type="email"
                      placeholder="admin@yourchurch.org"
                      value={form.admin_email}
                      onChange={(e) => update("admin_email", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_password">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin_password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={form.admin_password}
                      onChange={(e) => update("admin_password", e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Features */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose which features to enable. You can change these later in Settings.
                </p>
                <div className="space-y-3">
                  {FEATURE_OPTIONS.map((feat) => (
                    <div
                      key={feat.key}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 mr-3">
                        <p className="text-sm font-medium text-foreground">{feat.label}</p>
                        <p className="text-xs text-muted-foreground">{feat.desc}</p>
                      </div>
                      <Switch
                        checked={form.features[feat.key]}
                        onCheckedChange={(v) => updateFeature(feat.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Review & Launch */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <Sparkles className="h-8 w-8 text-accent mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Review your setup and launch your church platform.
                  </p>
                </div>
                <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Church</span>
                    <span className="font-medium text-foreground">{form.church_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">URL Slug</span>
                    <span className="font-mono text-foreground">{form.slug}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Timezone</span>
                    <span className="text-foreground">{form.timezone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Admin</span>
                    <span className="text-foreground">{form.admin_full_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{form.admin_email}</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Enabled Features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FEATURE_OPTIONS.filter((f) => form.features[f.key]).map((f) => (
                        <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>
                      ))}
                      {FEATURE_OPTIONS.every((f) => !form.features[f.key]) && (
                        <span className="text-xs text-muted-foreground">Core features only</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-border">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => navigate("/auth")} disabled={submitting}>
                  Sign in instead
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      Launch Church <Sparkles className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Already have an account?{" "}
          <button onClick={() => navigate("/auth")} className="text-primary hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
