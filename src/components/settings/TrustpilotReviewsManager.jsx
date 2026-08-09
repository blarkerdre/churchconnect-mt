import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useTrustpilotSettings, useTrustpilotReviews } from "@/hooks/useTrustpilot";
import StarRow from "@/components/reviews/StarRow";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";

const EMPTY = {
  stars: 5,
  title: "",
  body: "",
  reviewer_name: "",
  reviewer_location: "",
  review_date: "",
  review_url: "",
  display_order: 0,
  is_published: true,
};

export default function TrustpilotReviewsManager() {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { data: settings } = useTrustpilotSettings();
  const { data: reviews = [], isLoading } = useTrustpilotReviews({ includeUnpublished: true });

  const [form, setForm] = useState({ profile_url: "", review_url: "", overall_score: "", total_reviews: "", is_enabled: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(EMPTY);

  useEffect(() => {
    if (!settings) return;
    setForm({
      profile_url: settings.profile_url || "",
      review_url: settings.review_url || "",
      overall_score: settings.overall_score ?? "",
      total_reviews: settings.total_reviews ?? "",
      is_enabled: !!settings.is_enabled,
    });
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trustpilot_settings").upsert({
        id: true,
        profile_url: form.profile_url.trim() || null,
        review_url: form.review_url.trim() || null,
        overall_score: form.overall_score === "" ? null : Number(form.overall_score),
        total_reviews: form.total_reviews === "" ? null : Number(form.total_reviews),
        is_enabled: form.is_enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Trustpilot settings updated." });
      qc.invalidateQueries({ queryKey: ["trustpilot-settings"] });
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveReview = useMutation({
    mutationFn: async () => {
      if (!editing.body.trim() || !editing.reviewer_name.trim()) {
        throw Object.assign(new Error("Reviewer name and review text are required."), { __friendly: true });
      }
      const payload = {
        stars: Number(editing.stars) || 5,
        title: editing.title.trim() || null,
        body: editing.body.trim(),
        reviewer_name: editing.reviewer_name.trim(),
        reviewer_location: editing.reviewer_location?.trim() || null,
        review_date: editing.review_date || null,
        review_url: editing.review_url?.trim() || null,
        display_order: Number(editing.display_order) || 0,
        is_published: !!editing.is_published,
      };
      const q = editing.id
        ? supabase.from("trustpilot_reviews").update(payload).eq("id", editing.id)
        : supabase.from("trustpilot_reviews").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Review saved." });
      qc.invalidateQueries({ queryKey: ["trustpilot-reviews"] });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: e.__friendly ? "Incomplete" : "Save failed", description: e.message, variant: "destructive" }),
  });

  const togglePublished = useMutation({
    mutationFn: async (r) => {
      const { error } = await supabase.from("trustpilot_reviews").update({ is_published: !r.is_published }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trustpilot-reviews"] }),
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const removeReview = (r) =>
    confirmDelete({
      title: "Delete review",
      description: `Remove the review by ${r.reviewer_name} from the public site?`,
      onConfirm: async () => {
        const { error } = await supabase.from("trustpilot_reviews").delete().eq("id", r.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["trustpilot-reviews"] });
      },
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trustpilot settings</CardTitle>
          <CardDescription>
            Paste your Trustpilot profile details. The public reviews section stays hidden until this is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Trustpilot profile URL</Label>
              <Input
                value={form.profile_url}
                onChange={(e) => setForm((f) => ({ ...f, profile_url: e.target.value }))}
                placeholder="https://uk.trustpilot.com/review/yourdomain.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>"Write a review" URL</Label>
              <Input
                value={form.review_url}
                onChange={(e) => setForm((f) => ({ ...f, review_url: e.target.value }))}
                placeholder="https://uk.trustpilot.com/evaluate/yourdomain.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Overall score (0-5)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.overall_score}
                onChange={(e) => setForm((f) => ({ ...f, overall_score: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total reviews</Label>
              <Input
                type="number"
                min="0"
                value={form.total_reviews}
                onChange={(e) => setForm((f) => ({ ...f, total_reviews: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Show reviews on the public site</p>
              <p className="text-xs text-muted-foreground">Landing page section, hero badge and Trust page badge.</p>
            </div>
            <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))} />
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Reviews</CardTitle>
            <CardDescription>Copy genuine reviews from your Trustpilot dashboard. Do not invent reviews.</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing({ ...EMPTY, display_order: reviews.length });
              setDialogOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add review
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews added yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRow value={r.stars} />
                    <span className="text-sm font-semibold">{r.title || "(no title)"}</span>
                    {!r.is_published && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">Hidden</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{r.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.reviewer_name}
                    {r.reviewer_location ? `, ${r.reviewer_location}` : ""}
                    {r.review_date ? ` — ${new Date(r.review_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={r.is_published} onCheckedChange={() => togglePublished.mutate(r)} />
                  <Button variant="outline" size="icon" onClick={() => { setEditing({ ...r, review_date: r.review_date || "" }); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => removeReview(r)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit review" : "Add review"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Stars</Label>
                <Input type="number" min="1" max="5" value={editing.stars} onChange={(e) => setEditing((s) => ({ ...s, stars: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Review date</Label>
                <Input type="date" value={editing.review_date || ""} onChange={(e) => setEditing((s) => ({ ...s, review_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editing.title || ""} onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Review text</Label>
              <Textarea rows={5} value={editing.body || ""} onChange={(e) => setEditing((s) => ({ ...s, body: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Reviewer name</Label>
                <Input value={editing.reviewer_name || ""} onChange={(e) => setEditing((s) => ({ ...s, reviewer_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location (optional)</Label>
                <Input value={editing.reviewer_location || ""} onChange={(e) => setEditing((s) => ({ ...s, reviewer_location: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Link to the review (optional)</Label>
                <Input value={editing.review_url || ""} onChange={(e) => setEditing((s) => ({ ...s, review_url: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Display order</Label>
                <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing((s) => ({ ...s, display_order: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Published</span>
              <Switch checked={!!editing.is_published} onCheckedChange={(v) => setEditing((s) => ({ ...s, is_published: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveReview.mutate()} disabled={saveReview.isPending}>
              {saveReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
