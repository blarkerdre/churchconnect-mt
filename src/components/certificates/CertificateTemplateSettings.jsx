import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Award, Plus, Pencil, Trash2, Upload, Image, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAppSetting } from "@/hooks/useAppSetting";

const emptyTemplate = {
  training_type: "",
  church_name: "Winners Chapel International Cardiff",
  signatory_name: "",
  signatory_title: "",
  background_color: "#1a2d4d",
  accent_color: "#c5a028",
  custom_message: "This is to certify that the above named has successfully completed",
  background_image_url: "",
  text_positions: { name_y: 280, training_y: 340, date_y: 380, signatory_y: 500 },
};

export default function CertificateTemplateSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);
  const [uploading, setUploading] = useState(false);
  const [useCustomType, setUseCustomType] = useState(false);

  const { data: courses = [] } = useQuery({
    queryKey: ["exam-titles-active"],
    queryFn: async () => {
      const { data } = await supabase.from("exam_titles").select("name").eq("is_active", true);
      return data || [];
    },
  });
  const { data: settingsTypes } = useAppSetting("training_types", []);

  const allTypes = useMemo(() => {
    const courseNames = courses.map(c => c.name);
    const merged = new Set(["Default", ...courseNames, ...(settingsTypes || [])]);
    return [...merged];
  }, [courses, settingsTypes]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .order("training_type");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editing) {
        const { error } = await supabase
          .from("certificate_templates")
          .update(values)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("certificate_templates")
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast({ title: editing ? "Template updated" : "Template created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyTemplate); setUseCustomType(false); setDialogOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setUseCustomType(false);
    setForm({
      training_type: t.training_type,
      church_name: t.church_name,
      signatory_name: t.signatory_name,
      signatory_title: t.signatory_title,
      background_color: t.background_color,
      accent_color: t.accent_color,
      custom_message: t.custom_message || "",
      background_image_url: t.background_image_url || "",
      text_positions: t.text_positions || emptyTemplate.text_positions,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyTemplate); setUseCustomType(false); };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file (PNG, JPG)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File must be under 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `certificate-backgrounds/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("church-documents")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      set("background_image_url", path);
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  React.useEffect(() => {
    if (!form.background_image_url) { setPreviewUrl(null); return; }
    supabase.storage
      .from("church-documents")
      .createSignedUrl(form.background_image_url, 300)
      .then(({ data }) => setPreviewUrl(data?.signedUrl || null));
  }, [form.background_image_url]);

  const handleSave = () => {
    if (!form.training_type.trim()) {
      toast({ title: "Training type is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      training_type: form.training_type.trim(),
      church_name: form.church_name,
      signatory_name: form.signatory_name,
      signatory_title: form.signatory_title,
      background_color: form.background_color,
      accent_color: form.accent_color,
      custom_message: form.custom_message || null,
      background_image_url: form.background_image_url || null,
      text_positions: form.text_positions,
    });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPos = (k, v) => setForm(f => ({ ...f, text_positions: { ...f.text_positions, [k]: Number(v) || 0 } }));

  const escapeXml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  const generatePreviewSvg = () => {
    const memberName = "John Doe";
    const trainingType = form.training_type || "Training Programme";
    const certNumber = "CERT-XXXX-2026-0001";
    const formattedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const churchName = form.church_name || "Winners Chapel International Cardiff";
    const sigName = form.signatory_name || "";
    const sigTitle = form.signatory_title || "";
    const bgColor = form.background_color || "#1a2d4d";
    const accentColor = form.accent_color || "#c5a028";
    const customMessage = form.custom_message || "This is to certify that the above named has successfully completed";

    if (form.background_image_url && previewUrl) {
      const nameY = form.text_positions?.name_y || 280;
      const trainingY = form.text_positions?.training_y || 340;
      const dateY = form.text_positions?.date_y || 380;
      const sigY = form.text_positions?.signatory_y || 500;
      const certNumY = dateY + 25;

      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="842" height="595" viewBox="0 0 842 595">
  <defs><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;family=Inter:wght@400;500;600&amp;display=swap');</style></defs>
  <image href="${previewUrl}" width="842" height="595" preserveAspectRatio="xMidYMid slice"/>
  <text x="421" y="${nameY}" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="32" fill="${bgColor}">${escapeXml(memberName)}</text>
  <text x="421" y="${trainingY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="18" fill="${bgColor}">${escapeXml(trainingType)}</text>
  <text x="421" y="${dateY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#666">Completed on ${formattedDate}</text>
  <text x="421" y="${certNumY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="10" fill="#aaa">Certificate No: ${certNumber}</text>
  ${sigName ? `
  <line x1="301" y1="${sigY - 20}" x2="541" y2="${sigY - 20}" stroke="#ccc" stroke-width="1"/>
  <text x="421" y="${sigY}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="13" fill="${bgColor}">${escapeXml(sigName)}</text>
  <text x="421" y="${sigY + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="11" fill="#888">${escapeXml(sigTitle)}</text>` : ""}
</svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="842" height="595" viewBox="0 0 842 595">
  <defs><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;family=Inter:wght@400;500;600&amp;display=swap');</style></defs>
  <rect width="842" height="595" fill="${bgColor}"/>
  <rect x="24" y="24" width="794" height="547" rx="8" fill="white" stroke="${accentColor}" stroke-width="3"/>
  <rect x="36" y="36" width="770" height="523" rx="4" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="8,4"/>
  <rect x="321" y="60" width="200" height="4" rx="2" fill="${accentColor}"/>
  <text x="421" y="100" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${bgColor}" letter-spacing="3">${escapeXml(churchName.toUpperCase())}</text>
  <text x="421" y="150" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="36" fill="${bgColor}">CERTIFICATE</text>
  <text x="421" y="180" text-anchor="middle" font-family="Inter, sans-serif" font-weight="500" font-size="14" fill="#666" letter-spacing="5">OF COMPLETION</text>
  <text x="421" y="220" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="12" fill="#888">${escapeXml(customMessage)}</text>
  <text x="421" y="280" text-anchor="middle" font-family="Playfair Display, serif" font-weight="700" font-size="32" fill="${bgColor}">${escapeXml(memberName)}</text>
  <line x1="221" y1="295" x2="621" y2="295" stroke="${accentColor}" stroke-width="1.5"/>
  <text x="421" y="340" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="18" fill="${bgColor}">${escapeXml(trainingType)}</text>
  <text x="421" y="380" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#666">Completed on ${formattedDate}</text>
  <text x="421" y="405" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="10" fill="#aaa">Certificate No: ${certNumber}</text>
  ${sigName ? `
  <line x1="301" y1="480" x2="541" y2="480" stroke="#ccc" stroke-width="1"/>
  <text x="421" y="500" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="13" fill="${bgColor}">${escapeXml(sigName)}</text>
  <text x="421" y="518" text-anchor="middle" font-family="Inter, sans-serif" font-weight="400" font-size="11" fill="#888">${escapeXml(sigTitle)}</text>` : ""}
  <rect x="321" y="545" width="200" height="4" rx="2" fill="${accentColor}"/>
</svg>`;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" /> Certificate Templates
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Customize certificate appearance per training type. Create a "Default" template to apply signatory and branding to all certificates without a specific template. Upload a sample certificate image to use as background.
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 w-full sm:w-auto shrink-0">
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No custom templates. Default branding will be used for certificates.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex gap-1 shrink-0">
                    {t.background_image_url ? (
                      <Image className="h-4 w-4 text-primary" />
                    ) : (
                      <>
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: t.background_color }} />
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: t.accent_color }} />
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{t.training_type}</span>
                    {t.signatory_name && (
                      <p className="text-xs text-muted-foreground">Signed by {t.signatory_name}</p>
                    )}
                    {t.background_image_url && (
                      <p className="text-xs text-primary">Custom background image</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => window.confirm(`Delete template for "${t.training_type}"?`) && deleteMutation.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Add Certificate Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Training Type *</Label>
              {editing ? (
                <Input value={form.training_type} disabled />
              ) : useCustomType ? (
                <div className="flex gap-2">
                  <Input
                    value={form.training_type}
                    onChange={(e) => set("training_type", e.target.value)}
                    placeholder="Enter custom training type"
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={() => { setUseCustomType(false); set("training_type", ""); }}>
                    Back
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.training_type}
                  onValueChange={(v) => {
                    if (v === "__other__") {
                      setUseCustomType(true);
                      set("training_type", "");
                    } else {
                      set("training_type", v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select training type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="__other__">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Church Name</Label>
              <Input value={form.church_name} onChange={(e) => set("church_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Signatory Name</Label>
                <Input value={form.signatory_name} onChange={(e) => set("signatory_name", e.target.value)} placeholder="e.g. Pastor Name" />
              </div>
              <div className="space-y-1.5">
                <Label>Signatory Title</Label>
                <Input value={form.signatory_title} onChange={(e) => set("signatory_title", e.target.value)} placeholder="e.g. Senior Pastor" />
              </div>
            </div>

            {/* Background Image Upload */}
            <div className="space-y-1.5">
              <Label>Certificate Background Image</Label>
              <p className="text-xs text-muted-foreground">Upload a sample certificate (PNG/JPG) to use as the background. Text will be overlaid on top.</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50 text-sm">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
                {form.background_image_url && (
                  <Button variant="ghost" size="sm" onClick={() => set("background_image_url", "")}>Remove</Button>
                )}
              </div>
              {previewUrl && (
                <img src={previewUrl} alt="Certificate background" className="mt-2 rounded-md border max-h-40 w-full object-contain" />
              )}
            </div>

            {/* Text Position Controls - only show when background image is set */}
            {form.background_image_url && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Text Positions (Y offset in pixels)</Label>
                <p className="text-xs text-muted-foreground">Adjust where text appears on the certificate (0 = top, 595 = bottom)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name Y</Label>
                    <Input type="number" value={form.text_positions?.name_y || 280} onChange={(e) => setPos("name_y", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Training Type Y</Label>
                    <Input type="number" value={form.text_positions?.training_y || 340} onChange={(e) => setPos("training_y", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Y</Label>
                    <Input type="number" value={form.text_positions?.date_y || 380} onChange={(e) => setPos("date_y", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Signatory Y</Label>
                    <Input type="number" value={form.text_positions?.signatory_y || 500} onChange={(e) => setPos("signatory_y", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Color controls - only when no background image */}
            {!form.background_image_url && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.background_color} onChange={(e) => set("background_color", e.target.value)} className="h-9 w-9 rounded cursor-pointer border" />
                    <Input value={form.background_color} onChange={(e) => set("background_color", e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-9 rounded cursor-pointer border" />
                    <Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Custom Message</Label>
              <Textarea
                value={form.custom_message}
                onChange={(e) => set("custom_message", e.target.value)}
                placeholder="This is to certify that..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1.5">
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Update" : "Create"} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-lg overflow-hidden border bg-muted/30">
            <div
              dangerouslySetInnerHTML={{ __html: generatePreviewSvg() }}
              className="w-full [&>svg]:w-full [&>svg]:h-auto"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Preview uses sample data. Actual certificates will show real member details.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
