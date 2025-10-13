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
} from '@react-email/components';
import * as React from 'react';
import { Order, User } from '@/lib/types';

interface OrderConfirmationEmailProps {
  order: Order;
  reseller?: User;
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

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
  color: '#333',
  textAlign: 'left' as const,
}

const paymentInstructionSection = {
    border: '1px solid #e6ebf1',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#fafafa',
}

const paymentRow = {
    marginBottom: '10px'
}

const paymentLabel = {
    fontSize: '14px',
    color: '#525f7f',
    width: '150px'
}

const paymentValue = {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#333'
}

const referenceValue = {
    ...paymentValue,
    color: '#c00',
    backgroundColor: '#fff0f0',
    padding: '4px 8px',
    borderRadius: '4px',
}

export const OrderConfirmationEmail = ({ order, reseller }: OrderConfirmationEmailProps) => {
    const previewText = `Order Confirmation #${order.id}`;

    const bankingDetails = reseller?.bankingDetails || {
        bankName: 'FNB',
        accountHolder: 'My Accountant (Pty) Ltd',
        accountNumber: '63084378223',
        branchCode: '250655',
    };

    const companyName = reseller?.companyName || 'My Accountant';
    const companyEmail = reseller?.email || 'info@myacc.co.za';
    const companyAddress = reseller?.address ? `${reseller.address.street}, ${reseller.address.city}` : '369 Oak Avenue, Ferndale, Randburg';
    
    // In a real app this would be an environment variable
    const siteUrl = 'https://my-accountant-app.com';

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Thank You For Your Order!</Heading>
                <Text style={paragraph}>
                    Hi {order.customerName},
                </Text>
                <Text style={paragraph}>
                    Thank you for your order with {companyName}. Your order <strong style={{color: '#214392'}}>{order.id}</strong> has been successfully placed and is now pending payment.
                </Text>
                <Hr style={hr} />
                <Text style={paragraph}>
                    <strong>Order Summary:</strong>
                </Text>
                {order.items.map((item: any) => (
                    <Row key={item.id}>
                        <Column><Text style={paragraph}>{item.title} (x{item.quantity})</Text></Column>
                        <Column align="right"><Text style={paragraph}>{formatPrice(item.clientPrice || item.price)}</Text></Column>
                    </Row>
                ))}
                <Hr style={hr} />
                <Row>
                    <Column><Text style={{...paragraph, fontWeight: 'bold'}}>Total</Text></Column>
                    <Column align="right"><Text style={{...paragraph, fontWeight: 'bold'}}>{formatPrice(order.clientTotal || order.total)}</Text></Column>
                </Row>
                <Hr style={hr} />
                
                <Heading style={{...heading, fontSize: '20px', marginTop: '30px'}}>Payment Instructions</Heading>
                <Text style={paragraph}>
                    Please make a manual EFT payment using the details below to finalize your order. Your order will be processed once payment is confirmed.
                </Text>

                <Section style={paymentInstructionSection}>
                    <Row style={paymentRow}>
                        <Column style={paymentLabel}>Bank Name:</Column>
                        <Column style={paymentValue}>{bankingDetails.bankName}</Column>
                    </Row>
                     <Row style={paymentRow}>
                        <Column style={paymentLabel}>Account Holder:</Column>
                        <Column style={paymentValue}>{bankingDetails.accountHolder}</Column>
                    </Row>
                     <Row style={paymentRow}>
                        <Column style={paymentLabel}>Account Number:</Column>
                        <Column style={paymentValue}>{bankingDetails.accountNumber}</Column>
                    </Row>
                     <Row style={paymentRow}>
                        <Column style={paymentLabel}>Branch Code:</Column>
                        <Column style={paymentValue}>{bankingDetails.branchCode}</Column>
                    </Row>
                    <Row style={paymentRow}>
                        <Column style={paymentLabel}>Reference:</Column>
                        <Column style={referenceValue}>{order.id}</Column>
                    </Row>
                </Section>
                
                <Text style={{...paragraph, fontSize: '14px', marginTop: '20px'}}>
                    By making payment, you accept our <Link href={`${siteUrl}/refund-policy`} style={anchor}>Refund Policy</Link>.
                </Text>
                
                <Hr style={hr} />

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

export default OrderConfirmationEmail;
