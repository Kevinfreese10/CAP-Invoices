
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

interface MissingStatementRequestEmailProps {
  clientName: string;
  missingPeriods: string[];
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

const heading = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  marginBottom: '20px',
  color: '#333'
}

const list = {
    listStyleType: 'disc',
    paddingLeft: '20px',
    margin: '10px 0',
}

const listItem = {
    color: '#525f7f',
    fontSize: '14px',
    lineHeight: '22px',
}

export const MissingStatementRequestEmail = ({ clientName, missingPeriods }: MissingStatementRequestEmailProps) => {
    const previewText = `Action Required: Missing Bank Statements`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Missing Bank Statements</Heading>
                <Text style={paragraph}>
                    Hi {clientName},
                </Text>
                <Text style={paragraph}>
                    We are busy processing your books and have noticed that we are missing bank statements for the following periods:
                </Text>
                
                <ul style={list}>
                    {missingPeriods.map((period, index) => (
                        <li key={index} style={listItem}>{period}</li>
                    ))}
                </ul>
                
                <Text style={paragraph}>
                    Please send these statements through to us at your earliest convenience so we can complete your work accurately.
                </Text>
                
                <Text style={paragraph}>
                    If you have any questions, please reply directly to this email.
                </Text>
                
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

export default MissingStatementRequestEmail;
