import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AuthExamCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState("checking"); // checking | ok | expired

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // Supabase JS auto-handles the token in URL hash. Give it a tick, then check session.
      await new Promise((r) => setTimeout(r, 400));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data?.session) {
        const next = params.get("next") || "/";
        setState("ok");
        navigate(next, { replace: true });
      } else {
        setState("expired");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "checking" && (
            <>
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </>
          )}
          {state === "ok" && (
            <p className="text-sm text-muted-foreground">Redirecting to your exam…</p>
          )}
          {state === "expired" && (
            <>
              <h1 className="text-xl font-semibold">Link expired</h1>
              <p className="text-sm text-muted-foreground">
                This sign-in link is no longer valid. Please ask your church admin
                to resend your exam link.
              </p>
              <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
