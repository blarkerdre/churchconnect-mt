import { useState } from "react";
import { AlertTriangle, X, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PaymentWarningBanner() {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      <span className="text-amber-800 dark:text-amber-200 flex-1">
        Your subscription payment is overdue. Please make a payment to avoid service interruption.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
        onClick={() => navigate("/settings?tab=billing")}
      >
        <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay Now
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
