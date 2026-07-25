import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import AppFeedbackDialog from "@/components/feedback/AppFeedbackDialog";

export default function AppFeedbackSection() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const { tenantId } = useTenantQuery();
  const userId = session?.user?.id;

  const { data: existing } = useQuery({
    queryKey: ["app-feedback-own", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("rating, comment")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!tenantId,
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">App Feedback</p>
          {existing ? (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < existing.rating ? "fill-accent text-accent" : "text-muted-foreground/20"}`} />
              ))}
              {existing.comment && <span className="text-xs text-muted-foreground ml-2 truncate max-w-[120px]">"{existing.comment}"</span>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Share how you feel about the app</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {existing ? "Edit" : "Rate"}
        </Button>
      </CardContent>
      <AppFeedbackDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}
