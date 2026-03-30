/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeMember } from './welcome-member.tsx'
import { template as tenantWelcome } from './tenant-welcome.tsx'
import { template as newTenantNotification } from './new-tenant-notification.tsx'
import { template as tenantInvitation } from './tenant-invitation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-member': welcomeMember,
  'tenant-welcome': tenantWelcome,
  'new-tenant-notification': newTenantNotification,
  'tenant-invitation': tenantInvitation,
}
