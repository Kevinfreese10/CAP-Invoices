
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
} from '@react-email/components';
import * as React from 'react';
import { ExtractedInvoice } from '@/lib/types';

interface InvoiceRejectionEmailProps {
  invoice: ExtractedInvoice;
  reason: string;
  rejectedBy: string;
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
  color: '#c00'
}

const detailSection = {
    border: '1px solid #e6ebf1',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#fafafa',
}

export const InvoiceRejectionEmail = ({ invoice, reason, rejectedBy }: InvoiceRejectionEmailProps) => {
    const previewText = `Invoice Rejected: ${invoice.supplier} - #${invoice.invoiceNumber}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Invoice Rejected</Heading>
                <Text style={paragraph}>
                    Hi {rejectedBy},
                </Text>
                <Text style={paragraph}>
                    This email confirms that you have rejected the following invoice.
                </Text>
                
                <Section style={detailSection}>
                    <Row style={{ marginBottom: '16px' }}>
                        <Column>
                            <Text style={{...paragraph, fontWeight: 'bold', margin: '0 0 4px 0' }}>Supplier:</Text>
                            <Text style={paragraph}>{invoice.supplier}</Text>
                        </Column>
                         <Column>
                            <Text style={{...paragraph, fontWeight: 'bold', margin: '0 0 4px 0' }}>Invoice #:</Text>
                            <Text style={paragraph}>{invoice.invoiceNumber}</Text>
                        </Column>
                    </Row>
                     <Row>
                        <Column>
                            <Text style={{...paragraph, fontWeight: 'bold', margin: '0 0 4px 0' }}>Date:</Text>
                            <Text style={paragraph}>{invoice.date}</Text>
                        </Column>
                         <Column>
                            <Text style={{...paragraph, fontWeight: 'bold', margin: '0 0 4px 0' }}>Total:</Text>
                            <Text style={paragraph}>{formatPrice(invoice.invoiceTotal)}</Text>
                        </Column>
                    </Row>
                     <Hr style={hr} />
                     <Text style={{...paragraph, fontWeight: 'bold'}}>Reason for Rejection:</Text>
                     <Text style={{...paragraph, borderLeft: '3px solid #c00', paddingLeft: '10px', fontStyle: 'italic'}}>{reason}</Text>
                </Section>
                
                <Hr style={hr} />
                
                <Text style={{...paragraph, fontSize: '12px', color: '#8898aa'}}>
                    This is an automated notification for your records.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default InvoiceRejectionEmail;
