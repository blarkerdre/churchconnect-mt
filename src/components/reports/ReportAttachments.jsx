import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { assertStorageAvailable } from "@/lib/storageQuota";
import { Loader2, Upload, Download, Trash2, FileText, Paperclip } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ReportAttachments({ relatedTable, relatedId }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const qc = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["report-attachments", relatedTable, relatedId, tenantId],
    enabled: !!relatedId,
    queryFn: async () => {
      const q = supabase
        .from("documents")
        .select("*")
        .eq("related_table", relatedTable)
        .eq("related_id", relatedId)
        .order("created_at", { ascending: false });
      const { data, error } = await scopeQuery(q);
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      await supabase.storage.from("church-documents").remove([doc.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-attachments", relatedTable, relatedId, tenantId] });
      toast({ title: "File deleted" });
    },
    onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max 10MB per file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await assertStorageAvailable(tenantId, file.size);
      const ext = file.name.split(".").pop();
      // Prefix path with tenantId for tenant-scoped storage isolation
      const tenantPrefix = tenantId || "shared";
      const path = `${tenantPrefix}/${relatedTable}/${relatedId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("church-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("documents").insert(withTenant({
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        related_table: relatedTable,
        related_id: relatedId,
      }));
      if (dbErr) throw dbErr;
      qc.invalidateQueries({ queryKey: ["report-attachments", relatedTable, relatedId, tenantId] });
      toast({ title: "File uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (doc) => {
    const { data, error } = await supabase.storage
      .from("church-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!relatedId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Attachments
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {docs.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">No files attached</p>
      )}

      {docs.map((doc) => (
        <div key={doc.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{doc.file_name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.file_size)}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => deleteMutation.mutate(doc)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
