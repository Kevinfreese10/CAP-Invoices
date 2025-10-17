
'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote, Task } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';
import MissingStatementRequestEmail from '@/components/emails/MissingStatementRequestEmail';

const db = getFirestore(firebaseApp);


export async function requestMissingStatements({ clientName, clientEmail, missingPeriods }: { clientName: string, clientEmail: string, missingPeriods: string[] }) {
    const emailHtml = render(<MissingStatementRequestEmail clientName={clientName} missingPeriods={missingPeriods}></MissingStatementRequestEmail>);
    
    await sendEmail({
        to: clientEmail,
        subject: 'Action Required: Missing Bank Statements',
        html: emailHtml,
    });
}

