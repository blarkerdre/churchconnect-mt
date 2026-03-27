/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface TenantInvitationProps {
  churchName?: string
  signupUrl?: string
  role?: string
}

const TenantInvitationEmail = ({ churchName, signupUrl, role }: TenantInvitationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {churchName || 'a church'} on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          You're Invited!
        </Heading>
        <Text style={text}>
          You've been invited to join <strong>{churchName || 'a church'}</strong> on {SITE_NAME}
          {role && role !== 'member' ? ` as ${role === 'owner' ? 'an owner' : `a ${role}`}` : ''}.
        </Text>
        <Text style={text}>
          Click the button below to create your account and get started.
        </Text>
        {signupUrl && (
          <Button style={button} href={signupUrl}>
            Accept Invitation
          </Button>
        )}
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TenantInvitationEmail,
  subject: (data: Record<string, any>) =>
    `You've been invited to join ${data.churchName || 'a church'} on ${SITE_NAME}`,
  displayName: 'Tenant invitation',
  previewData: {
    churchName: 'Grace Community Church',
    signupUrl: 'https://app.churchmanagementsuite.org/t/grace/auth',
    role: 'member',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(215, 45%, 15%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(215, 15%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const button = {
  backgroundColor: 'hsl(215, 53%, 24%)',
  color: 'hsl(40, 33%, 98%)',
  borderRadius: '0.75rem',
  fontSize: '15px',
  fontWeight: '600' as const,
  padding: '12px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  margin: '8px 0 24px',
}
const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '30px 0 0',
}
