import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "@/components/ui/use-toast";

export default function AppFeedbackDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: existing, isLoading } = useQuery({
    queryKey: ["app-feedback-own", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!tenantId && open,
  });

  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment || "");
    } else {
      setRating(0);
      setComment("");
    }
  }, [existing, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { error } = await supabase
          .from("app_feedback")
          .update({ rating, comment: comment.trim() || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_feedback")
          .insert({ user_id: userId, tenant_id: tenantId, rating, comment: comment.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-feedback-own"] });
      queryClient.invalidateQueries({ queryKey: ["app-feedback-all"] });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setRating(0);
      setHoveredRating(0);
      setComment("");
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rate This App</DialogTitle>
          <DialogDescription>Your feedback helps us improve the experience.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoveredRating(s)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${s <= displayRating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
              </p>
            )}
            <Textarea
              placeholder="Any additional comments? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <Button
              className="w-full"
              disabled={rating === 0 || mutation.isPending || !userId || !tenantId}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {existing ? "Update Feedback" : "Submit Feedback"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
