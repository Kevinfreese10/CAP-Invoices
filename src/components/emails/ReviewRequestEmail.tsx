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
import { Order } from '@/lib/types';

interface ReviewRequestEmailProps {
  order: Order;
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

export const ReviewRequestEmail = ({ order }: ReviewRequestEmailProps) => {
    const previewText = `We'd love your feedback on order #${order.id}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Thank You for Your Business!</Heading>
                <Text style={paragraph}>
                    Hi {order.customerName},
                </Text>
                <Text style={paragraph}>
                    Your order <strong style={{color: '#214392'}}>{order.id}</strong> has now been completed. We hope you had a positive experience with My Accountant.
                </Text>
                <Text style={paragraph}>
                    If you have a moment, we would greatly appreciate it if you could leave us a review on Google. Your feedback helps us improve and lets others know about our services.
                </Text>

                <Button style={button} href="https://g.page/r/CVIOzn2bYoiaEAI/review">
                    Leave a Review
                </Button>

                <Hr style={hr} />
                <Text style={paragraph}>
                    Thank you for choosing My Accountant. We look forward to working with you again in the future!
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

export default ReviewRequestEmail;
