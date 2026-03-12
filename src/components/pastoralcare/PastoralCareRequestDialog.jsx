import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const CATEGORIES = [
  "Prayer Request",
  "Counselling Session",
  "Visitation",
  "Hospital Visit",
  "Bereavement Support",
  "Marriage Support",
  "Financial Support",
  "Spiritual Direction",
  "General Pastoral Need",
  "Other",
];

export default function PastoralCareRequestDialog({ open, onOpenChange, currentUser, myMember }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ category: "", title: "", description: "" });
  const [submitted, setSubmitted] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.PastoralCare.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    const memberName = myMember
      ? `${myMember.first_name} ${myMember.last_name}`
      : currentUser?.full_name || currentUser?.email || "Unknown";

    mutation.mutate({
      member_id: myMember?.id || "",
      member_name: memberName,
      category: form.category,
      title: form.title,
      description: form.description,
      status: "Open",
      priority: "Medium",
      date_logged: new Date().toISOString().split("T")[0],
      confidential: true,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setForm({ category: "", title: "", description: "" });
      setSubmitted(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            Request Pastoral Care
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-slate-800">Request Submitted</h3>
            <p className="text-sm text-slate-500">
              Your pastoral care request has been received. A leader will be in touch with you soon.
            </p>
            <Button onClick={handleClose} className="mt-2 bg-[#1e3a5f] hover:bg-[#152d4a]">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                Your request is confidential and will only be seen by pastoral leaders.
              </p>

              <div className="space-y-1.5">
                <Label>Type of Support Needed *</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Brief description of your need"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Details</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Share more details (optional)"
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={mutation.isPending || !form.category || !form.title}
                className="bg-[#1e3a5f] hover:bg-[#152d4a]"
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}