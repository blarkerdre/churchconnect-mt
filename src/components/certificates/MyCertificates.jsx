import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function MyCertificates({ memberId, hiddenCourseNames = [] }) {
  const { tenantId } = useTenantQuery();
  const { data: completions = [], isLoading } = useQuery({
    queryKey: ["training-completions", memberId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_completions")
        .select("*")
        .eq("member_id", memberId)
        .eq("tenant_id", tenantId)
        .order("completion_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!memberId && !!tenantId,
  });

  const handleDownload = async (completion) => {
    if (!completion.certificate_url) {
      toast({ title: "Certificate file not available", variant: "destructive" });
      return;
    }
    const path = completion.certificate_url;
    const ext = path.endsWith(".png") ? "png" : path.endsWith(".svg") ? "svg" : "pdf";
    const filename = `${completion.certificate_number || "certificate"}.${ext}`;

    // Fetch the file with the member's own sign-in so access is checked at the
    // moment of download; no shareable link is ever created.
    const tryFetch = async (p) => supabase.storage.from("church-documents").download(p);

    try {
      let { data, error } = await tryFetch(path);
      // Backward compatibility: older rows were saved without the tenant_id/ prefix
      if ((error || !data) && tenantId && !path.startsWith(`${tenantId}/`)) {
        const retry = await tryFetch(`${tenantId}/${path}`);
        data = retry.data;
        error = retry.error;
      }
      if (error || !data) throw error || new Error("Could not download certificate");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast({ title: "Error downloading certificate", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const visibleCompletions = completions.filter(c => !hiddenCourseNames.includes(c.training_type));

  if (visibleCompletions.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" /> My Certificates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visibleCompletions.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium text-foreground">{c.training_type}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.completion_date), "dd MMM yyyy")}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{c.student_number || c.certificate_number}</Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(c)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
