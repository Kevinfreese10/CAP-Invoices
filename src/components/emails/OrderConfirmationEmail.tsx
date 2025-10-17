
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
  isNewUser?: boolean;
  generatedPassword?: string | null;
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
  fontWeight: 'bold' as const,
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
  textAlign: 'left' as const,
  color: '#333',
}

const paymentInstructionSection = {
    border: '1px solid #e6ebf1',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#fafafa',
}

const detailItem = {
    marginBottom: '12px',
};

const detailLabel = {
    fontSize: '14px',
    color: '#525f7f',
    margin: '0 0 4px 0',
};

const detailValue = {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#333',
    margin: 0,
};

const referenceValue = {
    ...detailValue,
    display: 'inline-block',
    color: '#c00',
    backgroundColor: '#fff0f0',
    padding: '4px 8px',
    borderRadius: '4px',
}

export const OrderConfirmationEmail = ({ order, reseller, isNewUser, generatedPassword }: OrderConfirmationEmailProps) => {
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
    
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za';

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
                
                {isNewUser && generatedPassword && (
                    <>
                        <Heading style={{...heading, fontSize: '20px', marginTop: '30px'}}>Your New Client Portal Account</Heading>
                        <Text style={paragraph}>
                            An account has been created for you. You can use these details to log in and upload the documents required for your order.
                        </Text>
                        <Section style={paymentInstructionSection}>
                            <div style={detailItem}>
                                <p style={detailLabel}>Login Email:</p>
                                <p style={detailValue}>{order.customerEmail}</p>
                            </div>
                            <div style={detailItem}>
                                <p style={detailLabel}>Your Password:</p>
                                <p style={{...referenceValue, display: 'inline-block'}}>{generatedPassword}</p>
                            </div>
                        </Section>
                        <Text style={{ ...paragraph, textAlign: 'center', margin: '20px 0' }}>
                            <Link href={`${siteUrl}/login`} style={button}>Login to Your Account</Link>
                        </Text>
                        <Hr style={hr} />
                    </>
                )}
                
                <Heading style={{...heading, fontSize: '20px', marginTop: '30px'}}>Payment Instructions</Heading>
                <Text style={paragraph}>
                    Please make a manual EFT payment using the details below to finalize your order. Your order will be processed once payment is confirmed.
                </Text>

                <Section style={paymentInstructionSection}>
                    <div style={detailItem}>
                        <p style={detailLabel}>Bank Name:</p>
                        <p style={detailValue}>{bankingDetails.bankName}</p>
                    </div>
                     <div style={detailItem}>
                        <p style={detailLabel}>Account Holder:</p>
                        <p style={detailValue}>{bankingDetails.accountHolder}</p>
                    </div>
                     <div style={detailItem}>
                        <p style={detailLabel}>Account Number:</p>
                        <p style={detailValue}>{bankingDetails.accountNumber}</p>
                    </div>
                     <div style={detailItem}>
                        <p style={detailLabel}>Branch Code:</p>
                        <p style={detailValue}>{bankingDetails.branchCode}</p>
                    </div>
                    <div style={detailItem}>
                        <p style={detailLabel}>Reference:</p>
                        <p style={{...referenceValue, display: 'inline-block'}}>{order.id}</p>
                    </div>
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
