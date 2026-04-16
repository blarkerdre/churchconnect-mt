import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";

export default function FeedbackSummary() {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [responseDrafts, setResponseDrafts] = useState({});
  const [pendingId, setPendingId] = useState(null);

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

  const userIds = [...new Set(feedback.flatMap((f) => [f.user_id, f.acknowledged_by]).filter(Boolean))];

  const { data: nameMap = {} } = useQuery({
    queryKey: ["feedback-member-names", tenantId, userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from("members")
        .select("user_id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds);
      if (error) throw error;
      const map = {};
      (data || []).forEach((m) => {
        map[m.user_id] = `${m.first_name} ${m.last_name}`.trim();
      });
      return map;
    },
    enabled: !!tenantId && userIds.length > 0,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ id, response }) => {
      const { error } = await supabase
        .from("app_feedback")
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
          admin_response: response?.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => setPendingId(null),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["app-feedback-all"] });
      queryClient.invalidateQueries({ queryKey: ["app-feedback-own"] });
      setResponseDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: "Acknowledged", description: "Feedback marked as reviewed." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getName = (userId) => nameMap[userId] || "Anonymous";

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const total = feedback.length;
  const avg = total > 0 ? (feedback.reduce((s, f) => s + f.rating, 0) / total).toFixed(1) : "—";
  const distribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: feedback.filter((f) => f.rating === r).length,
  }));
  const acknowledgedCount = feedback.filter((f) => f.acknowledged_at).length;
  const pendingCount = total - acknowledgedCount;

  const renderItem = (f) => {
    const isAck = !!f.acknowledged_at;
    const draft = responseDrafts[f.id] ?? "";
    return (
      <div key={f.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3 w-3 ${i < f.rating ? "fill-accent text-accent" : "text-muted-foreground/20"}`} />
            ))}
          </div>
          <span className="text-xs font-medium text-foreground truncate">{getName(f.user_id)}</span>
        </div>
        {f.comment && <p className="text-sm text-foreground">{f.comment}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{new Date(f.updated_at).toLocaleDateString()}</p>

        {isAck ? (
          <div className="mt-2 rounded-md bg-muted/40 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              Acknowledged by {getName(f.acknowledged_by)} on {new Date(f.acknowledged_at).toLocaleDateString()}
            </div>
            {f.admin_response && (
              <p className="text-sm text-muted-foreground italic">"{f.admin_response}"</p>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Optional response to the member..."
              value={draft}
              onChange={(e) => setResponseDrafts((p) => ({ ...p, [f.id]: e.target.value }))}
              rows={2}
              maxLength={500}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pendingId === f.id}
              onClick={() => acknowledgeMutation.mutate({ id: f.id, response: draft })}
            >
              {pendingId === f.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Acknowledge
            </Button>
          </div>
        )}
      </div>
    );
  };

  const filterFeedback = (mode) => {
    if (mode === "pending") return feedback.filter((f) => !f.acknowledged_at);
    if (mode === "acknowledged") return feedback.filter((f) => f.acknowledged_at);
    return feedback;
  };

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-5 w-5 fill-accent text-accent" />
                  <span className="text-2xl font-bold text-foreground">{avg}</span>
                </div>
                <p className="text-xs text-muted-foreground">Average</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{pendingCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span className="text-2xl font-bold text-foreground">{acknowledgedCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Acknowledged</p>
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

          {/* Feedback list with tabs */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  <TabsTrigger value="pending" className="text-xs">
                    Pending {pendingCount > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{pendingCount}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="acknowledged" className="text-xs">Acknowledged</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                </TabsList>
                {["pending", "acknowledged", "all"].map((mode) => {
                  const items = filterFeedback(mode);
                  return (
                    <TabsContent key={mode} value={mode} className="mt-3">
                      {items.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">No items.</p>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {items.slice(0, 50).map(renderItem)}
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
