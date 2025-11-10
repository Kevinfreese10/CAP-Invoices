
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
  reseller?: User | null; // Optional Reseller info
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
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

const heading = {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    marginBottom: '20px',
}

const anchor = {
  color: '#1877F2',
};

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

export const OrderConfirmationEmail = ({ order, reseller }: OrderConfirmationEmailProps) => {
  const isResellerOrder = !!reseller;
  const total = isResellerOrder ? order.clientTotal || order.total : order.total;
  
  const previewText = `Your Order #${order.id} Confirmation`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Heading style={heading}>Thank you for your order!</Heading>
            <Text style={paragraph}>
              Hi {order.customerName},
            </Text>
            <Text style={paragraph}>
              We've received your order #{order.id} and will begin processing it shortly. You can view your order details below.
            </Text>

            <Hr style={hr} />
            
            <Section>
                {order.items.map((item: any, index: number) => (
                    <Row key={index} style={{ marginBottom: '12px' }}>
                        <Column>
                            <Text style={{ ...paragraph, fontWeight: 'bold', margin: 0 }}>{item.title}</Text>
                            <Text style={{ ...paragraph, fontSize: '14px', color: '#8898aa', margin: 0 }}>Qty: {item.quantity}</Text>
                        </Column>
                        <Column style={{ textAlign: 'right' }}>
                            <Text style={{ ...paragraph, fontWeight: 'bold', margin: 0 }}>
                                {formatPrice(isResellerOrder ? item.clientPrice : item.price)}
                            </Text>
                        </Column>
                    </Row>
                ))}
            </Section>
            
             <Hr style={hr} />

             <Section>
                <Row>
                    <Column><Text style={{ ...paragraph, margin: 0 }}>Subtotal</Text></Column>
                    <Column style={{ textAlign: 'right' }}><Text style={{ ...paragraph, margin: 0 }}>{formatPrice(total)}</Text></Column>
                </Row>
                 <Row>
                    <Column><Text style={{ ...paragraph, margin: 0 }}>VAT (0%)</Text></Column>
                    <Column style={{ textAlign: 'right' }}><Text style={{ ...paragraph, margin: 0 }}>{formatPrice(0)}</Text></Column>
                </Row>
                <Hr style={{...hr, margin: '10px 0'}}/>
                 <Row>
                    <Column><Text style={{ ...paragraph, fontWeight: 'bold', margin: 0 }}>Total</Text></Column>
                    <Column style={{ textAlign: 'right' }}><Text style={{ ...paragraph, fontWeight: 'bold', margin: 0 }}>{formatPrice(total)}</Text></Column>
                </Row>
            </Section>

            <Hr style={hr} />

            <Section style={{ textAlign: 'center', marginTop: '32px' }}>
                <Link
                    style={button}
                    href={`${process.env.NEXT_PUBLIC_APP_URL}/order-confirmation/${order.id}`}
                >
                    View Order & Make Payment
                </Link>
            </Section>

            <Text style={{ ...paragraph, fontSize: '14px', marginTop: '32px' }}>
              If you have any questions, please contact us.
            </Text>

             {isResellerOrder && reseller && (
                <>
                    <Hr style={hr} />
                    <Text style={{ ...paragraph, fontSize: '12px', color: '#8898aa' }}>
                       Sold and fulfilled by {reseller.companyName || reseller.name}.
                    </Text>
                </>
             )}

          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default OrderConfirmationEmail;

    