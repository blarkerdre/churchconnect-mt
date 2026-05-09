import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ChurchConnect'

interface BirthdayProps {
  firstName?: string
  lastName?: string
  churchName?: string
  subject?: string
  body?: string
}

function applyVars(text: string, data: BirthdayProps): string {
  const ctx: Record<string, string> = {
    first_name: data.firstName || 'Friend',
    last_name: data.lastName || '',
    church_name: data.churchName || SITE_NAME,
  }
  return text.replace(/\{(first_name|last_name|church_name)\}/g, (_m, k) => ctx[k])
}

const BirthdayEmail = (props: BirthdayProps) => {
  const churchName = props.churchName || SITE_NAME
  const greetingBody = props.body
    ? applyVars(props.body, props)
    : `Dear ${props.firstName || 'Friend'},\n\nHappy Birthday! The ${churchName} family is celebrating you today. May this year be filled with joy, peace, and God's abundant blessings.\n\nWith love,\nThe ${churchName} Family`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Happy Birthday from ${churchName}!`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={hero}>
            <Heading style={cake}>🎂</Heading>
            <Heading style={h1}>
              Happy Birthday{props.firstName ? `, ${props.firstName}` : ''}!
            </Heading>
          </Section>
          {greetingBody.split('\n').map((line, i) => (
            <Text key={i} style={text}>{line || '\u00A0'}</Text>
          ))}
          <Hr style={hr} />
          <Text style={footer}>{`With love, ${churchName}`}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BirthdayEmail,
  subject: (data: Record<string, any>) => {
    const subj = (data?.subject as string) || 'Happy Birthday, {first_name}!'
    return applyVars(subj, data || {})
  },
  displayName: 'Birthday greeting',
  previewData: { firstName: 'Jane', lastName: 'Doe', churchName: 'Winners Chapel International Cardiff' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const hero = { textAlign: 'center' as const, padding: '24px 0 8px' }
const cake = { fontSize: '48px', margin: '0 0 8px', lineHeight: '1' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a2d4d', margin: '0 0 24px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 12px' }
const hr = { borderColor: '#c5a028', margin: '28px 0', borderWidth: '1px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0', textAlign: 'center' as const }
