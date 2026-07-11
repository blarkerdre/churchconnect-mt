import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation_details", { _token: token });
      if (error) {
        setError(error.message);
      } else if (!data || data.length === 0) {
        setError("Invitation not found.");
      } else {
        setInvite(data[0]);
        setEmail(data[0].email || "");
      }
      setLoading(false);
    })();
  }, [token]);

  const emailMatches = user && invite && user.email?.toLowerCase() === invite.email?.toLowerCase();

  async function handleSignIn(e) {
    e.preventDefault();
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigningIn(false);
    if (error) {
      toast.error(error.message);
    }
  }

  async function handleAccept(allowMismatch = false) {
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_tenant_invitation_by_token", {
      _token: token,
      _allow_email_mismatch: allowMismatch,
    });
    setAccepting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const slug = data?.[0]?.tenant_slug || invite?.tenant_slug;
    toast.success(`You've joined ${invite?.tenant_name}`);
    navigate(slug ? `/t/${slug}` : "/");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Invitation unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error || "This invitation link is invalid."}</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation already {invite.status}</CardTitle>
            <CardDescription>
              This invitation to {invite.tenant_name} has already been {invite.status}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to={`/t/${invite.tenant_slug}/auth`}>Sign in to {invite.tenant_name}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation expired</CardTitle>
            <CardDescription>Please ask an admin to send a new invitation.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.tenant_name}</CardTitle>
          <CardDescription>
            You've been invited as <strong>{invite.role}</strong> (sent to {invite.email}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in with your existing account to accept, or{" "}
                <Link
                  to={`/t/${invite.tenant_slug}/auth?email=${encodeURIComponent(invite.email)}`}
                  className="underline text-primary"
                >
                  create a new account
                </Link>
                .
              </p>
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={signingIn}>
                  {signingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in & accept
                </Button>
              </form>
              <div className="text-center text-xs text-muted-foreground">
                <Link to={`/t/${invite.tenant_slug}/auth`} className="underline">
                  Forgot password?
                </Link>
              </div>
            </>
          ) : emailMatches ? (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Signed in as {user.email}. Ready to join {invite.tenant_name}.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => handleAccept(false)} disabled={accepting}>
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
            </>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This invitation was sent to <strong>{invite.email}</strong>, but you're signed in as{" "}
                  <strong>{user.email}</strong>.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => handleAccept(true)} disabled={accepting}>
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept with {user.email}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSignOut}>
                Sign out & use a different account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
