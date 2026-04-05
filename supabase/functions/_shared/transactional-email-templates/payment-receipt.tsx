import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "churchconnect-mt"

interface PaymentReceiptProps {
  churchName?: string
  amount?: string
  currency?: string
  paymentDate?: string
  paymentMethod?: string
  reference?: string
  billingCycle?: string
  nextDueDate?: string
  settingsUrl?: string
}

const PaymentReceiptEmail = ({
  churchName = 'Your Church',
  amount = '0.00',
  currency = 'GBP',
  paymentDate = new Date().toISOString().split('T')[0],
  paymentMethod = 'Stripe',
  reference = '—',
  billingCycle = 'monthly',
  nextDueDate,
  settingsUrl = 'https://churchconnect-mt.lovable.app/settings',
}: PaymentReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment receipt for {churchName} — {currency} {amount}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>Payment Receipt</Heading>
        </Section>

        <Text style={text}>
          Thank you! We've received your subscription payment for <strong>{churchName}</strong>.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Amount:</strong> {currency} {amount}</Text>
          <Text style={detailRow}><strong>Date:</strong> {paymentDate}</Text>
          <Text style={detailRow}><strong>Method:</strong> {paymentMethod}</Text>
          <Text style={detailRow}><strong>Billing Cycle:</strong> {billingCycle}</Text>
          <Text style={detailRow}><strong>Reference:</strong> {reference}</Text>
          {nextDueDate && (
            <Text style={detailRow}><strong>Next Due Date:</strong> {nextDueDate}</Text>
          )}
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={settingsUrl}>
            Manage Subscription
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated payment receipt from {SITE_NAME}. If you have questions about this charge, please contact your church administrator.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Payment Receipt — ${data.currency || 'GBP'} ${data.amount || '0.00'} for ${data.churchName || 'your subscription'}`,
  displayName: 'Payment receipt',
  previewData: {
    churchName: 'Grace Community Church',
    amount: '50.00',
    currency: 'GBP',
    paymentDate: '2026-04-05',
    paymentMethod: 'Stripe',
    reference: 'in_1234567890',
    billingCycle: 'monthly',
    nextDueDate: '2026-05-05',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = {
  backgroundColor: '#1e3a5f',
  borderRadius: '8px 8px 0 0',
  padding: '24px 20px',
  textAlign: 'center' as const,
  margin: '0 -25px 20px',
}
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#faf6f0', margin: '0' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = {
  backgroundColor: '#faf6f0',
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid #e8e0d4',
}
const detailRow = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '4px 0' }
const button = {
  backgroundColor: '#1e3a5f',
  color: '#faf6f0',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
}
const hr = { borderColor: '#e8e0d4', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.4', margin: '0' }
