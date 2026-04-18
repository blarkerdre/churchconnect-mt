import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, UserX, Clock, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  usePendingJoinRequests,
  useApproveJoinRequest,
  useDeclineJoinRequest,
} from "@/hooks/usePendingJoinRequests";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function PendingJoinRequests({ filter = "all" }) {
  const { data: requests = [], isLoading } = usePendingJoinRequests();
  const approve = useApproveJoinRequest();
  const decline = useDeclineJoinRequest();
  const [declineTarget, setDeclineTarget] = useState(null);
  const [reason, setReason] = useState("");

  const filtered = requests.filter((r) => {
    if (filter === "unit") return r.request_type === "unit";
    if (filter === "home_cell") return r.request_type === "home_cell";
    return true;
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) return null;

  const handleDecline = () => {
    if (!declineTarget) return;
    decline.mutate(
      { requestId: declineTarget.id, reason: reason.trim() || null },
      {
        onSuccess: () => {
          setDeclineTarget(null);
          setReason("");
        },
      }
    );
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            Pending Join Requests
            <Badge className="ml-1 bg-accent/10 text-accent border-0">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.map((r) => {
            const m = r.member || {};
            const initials = `${(m.first_name?.[0] || "").toUpperCase()}${(m.last_name?.[0] || "").toUpperCase()}`;
            const targetLabel =
              r.request_type === "unit"
                ? r.unit_name
                : r.wsf_centre?.name || "Home Cell";
            const typeLabel = r.request_type === "unit" ? "Unit" : "Home Cell";
            return (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border bg-muted/30"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={m.photo_url || ""} alt={`${m.first_name || ""} ${m.last_name || ""}`} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {typeLabel}
                      </Badge>
                      <span className="truncate">wants to join <span className="font-medium text-foreground">{targetLabel}</span></span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(r.created_at), "PP")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setDeclineTarget(r);
                      setReason("");
                    }}
                    disabled={decline.isPending || approve.isPending}
                  >
                    <UserX className="h-3.5 w-3.5 mr-1" /> Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approve.mutate(r.id)}
                    disabled={approve.isPending || decline.isPending}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Join Request</DialogTitle>
            <DialogDescription>
              {declineTarget?.member?.first_name} {declineTarget?.member?.last_name} will be notified.
              You can optionally include a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. We're at capacity right now — please try again next month."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={decline.isPending}>
              {decline.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
