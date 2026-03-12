import React from "react";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <ShieldX className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">Access Denied</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        You don't have permission to view this page. Please contact an administrator if you believe this is a mistake.
      </p>
      <Button asChild className="bg-[#1e3a5f] hover:bg-[#152d4a]">
        <Link to={createPageUrl("Dashboard")}>Back to Dashboard</Link>
      </Button>
    </div>
  );
}