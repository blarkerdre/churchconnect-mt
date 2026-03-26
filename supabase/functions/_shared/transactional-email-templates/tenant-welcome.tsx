import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface TenantWelcomeProps {
  name?: string
  churchName?: string
  slug?: string
  loginUrl?: string
}

const TenantWelcomeEmail = ({ name, churchName, slug, loginUrl }: TenantWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your church is ready!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          Welcome{name ? `, ${name}` : ''}!
        </Heading>
        <Text style={text}>
          Your church <strong>{churchName || 'your church'}</strong> has been successfully set up on {SITE_NAME}.
          You're all ready to start managing your congregation.
        </Text>

        {loginUrl && (
          <Section style={buttonSection}>
            <Button style={button} href={loginUrl}>
              Go to Your Dashboard
            </Button>
          </Section>
        )}

        <Hr style={hr} />

        <Heading as="h2" style={h2}>Quick Start Guide</Heading>

        <Text style={stepText}>
          <strong>1. Add Members</strong> — Import or manually add your congregation members from the Members page.
        </Text>
        <Text style={stepText}>
          <strong>2. Set Up Registration</strong> — Share your public registration link so new members can sign up themselves.
        </Text>
        <Text style={stepText}>
          <strong>3. Configure Settings</strong> — Customise your church units, features, and branding in Settings.
        </Text>

        <Hr style={hr} />

        <Text style={footerText}>
          If you have any questions, please don't hesitate to reach out. We're here to help your church thrive.
        </Text>
        <Text style={footerText}>
          Best regards,<br />The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TenantWelcomeEmail,
  subject: ({ churchName }: Record<string, any>) =>
    churchName ? `Welcome to ${SITE_NAME} — ${churchName} is ready!` : `Welcome to ${SITE_NAME}!`,
  displayName: 'Tenant welcome',
  previewData: {
    name: 'Pastor John',
    churchName: 'Grace Community Church',
    slug: 'grace-community',
    loginUrl: 'https://app.churchmanagementsuite.org/t/grace-community/auth',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const h2 = { fontSize: '18px', fontWeight: '600' as const, color: '#1e3a5f', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const stepText = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 10px' }
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#1e3a5f',
  color: '#faf6f0',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
}
const hr = { borderColor: '#e8e0d4', margin: '24px 0' }
const footerText = { fontSize: '13px', color: '#777777', lineHeight: '1.5', margin: '0 0 8px' }
