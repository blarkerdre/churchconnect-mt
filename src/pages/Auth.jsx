import React, { useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { DEFAULT_TENANT_ID } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const { tenantSlug } = useParams();
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!signupCooldown) return;
    const interval = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setSignupCooldown(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [signupCooldown]);

  // Fetch tenant branding when a slug is present
  const { data: tenant } = useQuery({
    queryKey: ["tenant-branding", tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_tenant_by_slug", { _slug: tenantSlug });
      if (error) throw error;
      // RPC returns an array; take the first row
      return Array.isArray(data) ? data[0] ?? null : data;
    },
    enabled: !!tenantSlug,
  });

  // Resolve default tenant slug for signup fallback when no slug in URL
  const { data: defaultTenantSlug } = useQuery({
    queryKey: ["default-tenant-slug"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", DEFAULT_TENANT_ID)
        .maybeSingle();
      if (error) throw error;
      return data?.slug || null;
    },
    enabled: !tenantSlug,
  });

  // Use URL slug or fall back to the default tenant slug
  const effectiveSlug = tenantSlug || defaultTenantSlug;

  const churchName = tenant?.name || "Church Connect";

  // Set favicon and OG tags for tenant auth pages
  useEffect(() => {
    if (!tenant?.settings) return;
    const { favicon_url, og_image_url } = tenant.settings;

    if (favicon_url) {
      const link = document.querySelector('link[rel="icon"]');
      if (link) link.href = favicon_url;
    }

    if (og_image_url) {
      const ogMeta = document.querySelector('meta[property="og:image"]');
      if (ogMeta) ogMeta.setAttribute("content", og_image_url);
      const twMeta = document.querySelector('meta[name="twitter:image"]');
      if (twMeta) twMeta.setAttribute("content", og_image_url);
    }
  }, [tenant?.settings]);

  // Query tenant membership for redirect when no slug in URL
  const { data: userMembership, isLoading: membershipLoading } = useQuery({
    queryKey: ["auth-redirect-membership", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("tenant_id, tenants(slug)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !tenantSlug,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    if (tenantSlug) {
      return <Navigate to={`/t/${tenantSlug}`} replace />;
    }
    // Wait for membership query before redirecting
    if (membershipLoading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      );
    }
    const slug = userMembership?.tenants?.slug;
    const redirectTo = slug ? `/t/${slug}` : "/";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(form.email, form.password);
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await signUp(form.email, form.password, form.fullName, effectiveSlug);
        if (error) throw error;
        if (data?.user?.identities?.length === 0) {
          toast({
            title: "Email already registered",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Account created!", description: "Please check your email to verify your account." });
          setSignupCooldown(true);
          setCooldownSeconds(60);
        }
        setMode("login");
      } else if (mode === "forgot") {
        const { error } = await resetPassword(form.email);
        if (error) throw error;
        toast({ title: "Reset email sent", description: "Check your inbox for a password reset link." });
        setMode("login");
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logoUrl} alt={`${churchName} Logo`} className="h-16 w-16 object-contain mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground">{churchName}</h1>
          {churchSubtitle && <p className="text-sm text-muted-foreground">{churchSubtitle}</p>}
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl">
              {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Welcome back! Enter your credentials."
                : mode === "signup"
                ? "Join the church management platform."
                : "We'll send you a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={form.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting || (mode === "signup" && signupCooldown)}>
                {submitting ? "Please wait..." : signupCooldown && mode === "signup" ? (
                  `Resend in ${cooldownSeconds}s`
                ) : (
                  <>
                    {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2">
              {mode === "login" && (
                <>
                  <button onClick={() => setMode("forgot")} className="text-sm text-primary hover:underline">
                    Forgot password?
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                      Sign up
                    </button>
                  </p>
                </>
              )}
              {mode !== "login" && (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
