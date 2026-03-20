import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Shield } from "lucide-react";
import EmailLogsTab from "@/components/logs/EmailLogsTab.jsx";
import SMSLogsTab from "@/components/logs/SMSLogsTab.jsx";
import AuditLogsTab from "@/components/logs/AuditLogsTab.jsx";
import { useAuth } from "@/hooks/useAuth";

export default function SystemLogs() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">System Logs</h1>
        <p className="text-sm text-muted-foreground">Monitor emails, SMS, and admin activity</p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> SMS
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="audit" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Audit
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="email">
          <EmailLogsTab />
        </TabsContent>

        <TabsContent value="sms">
          <SMSLogsTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="audit">
            <AuditLogsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
