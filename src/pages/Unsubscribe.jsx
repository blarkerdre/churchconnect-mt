import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MailX, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("loading"); // loading | valid | used | invalid | success | error
  const [submitting, setSubmitting] = useState(false);

  // Unsubscribe is now handled on the email platform itself: every email
  // carries a hosted unsubscribe link in its footer. Legacy links that still
  // point here can no longer be actioned.
  useEffect(() => {
    setStatus("invalid");
  }, [token]);

  const handleUnsubscribe = async () => {
    setSubmitting(true);
    setStatus("invalid");
    setSubmitting(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          {status === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Validating your request…</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="mx-auto h-12 w-12 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Unsubscribe from emails</h1>
              <p className="text-muted-foreground text-sm">
                Click the button below to stop receiving app emails. You will still receive essential account emails.
              </p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Unsubscribe
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="text-xl font-semibold text-foreground">You've been unsubscribed</h1>
              <p className="text-muted-foreground text-sm">
                You won't receive app emails from us anymore.
              </p>
            </>
          )}

          {status === "used" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h1 className="text-xl font-semibold text-foreground">Already unsubscribed</h1>
              <p className="text-muted-foreground text-sm">
                This email address has already been unsubscribed.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="text-xl font-semibold text-foreground">Invalid link</h1>
              <p className="text-muted-foreground text-sm">
                This unsubscribe link is invalid or has expired.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                We couldn't process your request. Please try again later.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
