import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquareHeart, Search, ChevronDown, ChevronUp, Share2, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function Testimony() {
  const { tenantId } = useTenantQuery();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminExpandedId, setAdminExpandedId] = useState(null);
  const [adminFilter, setAdminFilter] = useState("all");

  const { data: allTestimonies = [], isLoading: loadingAll } = useQuery({
    queryKey: ["all-testimonies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("testimonies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!isAdmin,
  });


  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      const { data } = await supabase
        .from("members")
        .select("first_name, last_name, email")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  const { data: testimonies = [], isLoading: loadingTestimonies } = useQuery({
    queryKey: ["my-testimonies", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return [];
      const { data, error } = await supabase
        .from("testimonies")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!tenantId,
  });

  const [form, setForm] = useState({
    name: "",
    title: "",
    situation: "",
    action: "",
    god_did: "",
    share_publicly: false,
  });

  React.useEffect(() => {
    if (myMember) {
      setForm((f) => ({ ...f, name: `${myMember.first_name} ${myMember.last_name}` }));
    }
  }, [myMember]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
    if (!form.situation.trim() || !form.action.trim() || !form.god_did.trim()) {
      toast({ title: "Please fill in all three fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("send-testimony", {
        body: {
          tenant_id: tenantId,
          member_name: form.name.trim() || "Anonymous",
          title: form.title.trim(),
          situation: form.situation.trim(),
          action: form.action.trim(),
          god_did: form.god_did.trim(),
          share_publicly: form.share_publicly,
          sender_email: myMember?.email || null,
          user_id: user?.id || null,
        },
      });
      if (error) throw error;
      toast({ title: "Testimony shared!", description: "Thank you for sharing what the Lord has done." });
      setForm({ name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "", title: "", situation: "", action: "", god_did: "", share_publicly: false });
      queryClient.invalidateQueries({ queryKey: ["my-testimonies"] });
    } catch (err) {
      toast({ title: "Error sending testimony", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = testimonies.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.situation?.toLowerCase().includes(q) ||
      t.god_did?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Share Your Testimony</h1>
        <p className="text-sm text-muted-foreground mt-1">Tell us what the Lord has done in your life</p>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="new" className="flex-1">New Testimony</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">My Testimonies</TabsTrigger>
          {isAdmin && <TabsTrigger value="all" className="flex-1">All ({allTestimonies.length})</TabsTrigger>}
        </TabsList>


        <TabsContent value="new">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <MessageSquareHeart className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-lg font-semibold">Your Testimony</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Your Name</Label>
                  <Input value={form.name} onChange={set("name")} placeholder="Your name (optional)" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Testimony Title</Label>
                  <Input value={form.title} onChange={set("title")} placeholder="Give your testimony a title..." maxLength={200} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">What was the situation?</Label>
                  <Textarea value={form.situation} onChange={set("situation")} placeholder="Describe the challenge or circumstance you faced..." rows={4} maxLength={2000} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">What did you do?</Label>
                  <Textarea value={form.action} onChange={set("action")} placeholder="What steps of faith did you take..." rows={4} maxLength={2000} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">What has the Lord done?</Label>
                  <Textarea value={form.god_did} onChange={set("god_did")} placeholder="Share how God moved in your situation..." rows={4} maxLength={2000} required />
                </div>
                <div className="flex items-start space-x-2 pt-1">
                  <Checkbox
                    id="share_publicly"
                    checked={form.share_publicly}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, share_publicly: !!checked }))}
                  />
                  <Label htmlFor="share_publicly" className="text-sm leading-snug cursor-pointer">
                    I would like my testimony to be shared in church
                  </Label>
                </div>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Testimony
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search testimonies..."
                className="pl-9"
              />
            </div>

            {loadingTestimonies ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border">
                <CardContent className="py-8 text-center text-muted-foreground">
                  {testimonies.length === 0
                    ? "You haven't shared any testimonies yet."
                    : "No testimonies match your search."}
                </CardContent>
              </Card>
            ) : (
              filtered.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <Card key={t.id} className="border shadow-sm">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{t.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(t.created_at), "dd MMM yyyy")}</span>
                          {t.share_publicly ? (
                            <span className="inline-flex items-center gap-0.5 text-primary"><Share2 className="h-3 w-3" /> Shared</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5"><Lock className="h-3 w-3" /> Private</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 space-y-3 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground text-xs mb-1">What was the situation?</p>
                          <p className="whitespace-pre-wrap text-foreground">{t.situation}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs mb-1">What did you do?</p>
                          <p className="whitespace-pre-wrap text-foreground">{t.action}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs mb-1">What has the Lord done?</p>
                          <p className="whitespace-pre-wrap text-foreground">{t.god_did}</p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
        {isAdmin && (
          <TabsContent value="all">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{allTestimonies.length}</span> testimon{allTestimonies.length === 1 ? "y" : "ies"} submitted
                </p>
                <div className="flex gap-1">
                  {["all", "shared", "private"].map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={adminFilter === f ? "default" : "outline"}
                      onClick={() => setAdminFilter(f)}
                      className="h-7 text-xs capitalize"
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search by subject, sender, or content..."
                  className="pl-9"
                />
              </div>

              {loadingAll ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                (() => {
                  const filteredAll = allTestimonies.filter((t) => {
                    if (adminFilter === "shared" && !t.share_publicly) return false;
                    if (adminFilter === "private" && t.share_publicly) return false;
                    if (!adminSearch.trim()) return true;
                    const q = adminSearch.toLowerCase();
                    return (
                      t.title?.toLowerCase().includes(q) ||
                      t.member_name?.toLowerCase().includes(q) ||
                      t.situation?.toLowerCase().includes(q) ||
                      t.god_did?.toLowerCase().includes(q)
                    );
                  });
                  if (filteredAll.length === 0) {
                    return (
                      <Card className="border">
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No testimonies match the current filter.
                        </CardContent>
                      </Card>
                    );
                  }
                  return filteredAll.map((t) => {
                    const isExpanded = adminExpandedId === t.id;
                    return (
                      <Card key={t.id} className="border shadow-sm">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
                          onClick={() => setAdminExpandedId(isExpanded ? null : t.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{t.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium text-foreground/80">{t.member_name || "Anonymous"}</span>
                              <span>·</span>
                              <span>{format(new Date(t.created_at), "dd MMM yyyy")}</span>
                              {t.share_publicly ? (
                                <span className="inline-flex items-center gap-0.5 text-primary"><Share2 className="h-3 w-3" /> Shared</span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5"><Lock className="h-3 w-3" /> Private</span>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        </button>
                        {isExpanded && (
                          <CardContent className="pt-0 pb-4 space-y-3 text-sm">
                            <div>
                              <p className="font-medium text-muted-foreground text-xs mb-1">What was the situation?</p>
                              <p className="whitespace-pre-wrap text-foreground">{t.situation}</p>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground text-xs mb-1">What did you do?</p>
                              <p className="whitespace-pre-wrap text-foreground">{t.action}</p>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground text-xs mb-1">What has the Lord done?</p>
                              <p className="whitespace-pre-wrap text-foreground">{t.god_did}</p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  });
                })()
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>

  );
}
