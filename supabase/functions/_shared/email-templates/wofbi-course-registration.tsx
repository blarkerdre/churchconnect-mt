/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface WoFBICourseRegistrationEmailProps {
  firstName?: string
  courseName?: string
  siteUrl?: string
}

export const WoFBICourseRegistrationEmail: React.FC<WoFBICourseRegistrationEmailProps> = ({
  firstName = 'Friend',
  courseName = 'Bible School Course',
  siteUrl = 'https://churchmanagementsuite.org',
}) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={headerText}>Winners Chapel International Cardiff</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={heading}>Course Registration Confirmed!</Text>

            <Text style={paragraph}>
              Dear {firstName},
            </Text>

            <Text style={paragraph}>
              You have been successfully registered for <strong>{courseName}</strong> at
              the Bible School.
            </Text>

            <Text style={paragraph}>
              Please keep an eye on announcements for class schedules, materials, and
              any updates regarding your course. We encourage you to attend all sessions
              to make the most of this training.
            </Text>

            <Text style={paragraph}>
              You can view your course details and track your progress on your dashboard:
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={`${siteUrl}/auth`}>
                Visit Dashboard
              </Button>
            </Section>

            <Text style={paragraph}>
              If you have any questions about the course, please reach out to us.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerText}>
              Winners Chapel International Cardiff — Word of Faith Bible Institute
            </Text>
            <Text style={footerText}>
              This email was sent because you registered for a WoFBI course.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WoFBICourseRegistrationEmail

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: "'Georgia', 'Times New Roman', serif",
}

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const headerSection: React.CSSProperties = {
  padding: '24px 32px',
  backgroundColor: '#1a2d4d',
  borderRadius: '8px 8px 0 0',
  textAlign: 'center' as const,
}

const headerText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
  fontFamily: "'Georgia', 'Times New Roman', serif",
}

const contentSection: React.CSSProperties = {
  padding: '32px',
  backgroundColor: '#f8f9fa',
}

const heading: React.CSSProperties = {
  color: '#1a2d4d',
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 20px',
  fontFamily: "'Georgia', 'Times New Roman', serif",
}

const paragraph: React.CSSProperties = {
  color: '#4a5568',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const buttonContainer: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button: React.CSSProperties = {
  backgroundColor: '#1a2d4d',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '0',
}

const footerSection: React.CSSProperties = {
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const footerText: React.CSSProperties = {
  color: '#a0aec0',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}
