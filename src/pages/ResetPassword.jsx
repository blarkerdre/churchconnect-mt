import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Church, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const { updatePassword, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const signInPath = tenantSlug ? `/t/${tenantSlug}/auth` : "/auth";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });

      // Best-effort: work out the church to land in. A recovery session may not
      // be fully verified yet (2FA accounts), in which case this read returns
      // nothing — fall back to the slug in the URL, then to a success screen.
      let redirectTo = tenantSlug ? `/t/${tenantSlug}` : null;
      if (user?.id) {
        try {
          const { data: membership } = await supabase
            .from("tenant_memberships")
            .select("tenants(slug)")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
          if (membership?.tenants?.slug) {
            redirectTo = `/t/${membership.tenants.slug}`;
          }
        } catch {
          // ignore — handled by the fallback below
        }
      }

      if (redirectTo) {
        navigate(redirectTo);
      } else {
        setDone(true);
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Church className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Set New Password</h1>
        </div>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            {done ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Password updated — sign in with your new password.
                </p>
                <Button asChild className="w-full">
                  <Link to={signInPath}>Go to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
