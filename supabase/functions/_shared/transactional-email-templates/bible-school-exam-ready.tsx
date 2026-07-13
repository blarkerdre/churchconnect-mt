import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ChurchConnect"

interface CourseInfo { name: string; student_number?: string | null }
interface Props {
  firstName?: string
  courseName?: string
  magicLink?: string
  tenantName?: string
  courses?: CourseInfo[]
}

const BibleSchoolExamReadyEmail = ({ firstName, courseName, magicLink, tenantName, courses }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Bible School exam is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {firstName ? `Hi ${firstName},` : 'Hello,'}
        </Heading>
        <Text style={text}>
          Your application for <strong>{courseName || 'Bible School'}</strong> at{' '}
          {tenantName || SITE_NAME} has been approved. You can now write your exam.
        </Text>
        {courses && courses.some((c) => c.student_number) && (
          <Section style={numberBox}>
            <Text style={numberLabel}>Your student number{courses.filter((c) => c.student_number).length > 1 ? 's' : ''}</Text>
            {courses.filter((c) => c.student_number).map((c) => (
              <Text key={c.name} style={numberValue}>
                {c.name}: <strong>{c.student_number}</strong>
              </Text>
            ))}
            <Text style={hint}>
              Please keep this safe — you'll need it for your exam and certificate.
            </Text>
          </Section>
        )}
        <Text style={text}>
          Click the button below to securely sign in and start your exam.
          No password is needed — this link signs you in automatically.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={magicLink} style={button}>
            Start my exam
          </Button>
        </Section>
        <Text style={hint}>
          This link is single-use and expires shortly. If it stops working,
          please ask your church admin to resend it.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Blessings,{'\n'}The {tenantName || SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BibleSchoolExamReadyEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data?.courseName || 'Bible School'} exam is ready`,
  displayName: 'Bible School — exam ready',
  previewData: {
    firstName: 'Jane',
    courseName: 'Bible Foundation Course',
    magicLink: 'https://app.example.com/auth/exam-callback?token=demo',
    tenantName: 'Winners Chapel Cardiff',
    courses: [{ name: 'Bible Foundation Course', student_number: 'WCC/BFC/2026/0001' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a2d4d', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 16px' }
const hint = { fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 12px' }
const button = {
  backgroundColor: '#1a2d4d',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0', whiteSpace: 'pre-line' as const }
const numberBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', margin: '20px 0' }
const numberLabel = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', margin: '0 0 8px', fontWeight: 'bold' as const }
const numberValue = { fontSize: '15px', color: '#1a2d4d', margin: '0 0 4px', fontFamily: "'Courier New', monospace" }
