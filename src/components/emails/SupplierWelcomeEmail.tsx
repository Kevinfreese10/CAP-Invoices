import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Button,
} from '@react-email/components';
import * as React from 'react';

interface SupplierWelcomeEmailProps {
  contactPerson: string;
  companyName: string;
  loginUrl: string;
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const box = {
  padding: '0 48px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
};

const heading = {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    marginBottom: '20px',
}

const button = {
  backgroundColor: '#1877F2',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
};

export const SupplierWelcomeEmail = ({ contactPerson, companyName, loginUrl }: SupplierWelcomeEmailProps) => {
  const previewText = `Welcome to the CAP Payments Portal`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Heading style={heading}>Welcome aboard, {contactPerson}!</Heading>
            <Text style={paragraph}>
              Your supplier account for <strong>{companyName}</strong> has been created successfully.
            </Text>
            <Text style={paragraph}>
              You can now log in to your dashboard to submit invoices and track their payment status.
            </Text>
            <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '32px' }}>
                <Button style={button} href={loginUrl}>
                    Go to Your Supplier Dashboard
                </Button>
            </Section>
            <Text style={{ ...paragraph, fontSize: '14px' }}>
              If you have any questions, please contact us.
            </Text>
            <Hr style={hr} />
            <Text style={{ ...paragraph, fontSize: '12px', color: '#8898aa' }}>
              The CAP Payments Portal Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SupplierWelcomeEmail;
