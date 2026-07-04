import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useTour } from "@/components/tour/TourProvider";
import { toast } from "sonner";

export default function ReplayToursSection() {
  const tour = useTour();
  const [busy, setBusy] = React.useState(false);
  const handle = async () => {
    if (!tour) return;
    setBusy(true);
    try {
      await tour.resetAllTours();
      toast.success("Onboarding tours reset — they'll auto-play again on each page.");
    } catch (e) {
      toast.error(e?.message || "Could not reset tours");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card data-tour="settings-restart-tours">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RotateCcw className="h-4 w-4 text-primary" /> Onboarding tours
        </CardTitle>
        <CardDescription>
          Reset every module's guided tour so it plays again the next time you open that page. You can also relaunch any single tour from the ? button in a page header.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={handle} disabled={busy}>
          {busy ? "Resetting…" : "Replay all tours"}
        </Button>
      </CardContent>
    </Card>
  );
}
