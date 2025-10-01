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
  Button,
  Link,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeDiscountEmailProps {
  name: string;
  discountCode: string;
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

const anchor = {
  color: '#214392',
};

const button = {
  backgroundColor: '#214392',
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

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};

const heading = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  marginBottom: '20px',
  color: '#333'
}

const discountCodeStyle = {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#e8eaf6',
    border: '1px dashed #3f51b5',
    borderRadius: '5px',
    color: '#3f51b5',
    fontSize: '18px',
    fontWeight: 'bold' as const,
    letterSpacing: '2px',
    margin: '20px 0',
}

export const WelcomeDiscountEmail = ({ name, discountCode }: WelcomeDiscountEmailProps) => {
    const previewText = `Your Free Compliance Assessment & Discount Code`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Welcome to My Accountant!</Heading>
                <Text style={paragraph}>
                    Hi {name},
                </Text>
                <Text style={paragraph}>
                    Thank you for signing up! We've received your request for a free SARS & CIPC compliance assessment. One of our consultants will be in touch with you shortly with your results.
                </Text>
                <Text style={paragraph}>
                    As a thank you, here is your 5% discount code for your next service order:
                </Text>

                <div style={{ textAlign: 'center' }}>
                    <span style={discountCodeStyle}>{discountCode}</span>
                </div>

                <Text style={paragraph}>
                    You can use this code at checkout to claim your discount.
                </Text>
                 <Button style={button} href="https://my-accountant-app-961d6.web.app/services">
                    Browse Our Services
                </Button>
                <Hr style={hr} />
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
                <Text style={footer}>
                © {new Date().getFullYear()} My Accountant. All rights reserved.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default WelcomeDiscountEmail;
