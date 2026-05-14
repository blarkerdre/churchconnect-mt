import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const ISSUER = {
  name: "DomiFort Solutions Limited",
  address: "Flat 9, 2 Oriana Court, Crunden Road, South Croydon, United Kingdom, CR2 6GZ",
  companyReg: "17169095",
  email: "info@domifortsolutions.com",
  website: "www.domifortsolutions.com",
  sortCode: "04-06-05",
  accountNumber: "31369676",
}

interface LineItem {
  description?: string
  quantity?: number
  unit_price?: number
  amount?: number
}

interface TenantInvoiceProps {
  documentType?: 'invoice' | 'receipt'
  invoiceNumber?: string
  churchName?: string
  billToName?: string
  billToEmail?: string
  billToAddress?: string
  issueDate?: string
  dueDate?: string
  currency?: string
  lineItems?: LineItem[]
  subtotal?: string
  taxAmount?: string
  total?: string
  notes?: string
  terms?: string
  payUrl?: string
  status?: string
}

const TenantInvoiceEmail = ({
  documentType = 'invoice',
  invoiceNumber = 'INV-0000-0000',
  churchName = 'Your Church',
  billToName = '',
  billToEmail = '',
  billToAddress = '',
  issueDate = new Date().toISOString().split('T')[0],
  dueDate,
  currency = 'GBP',
  lineItems = [],
  subtotal = '0.00',
  taxAmount = '0.00',
  total = '0.00',
  notes,
  terms,
  payUrl,
  status = 'sent',
}: TenantInvoiceProps) => {
  const isReceipt = documentType === 'receipt'
  const heading = isReceipt ? 'Receipt' : 'Invoice'
  const previewText = `${heading} ${invoiceNumber} — ${currency} ${total}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={h1}>{heading}</Heading>
            <Text style={headerSub}>{invoiceNumber}</Text>
          </Section>

          <Section style={metaRow}>
            <Text style={metaLabel}>Issued</Text>
            <Text style={metaValue}>{issueDate}</Text>
          </Section>
          {!isReceipt && dueDate && (
            <Section style={metaRow}>
              <Text style={metaLabel}>Due</Text>
              <Text style={metaValue}>{dueDate}</Text>
            </Section>
          )}
          {isReceipt && (
            <Section style={metaRow}>
              <Text style={metaLabel}>Status</Text>
              <Text style={{ ...metaValue, color: '#0a7d3b', fontWeight: 'bold' }}>PAID</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Section>
            <Text style={sectionLabel}>From</Text>
            <Text style={text}>
              <strong>{ISSUER.name}</strong>
              <br />{ISSUER.address}
              <br />Company Reg: {ISSUER.companyReg}
              <br />{ISSUER.email} · {ISSUER.website}
            </Text>
          </Section>

          <Section>
            <Text style={sectionLabel}>Bill To</Text>
            <Text style={text}>
              <strong>{billToName || churchName}</strong>
              {billToEmail ? <><br />{billToEmail}</> : null}
              {billToAddress ? <><br />{billToAddress}</> : null}
            </Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailHeader}>
              <strong>Description</strong>
              <span style={{ float: 'right' as const }}><strong>Amount</strong></span>
            </Text>
            {lineItems.length === 0 && (
              <Text style={detailRow}>No line items.</Text>
            )}
            {lineItems.map((item, idx) => (
              <Text key={idx} style={detailRow}>
                {item.description || '—'}
                {item.quantity && item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                <span style={{ float: 'right' as const }}>
                  {currency} {(Number(item.amount) || 0).toFixed(2)}
                </span>
              </Text>
            ))}
            <Hr style={hrLight} />
            <Text style={detailRow}>
              Subtotal
              <span style={{ float: 'right' as const }}>{currency} {subtotal}</span>
            </Text>
            {Number(taxAmount) > 0 && (
              <Text style={detailRow}>
                Tax
                <span style={{ float: 'right' as const }}>{currency} {taxAmount}</span>
              </Text>
            )}
            <Text style={totalRow}>
              <strong>Total</strong>
              <span style={{ float: 'right' as const }}><strong>{currency} {total}</strong></span>
            </Text>
          </Section>

          {!isReceipt && (
            <Section style={paymentBox}>
              <Text style={sectionLabel}>Payment Details</Text>
              <Text style={detailRow}><strong>Account Name:</strong> {ISSUER.name}</Text>
              <Text style={detailRow}><strong>Sort Code:</strong> {ISSUER.sortCode}</Text>
              <Text style={detailRow}><strong>Account Number:</strong> {ISSUER.accountNumber}</Text>
              <Text style={detailRow}><strong>Reference:</strong> {invoiceNumber}</Text>
            </Section>
          )}

          {!isReceipt && payUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
              <Button style={button} href={payUrl}>Pay Now</Button>
            </Section>
          )}

          {notes && (
            <Section>
              <Text style={sectionLabel}>Notes</Text>
              <Text style={text}>{notes}</Text>
            </Section>
          )}

          {terms && (
            <Section>
              <Text style={sectionLabel}>Terms</Text>
              <Text style={smallText}>{terms}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Issued by {ISSUER.name} · Company No. {ISSUER.companyReg} · {ISSUER.email} · {ISSUER.website}
            <br />For questions, please reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TenantInvoiceEmail,
  subject: (data: Record<string, any>) => {
    const docType = data.documentType === 'receipt' ? 'Receipt' : 'Invoice'
    return `${docType} ${data.invoiceNumber || ''} — ${data.currency || 'GBP'} ${data.total || '0.00'}`.trim()
  },
  displayName: 'Tenant invoice / receipt',
  previewData: {
    documentType: 'invoice',
    invoiceNumber: 'INV-2026-0007',
    churchName: 'Grace Community Church',
    billToName: 'Grace Community Church',
    billToEmail: 'admin@grace.example',
    billToAddress: '123 Faith Street, Cardiff, CF1 1AA',
    issueDate: '2026-04-19',
    dueDate: '2026-05-05',
    currency: 'GBP',
    lineItems: [
      { description: 'Monthly Subscription — May 2026', quantity: 1, unit_price: 50, amount: 50 },
      { description: 'Setup Fee', quantity: 1, unit_price: 5, amount: 5 },
    ],
    subtotal: '55.00',
    taxAmount: '0.00',
    total: '55.00',
    payUrl: 'https://churchconnect-mt.lovable.app/settings',
    notes: 'Thank you for your continued partnership.',
    terms: 'Payment due within 14 days.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const headerSection = {
  backgroundColor: '#1e3a5f',
  borderRadius: '8px 8px 0 0',
  padding: '24px 20px',
  textAlign: 'center' as const,
  margin: '0 -25px 20px',
}
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#faf6f0', margin: '0 0 4px' }
const headerSub = { fontSize: '13px', color: '#d4b86a', margin: '0', letterSpacing: '1px' }
const metaRow = { display: 'block', margin: '4px 0' }
const metaLabel = { display: 'inline-block', width: '80px', fontSize: '12px', color: '#999999', margin: '0' }
const metaValue = { display: 'inline-block', fontSize: '13px', color: '#333333', margin: '0' }
const sectionLabel = { fontSize: '11px', color: '#999999', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '16px 0 4px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '12px', color: '#666666', lineHeight: '1.5', margin: '0 0 16px' }
const detailsBox = {
  backgroundColor: '#faf6f0',
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid #e8e0d4',
  margin: '16px 0',
}
const detailHeader = { fontSize: '13px', color: '#333333', margin: '0 0 8px', borderBottom: '1px solid #e8e0d4', paddingBottom: '8px' }
const detailRow = { fontSize: '13px', color: '#333333', lineHeight: '1.6', margin: '6px 0' }
const totalRow = { fontSize: '15px', color: '#1e3a5f', margin: '12px 0 0', paddingTop: '8px', borderTop: '2px solid #1e3a5f' }
const button = {
  backgroundColor: '#1e3a5f',
  color: '#faf6f0',
  padding: '12px 32px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
}
const hr = { borderColor: '#e8e0d4', margin: '20px 0' }
const hrLight = { borderColor: '#e8e0d4', margin: '12px 0' }
const footer = { fontSize: '11px', color: '#999999', lineHeight: '1.4', margin: '0' }
