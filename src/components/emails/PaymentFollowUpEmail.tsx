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

interface PaymentFollowUpEmailProps {
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

export const PaymentFollowUpEmail = ({ order, reseller }: PaymentFollowUpEmailProps) => {
    const previewText = `Payment Reminder for Order #${order.id}`;

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
                <Heading style={heading}>Payment Reminder for Your Order</Heading>
                <Text style={paragraph}>
                    Hi {order.customerName},
                </Text>
                <Text style={paragraph}>
                    This is a friendly reminder that your order <strong style={{color: '#214392'}}>{order.id}</strong> is still awaiting payment.
                </Text>
                <Text style={paragraph}>
                    To proceed with your services, please make the payment at your earliest convenience. You can find the payment instructions in your original order confirmation email.
                </Text>
                 <Text style={paragraph}>
                    If you have already made the payment, please disregard this email. It may take some time for the payment to reflect on our side.
                </Text>
                <Hr style={hr} />
                <Text style={paragraph}>
                    If you have any questions, please don't hesitate to contact us.
                </Text>

                <Text style={paragraph}>
                    Regards,
                    <br />
                    The {companyName} Team
                </Text>
                
                <Text style={footer}>
                     {companyName} | <a href={`mailto:${companyEmail}`} style={anchor}>{companyEmail}</a> | {companyAddress}
                </Text>
                <Text style={footer}>
                © {new Date().getFullYear()} {companyName}. All rights reserved.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default PaymentFollowUpEmail;
