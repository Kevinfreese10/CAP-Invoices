
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
  Row,
  Column,
  Button,
} from '@react-email/components';
import * as React from 'react';
import { DocumentUpload } from '@/lib/types';

interface DocumentReviewEmailProps {
  clientName: string;
  orderId: string;
  documentUploads: DocumentUpload[];
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

const statusSection = {
    border: '1px solid #e6ebf1',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#fafafa',
}

const statusRow = {
    padding: '8px 0',
}

export const DocumentReviewEmail = ({ clientName, orderId, documentUploads, orderUrl }: DocumentReviewEmailProps) => {
    const previewText = `Feedback on Documents for Order #${orderId}`;
    
    const hasRejections = documentUploads.some(doc => doc.status === 'rejected');

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Document Review Complete</Heading>
                <Text style={paragraph}>
                    Hi {clientName},
                </Text>
                <Text style={paragraph}>
                    We have reviewed the documents you submitted for order <strong style={{color: '#214392'}}>{orderId}</strong>. Please see the status of each item below.
                </Text>
                
                <Section style={statusSection}>
                    {documentUploads.map((doc, index) => (
                         <div key={index} style={statusRow}>
                            <Row>
                                <Column>
                                    <Text style={{ ...paragraph, margin: 0, fontWeight: 'bold' }}>{doc.requirementLabel}</Text>
                                </Column>
                                <Column align="right">
                                    <Text style={{ ...paragraph, margin: 0, fontWeight: doc.status === 'approved' ? 'bold' : 'normal', color: doc.status === 'approved' ? '#4caf50' : '#f44336' }}>
                                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                    </Text>
                                </Column>
                            </Row>
                            {doc.status === 'rejected' && doc.rejectionReason && (
                                <Text style={{...paragraph, fontSize: '14px', fontStyle: 'italic', color: '#c00', marginTop: '4px'}}>
                                    <strong>Reason:</strong> {doc.rejectionReason}
                                </Text>
                            )}
                         </div>
                    ))}
                </Section>
                
                {hasRejections && (
                     <Text style={paragraph}>
                        Some documents require your attention. Please log in to your dashboard to upload the corrected documents.
                    </Text>
                )}
                
                <Button style={button} href={orderUrl}>
                    View Order Details
                </Button>

                <Hr style={hr} />
                
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default DocumentReviewEmail;
