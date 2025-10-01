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

interface NewTaskEmailProps {
  assigneeName: string;
  taskTitle: string;
  taskDescription: string;
  dueDate: string;
  assignedBy: string;
  taskUrl: string;
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

const taskDetailSection = {
    border: '1px solid #e6ebf1',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#fafafa',
}

const taskDetailItem = {
    marginBottom: '10px'
}

export const NewTaskEmail = ({ assigneeName, taskTitle, taskDescription, dueDate, assignedBy, taskUrl }: NewTaskEmailProps) => {
    const previewText = `New Task Assigned: ${taskTitle}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>You Have a New Task</Heading>
                <Text style={paragraph}>
                    Hi {assigneeName},
                </Text>
                <Text style={paragraph}>
                    A new task has been assigned to you by <strong>{assignedBy}</strong>. Please see the details below and mark it as 'In Progress' when you begin.
                </Text>
                
                <Section style={taskDetailSection}>
                    <div style={taskDetailItem}>
                        <Text style={{ ...paragraph, margin: 0, fontWeight: 'bold' }}>Title:</Text>
                        <Text style={{ ...paragraph, margin: 0 }}>{taskTitle}</Text>
                    </div>
                     <div style={taskDetailItem}>
                        <Text style={{ ...paragraph, margin: 0, fontWeight: 'bold' }}>Description:</Text>
                        <Text style={{ ...paragraph, margin: 0 }}>{taskDescription}</Text>
                    </div>
                     <div style={taskDetailItem}>
                        <Text style={{ ...paragraph, margin: 0, fontWeight: 'bold' }}>Due Date:</Text>
                        <Text style={{ ...paragraph, margin: 0 }}>{dueDate}</Text>
                    </div>
                </Section>
                
                <Button style={{ ...button, marginTop: '30px' }} href={taskUrl}>
                    View Task on Dashboard
                </Button>

                <Hr style={hr} />
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
                <Text style={footer}>
                    This is an automated notification. Please do not reply directly to this email.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default NewTaskEmail;
