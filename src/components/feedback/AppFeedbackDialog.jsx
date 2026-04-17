import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
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

  const [tab, setTab] = useState("submit");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["app-feedback-history", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!tenantId && open,
  });

  const latest = history[0] || null;

  useEffect(() => {
    if (open) {
      setTab("submit");
      if (latest) {
        setRating(latest.rating);
        setComment(latest.comment || "");
      } else {
        setRating(0);
        setComment("");
      }
    }
  }, [latest, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (latest) {
        const { error } = await supabase
          .from("app_feedback")
          .update({ rating, comment: comment.trim() || null })
          .eq("id", latest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_feedback")
          .insert({ user_id: userId, tenant_id: tenantId, rating, comment: comment.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-feedback-history"] });
      queryClient.invalidateQueries({ queryKey: ["app-feedback-own"] });
      queryClient.invalidateQueries({ queryKey: ["app-feedback-all"] });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>App Feedback</DialogTitle>
          <DialogDescription>Share your rating and review past feedback.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">{latest ? "Update" : "Submit"}</TabsTrigger>
            <TabsTrigger value="history">History {history.length > 0 && `(${history.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
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
                  {latest ? "Update Feedback" : "Submit Feedback"}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                No feedback submitted yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s <= item.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{item.comment}</p>
                    )}
                    {item.acknowledged_at && (
                      <div className="rounded-md border border-border bg-muted/40 p-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                          <CheckCircle2 className="h-3 w-3 text-accent" />
                          Admin replied {new Date(item.acknowledged_at).toLocaleDateString()}
                        </div>
                        {item.admin_response && (
                          <p className="text-xs text-muted-foreground italic">"{item.admin_response}"</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
