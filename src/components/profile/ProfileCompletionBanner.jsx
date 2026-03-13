import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PROFILE_FIELDS = [
  "first_name", "last_name", "email", "phone", "address", "city", "postcode",
  "date_of_birth", "gender", "emergency_contact_name", "emergency_contact_phone",
];

export default function ProfileCompletionBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: member } = useQuery({
    queryKey: ["profile-completion", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!member) return null;

  const filled = PROFILE_FIELDS.filter((f) => member[f] && String(member[f]).trim() !== "").length;
  const pct = Math.round((filled / PROFILE_FIELDS.length) * 100);

  if (pct >= 100) return null;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-accent/5">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Complete your profile</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pct}% complete — add missing details to help your church serve you better.
            </p>
            <Progress value={pct} className="h-1.5 mt-2" />
          </div>
          <Button size="sm" onClick={() => navigate("/my-profile")} className="shrink-0 gap-1">
            Update <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
