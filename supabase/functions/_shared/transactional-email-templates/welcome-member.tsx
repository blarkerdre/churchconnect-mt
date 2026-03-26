import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface WelcomeMemberProps {
  name?: string
  churchName?: string
}

const WelcomeMemberEmail = ({ name, churchName }: WelcomeMemberProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {churchName || SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Welcome, ${name}!` : 'Welcome!'}
        </Heading>
        <Text style={text}>
          Thank you for joining {churchName || SITE_NAME}. We're excited to have you as part of our community.
        </Text>
        <Text style={text}>
          You can now access your member profile, check upcoming events, and stay connected with your church family.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Best regards,{'\n'}The {churchName || SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeMemberEmail,
  subject: (data: Record<string, any>) =>
    `Welcome to ${data?.churchName || SITE_NAME}`,
  displayName: 'Welcome member',
  previewData: { name: 'Jane Doe', churchName: 'Winners Chapel' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a2d4d', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 20px' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0', whiteSpace: 'pre-line' as const }
