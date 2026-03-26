import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface NewTenantNotificationProps {
  churchName?: string
  slug?: string
  adminName?: string
  adminEmail?: string
  createdAt?: string
}

const NewTenantNotificationEmail = ({
  churchName, slug, adminName, adminEmail, createdAt,
}: NewTenantNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New church registered: {churchName || 'Unknown'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Church Registered</Heading>
        <Text style={text}>
          A new church has been onboarded to {SITE_NAME}. Here are the details:
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Church Name:</strong> {churchName || '—'}</Text>
          <Text style={detailRow}><strong>Slug:</strong> {slug || '—'}</Text>
          <Text style={detailRow}><strong>Admin Name:</strong> {adminName || '—'}</Text>
          <Text style={detailRow}><strong>Admin Email:</strong> {adminEmail || '—'}</Text>
          <Text style={detailRow}><strong>Registered:</strong> {createdAt || new Date().toISOString()}</Text>
        </Section>

        <Hr style={hr} />

        <Text style={footerText}>
          This is an automated notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewTenantNotificationEmail,
  subject: ({ churchName }: Record<string, any>) =>
    `New tenant registered: ${churchName || 'Unknown Church'}`,
  displayName: 'New tenant notification',
  previewData: {
    churchName: 'Grace Community Church',
    slug: 'grace-community',
    adminName: 'Pastor John',
    adminEmail: 'john@grace.org',
    createdAt: '2026-03-26T12:00:00Z',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = {
  backgroundColor: '#f7f4ef',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 20px',
}
const detailRow = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 4px' }
const hr = { borderColor: '#e8e0d4', margin: '24px 0' }
const footerText = { fontSize: '13px', color: '#777777', lineHeight: '1.5', margin: '0' }
