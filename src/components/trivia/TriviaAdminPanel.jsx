import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { generateTriviaQuestions } from "@/lib/trivia-generator";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";

const EMPTY = {
  prompt: "",
  options: ["", "", "", ""],
  correct_index: 0,
  reference: "",
  explanation: "",
  difficulty: "medium",
  active: true,
};

export default function TriviaAdminPanel({ tenantId }) {
  const queryClient = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genCount, setGenCount] = useState("10");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["trivia-questions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trivia_questions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = questions.filter((q) => {
    if (sourceFilter !== "all" && q.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (q.prompt || "").toLowerCase().includes(s) || (q.reference || "").toLowerCase().includes(s);
  });

  const openNew = () => { setForm(EMPTY); setEditingId(null); setDialogOpen(true); };
  const openEdit = (q) => {
    setForm({
      prompt: q.prompt || "",
      options: Array.isArray(q.options) && q.options.length ? q.options : ["", "", "", ""],
      correct_index: q.correct_index ?? 0,
      reference: q.reference || "",
      explanation: q.explanation || "",
      difficulty: q.difficulty || "medium",
      active: q.active !== false,
    });
    setEditingId(q.id);
    setDialogOpen(true);
  };

  const save = async () => {
    const options = form.options.map((o) => String(o || "").trim()).filter(Boolean);
    if (!form.prompt.trim()) return toast.error("Enter the question.");
    if (options.length < 2) return toast.error("Enter at least two answer options.");
    if (form.correct_index >= options.length) return toast.error("Pick a valid correct answer.");
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        prompt: form.prompt.trim(),
        options,
        correct_index: Number(form.correct_index),
        reference: form.reference.trim() || null,
        explanation: form.explanation.trim() || null,
        difficulty: form.difficulty,
        active: form.active,
        source: "admin",
      };
      if (editingId) {
        const { error } = await supabase
          .from("trivia_questions").update(payload)
          .eq("id", editingId).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trivia_questions").insert(payload);
        if (error) throw error;
      }
      toast.success(editingId ? "Question updated" : "Question added");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["trivia-questions", tenantId] });
    } catch (err) {
      toast.error(err.message || "Could not save the question.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q) => {
    const ok = await confirmDelete({
      title: "Delete question",
      description: "This removes the question from the bank. Past results are kept.",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("trivia_questions").delete().eq("id", q.id).eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    toast.success("Question deleted");
    queryClient.invalidateQueries({ queryKey: ["trivia-questions", tenantId] });
  };

  const toggleActive = async (q) => {
    const { error } = await supabase
      .from("trivia_questions").update({ active: !q.active })
      .eq("id", q.id).eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["trivia-questions", tenantId] });
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const items = await generateTriviaQuestions(Math.min(Math.max(parseInt(genCount, 10) || 10, 1), 50));
      if (!items.length) throw new Error("Nothing generated");
      const rows = items.map((q) => ({ ...q, tenant_id: tenantId, active: true }));
      const { error } = await supabase.from("trivia_questions").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} questions generated from the KJV text`);
      queryClient.invalidateQueries({ queryKey: ["trivia-questions", tenantId] });
    } catch (err) {
      toast.error(err.message || "Could not generate questions.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Question bank</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={openNew} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Add question
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                type="number"
                min="1"
                max="50"
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
                className="w-20"
              />
              <Button variant="outline" onClick={generate} disabled={generating} className="flex-1 sm:flex-none">
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Auto-generate
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="admin">Admin written</SelectItem>
                <SelectItem value="generated">Auto-generated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !filtered.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No questions yet. Add your own or auto-generate a starter set.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((q) => (
                <div key={q.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 min-w-0 text-sm whitespace-pre-line break-words">{q.prompt}</p>
                    <Switch checked={q.active !== false} onCheckedChange={() => toggleActive(q)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.reference && <Badge variant="outline" className="text-xs">{q.reference}</Badge>}
                    <Badge variant="secondary" className="text-xs">{q.difficulty}</Badge>
                    <Badge variant="outline" className="text-xs">{q.source === "generated" ? "Auto" : "Admin"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Answer: {(Array.isArray(q.options) ? q.options : [])[q.correct_index]}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(q)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(q)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit question" : "Add question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Answer options (select the correct one)</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={Number(form.correct_index) === i}
                    onChange={() => setForm({ ...form, correct_index: i })}
                    className="h-4 w-4 shrink-0"
                  />
                  <Input
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[i] = e.target.value;
                      setForm({ ...form, options: next });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Scripture reference</Label>
                <Input value={form.reference} placeholder="John 3:16" onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Explanation (shown after answering)</Label>
              <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
