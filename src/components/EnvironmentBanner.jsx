import React from "react";
import { isPreviewEnvironment } from "@/lib/environment";
import { useAuth } from "@/hooks/useAuth";

/**
 * Persistent environment indicator banner.
 * Shows a bold TEST or LIVE ribbon at the top of the app for admins.
 */
export default function EnvironmentBanner() {
  const { isAdmin } = useAuth();
  
  if (!isAdmin) return null;

  const isTest = isPreviewEnvironment();

  return (
    <div
      className={`w-full text-center text-[11px] font-bold tracking-wide py-1 ${
        isTest
          ? "bg-amber-500 text-amber-950"
          : "bg-emerald-600 text-white"
      }`}
    >
      {isTest ? "⚠ TEST ENVIRONMENT" : "● LIVE ENVIRONMENT"}
    </div>
  );
}
