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
  Row,
  Column,
  Link,
  Button,
} from '@react-email/components';
import * as React from 'react';
import { Order, Service, User } from '@/lib/types';

interface DocumentRequestEmailProps {
  order: Order;
  items: { service: Service }[];
  reseller?: User;
  replyTo: string;
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

const itemSection = {
    padding: '10px 0'
}

const itemTitle = {
    fontWeight: 'bold' as const,
    fontSize: '16px',
    color: '#333'
}

const prereqList = {
    listStyleType: 'disc',
    paddingLeft: '20px',
    margin: '10px 0',
}

const prereqItem = {
    color: '#525f7f',
    fontSize: '14px',
    lineHeight: '22px',
}

export const DocumentRequestEmail = ({ order, items, reseller, replyTo }: DocumentRequestEmailProps) => {
    const previewText = `Action Required for Order #${order.id}`;

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
                <Heading style={heading}>Action Required for Your Order</Heading>
                <Text style={paragraph}>
                    Hi {order.customerName},
                </Text>
                <Text style={paragraph}>
                    Your order <strong style={{color: '#214392'}}>{order.id}</strong> is now being processed. To continue, we need some information from you. Please reply to this email and attach the documents listed below. Any forms you need to fill out are attached to this email.
                </Text>
                
                <Hr style={hr} />

                {items.map(({ service }) => (
                    <Section key={service.id} style={itemSection}>
                        <Text style={itemTitle}>{service.title}</Text>
                        <Text style={paragraph}>We will need the following from you:</Text>
                        <ul style={prereqList}>
                            {service.clientRequirements.map((req, index) => (
                                <li key={index} style={prereqItem}>{req}</li>
                            ))}
                        </ul>
                    </Section>
                ))}
                
                <Hr style={hr} />
                
                <Text style={paragraph}>
                    If you have any questions, please reply directly to this email or contact us at <a href={`mailto:${replyTo}`} style={anchor}>{replyTo}</a>.
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

export default DocumentRequestEmail;
