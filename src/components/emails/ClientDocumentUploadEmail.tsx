
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

interface ClientDocumentUploadEmailProps {
  assigneeName: string;
  clientName: string;
  orderId: string;
  orderUrl: string;
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

export const ClientDocumentUploadEmail = ({ assigneeName, clientName, orderId, orderUrl }: ClientDocumentUploadEmailProps) => {
    const previewText = `Documents Uploaded for Order #${orderId}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Documents Uploaded by Client</Heading>
                <Text style={paragraph}>
                    Hi {assigneeName},
                </Text>
                <Text style={paragraph}>
                    <strong>{clientName}</strong> has submitted their documents for order <strong style={{color: '#214392'}}>{orderId}</strong>.
                </Text>
                <Text style={paragraph}>
                    Please log into the admin portal to review the uploaded documents and continue processing the order.
                </Text>
                
                <Button style={button} href={orderUrl}>
                    View Order
                </Button>

                <Hr style={hr} />
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
                <Text style={footer}>
                    This is an automated notification.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default ClientDocumentUploadEmail;
