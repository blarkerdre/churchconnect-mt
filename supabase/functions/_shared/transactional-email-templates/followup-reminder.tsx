/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface FollowupReminderProps {
  recipientName?: string
  churchName?: string
  message?: string
  followupType?: string
}

const FollowupReminderEmail = ({ recipientName, churchName, message, followupType }: FollowupReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{followupType ? `${followupType} Follow-up` : 'Follow-up'} from {churchName || SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {recipientName ? `Hi ${recipientName},` : 'Hello,'}
        </Heading>
        {message ? (
          <Text style={text}>{message}</Text>
        ) : (
          <Text style={text}>
            We wanted to reach out and connect with you. We hope to see you again soon!
          </Text>
        )}
        <Hr style={hr} />
        <Text style={footer}>
          Warm regards,{'\n'}The {churchName || SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FollowupReminderEmail,
  subject: (data: Record<string, any>) =>
    data?.followupType
      ? `${data.followupType} Follow-up — ${data?.churchName || SITE_NAME}`
      : `Follow-up from ${data?.churchName || SITE_NAME}`,
  displayName: 'Follow-up reminder',
  previewData: {
    recipientName: 'Jane Doe',
    churchName: 'Winners Chapel',
    message: 'Thank you for visiting us! We would love to see you again this Sunday.',
    followupType: 'First Timer',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a2d4d', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 20px' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0', whiteSpace: 'pre-line' as const }
