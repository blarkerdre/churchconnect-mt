import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Loader2 } from "lucide-react";

export default function FeedbackSummary() {
  const { tenantId } = useTenantQuery();

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ["app-feedback-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const total = feedback.length;
  const avg = total > 0 ? (feedback.reduce((s, f) => s + f.rating, 0) / total).toFixed(1) : "—";
  const distribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: feedback.filter((f) => f.rating === r).length,
  }));
  const withComments = feedback.filter((f) => f.comment);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-accent" />
        App Feedback
      </h3>

      {total === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No feedback received yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-5 w-5 fill-accent text-accent" />
                  <span className="text-2xl font-bold text-foreground">{avg}</span>
                </div>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Total Responses</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm col-span-2 sm:col-span-1">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{withComments.length}</p>
                <p className="text-xs text-muted-foreground">With Comments</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribution */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {distribution.map((d) => (
                <div key={d.rating} className="flex items-center gap-2">
                  <span className="text-sm w-6 text-right text-muted-foreground">{d.rating}★</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${total > 0 ? (d.count / total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">{d.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent comments */}
          {withComments.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recent Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                {withComments.slice(0, 20).map((f) => (
                  <div key={f.id} className="border-b border-border last:border-0 pb-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < f.rating ? "fill-accent text-accent" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-foreground">{f.comment}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(f.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
