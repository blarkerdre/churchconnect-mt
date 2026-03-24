import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Plus, Pencil, Trash2, Loader2, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function BookOfTheMonthSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", author: "", description: "", month: "", cover_image_url: "", purchase_url: "" });
  const [uploading, setUploading] = useState(false);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books-of-the-month-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books_of_the_month")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        title: formData.title,
        author: formData.author,
        description: formData.description || null,
        cover_image_url: formData.cover_image_url || null,
        purchase_url: formData.purchase_url || null,
        month: formData.month + "-01",
        is_active: true,
        created_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from("books_of_the_month").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("books_of_the_month").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books-of-the-month-all"] });
      qc.invalidateQueries({ queryKey: ["book-of-the-month"] });
      toast({ title: editing ? "Book updated" : "Book added" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("books_of_the_month").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books-of-the-month-all"] });
      qc.invalidateQueries({ queryKey: ["book-of-the-month"] });
      toast({ title: "Book deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("book-covers").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("book-covers").getPublicUrl(path);
      setForm(f => ({ ...f, cover_image_url: urlData.publicUrl }));
      toast({ title: "Cover uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    const now = new Date();
    setForm({ title: "", author: "", description: "", month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, cover_image_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (book) => {
    setEditing(book);
    setForm({
      title: book.title,
      author: book.author,
      description: book.description || "",
      month: book.month?.slice(0, 7) || "",
      cover_image_url: book.cover_image_url || "",
    });
    setDialogOpen(true);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" /> Books of the Month
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Set a recommended book for each month</p>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add Book
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No books configured</p>
        ) : (
          <div className="space-y-2">
            {books.map((book) => (
              <div key={book.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  {book.cover_image_url && (
                    <img src={book.cover_image_url} alt="" className="h-10 w-7 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.author} · {book.month?.slice(0, 7)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(book)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => window.confirm("Delete this book?") && deleteMutation.mutate(book.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Book" : "Add Book of the Month"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Author *</Label><Input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Month *</Label><Input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div className="space-y-1">
              <Label>Cover Image</Label>
              {form.cover_image_url && (
                <img src={form.cover_image_url} alt="Cover" className="h-20 w-14 rounded object-cover mb-2" />
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <label className="cursor-pointer gap-1.5">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Upload Cover"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                </Button>
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.title || !form.author || !form.month} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Update" : "Add"} Book
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
