import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  churchName?: string
  subject?: string
  body?: string
  senderName?: string
}

function applyVars(text: string, data: Props): string {
  const ctx: Record<string, string> = {
    first_name: data.recipientName || 'Friend',
    recipient_name: data.recipientName || 'Friend',
    church_name: data.churchName || 'our church',
    sender_name: data.senderName || '',
  }
  return text.replace(/\{(first_name|recipient_name|church_name|sender_name)\}/g, (_m, k) => ctx[k] || '')
}

const DirectMessageEmail = (props: Props) => {
  const churchName = props.churchName || 'Our Church'
  const body = props.body ? applyVars(props.body, props) : ''
  const heading = props.subject ? applyVars(props.subject, props) : `A message from ${churchName}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={hero}>
            <Heading style={h1}>{heading}</Heading>
          </Section>
          {body.split('\n').map((line, i) => (
            <Text key={i} style={text}>{line || '\u00A0'}</Text>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            {props.senderName ? `${props.senderName} — ${churchName}` : churchName}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DirectMessageEmail,
  subject: (data: Record<string, any>) => {
    const subj = (data?.subject as string) || 'A message from {church_name}'
    return applyVars(subj, data || {})
  },
  displayName: 'Admin direct message',
  previewData: {
    recipientName: 'Jane',
    churchName: 'Winners Chapel International Cardiff',
    subject: 'Checking in',
    body: 'Hi {first_name},\n\nJust reaching out to say hello.\n\nBlessings,\n{sender_name}',
    senderName: 'Pastor John',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const hero = { padding: '8px 0 16px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a2d4d', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 12px' }
const hr = { borderColor: '#c5a028', margin: '28px 0', borderWidth: '1px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0' }
