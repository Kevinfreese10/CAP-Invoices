
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
} from '@react-email/components';
import * as React from 'react';
import { Order, User } from '@/lib/types';

interface PaymentConfirmationEmailProps {
  order: Order;
  reseller?: User;
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

export const PaymentConfirmationEmail = ({ order, reseller }: PaymentConfirmationEmailProps) => {
    const previewText = `Payment Received for Order #${order.id}`;

    const companyName = reseller?.companyName || 'My Accountant';
    const companyEmail = reseller?.email || 'info@myacc.co.za';
    const companyAddress = reseller?.address ? `${reseller.address.street}, ${reseller.address.city}` : '369 Oak Avenue, Ferndale, Randburg';

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Payment Received!</Heading>
                <Text style={paragraph}>
                    Hi {order.customerName},
                </Text>
                <Text style={paragraph}>
                    This is to confirm that we have received payment for your order <strong style={{color: '#214392'}}>{order.id}</strong>.
                </Text>
                <Text style={paragraph}>
                    Our team will begin processing your services shortly. If any documents or further information are required, a consultant will be in touch with you soon. You can also view the requirements for your order by logging into your dashboard.
                </Text>
                
                 <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${order.id}`}>
                    View Order in Dashboard
                </Button>

                <Hr style={hr} />
                
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The {companyName} Team
                </Text>
                
                <Text style={footer}>
                     {companyName} | <a href={`mailto:${companyEmail}`} style={anchor}>{companyEmail}</a> | {companyAddress}
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default PaymentConfirmationEmail;
