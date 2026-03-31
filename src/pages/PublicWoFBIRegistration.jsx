import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, BookOpen } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const DEFAULT_TENANT_ID = "d8bbbdae-d9b3-4999-912d-3aa5999884b0";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  course_id: "",
  gdpr_consent: false,
  website: "", // honeypot
};

export default function PublicWoFBIRegistration() {
  const { tenantSlug } = useParams();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [resolvedTenantId, setResolvedTenantId] = useState(tenantSlug ? null : DEFAULT_TENANT_ID);
  const [tenantName, setTenantName] = useState("");
  const [tenantLogo, setTenantLogo] = useState(null);

  // Resolve tenant from slug
  useEffect(() => {
    if (tenantSlug) {
      supabase.rpc("get_tenant_by_slug", { _slug: tenantSlug })
        .then(({ data }) => {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.id) setResolvedTenantId(row.id);
          if (row?.name) setTenantName(row.name);
          if (row?.logo_url) setTenantLogo(row.logo_url);
        });
    }
  }, [tenantSlug]);

  // Load courses scoped by tenant
  useEffect(() => {
    if (!resolvedTenantId) return;
    setLoadingCourses(true);
    supabase
      .from("exam_titles")
      .select("id, name, description")
      .eq("is_active", true)
      .eq("registration_open", true)
      .eq("tenant_id", resolvedTenantId)
      .order("name")
      .then(({ data, error }) => {
        if (!error) setCourses(data || []);
        setLoadingCourses(false);
      });
  }, [resolvedTenantId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    if (!form.course_id) {
      toast({ title: "Please select a course", variant: "destructive" });
      return;
    }
    if (!form.gdpr_consent) {
      toast({ title: "Please accept the data privacy policy", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-wofbi-register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            tenant_id: resolvedTenantId,
            tenant_slug: tenantSlug || null,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast({ title: result.error || "Registration failed", variant: "destructive" });
      } else {
        setCourseName(result.course_name || "");
        setSubmitted(true);
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Toaster />
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12 space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
            <h2 className="text-2xl font-bold">Registration Successful!</h2>
            <p className="text-muted-foreground">
              You have been registered for <strong>{courseName}</strong>. You will be contacted with further details.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                setSubmitted(false);
              }}
            >
              Register Another Person
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Toaster />
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-14 w-auto mx-auto mb-2 object-contain" />
          ) : (
            <div className="flex justify-center mb-2">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
          )}
          <CardTitle className="text-2xl">WoFBI Course Registration</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {tenantName ? `${tenantName} — ` : ""}Word of Faith Bible Institute — Register for a course
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              autoComplete="off"
              tabIndex={-1}
              className="absolute opacity-0 pointer-events-none h-0 w-0"
              aria-hidden="true"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={20}
              />
            </div>

            <div className="space-y-1">
              <Label>Select Course *</Label>
              {loadingCourses ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading courses...
                </div>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No courses are currently open for registration.
                </p>
              ) : (
                <Select value={form.course_id} onValueChange={(v) => set("course_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="gdpr"
                checked={form.gdpr_consent}
                onCheckedChange={(v) => set("gdpr_consent", !!v)}
              />
              <Label htmlFor="gdpr" className="text-sm leading-snug cursor-pointer">
                By completing this form, you agree that WMA-WCI will use, process and retain your personal data in accordance with our{" "}
                <a
                  href="https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Privacy Policy
                </a>
                . You have the right to withdraw this consent at any time. *
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={saving || courses.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Registering...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
