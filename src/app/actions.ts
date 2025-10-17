
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
import ClientDocumentUploadEmail from '@/components/emails/ClientDocumentUploadEmail';

const db = getFirestore(firebaseApp);


export async function requestMissingStatements({ clientName, clientEmail, missingPeriods }: { clientName: string, clientEmail: string, missingPeriods: string[] }) {
    const emailHtml = render(MissingStatementRequestEmail({ clientName: clientName, missingPeriods: missingPeriods }));
    
    await sendEmail({
        to: clientEmail,
        subject: 'Action Required: Missing Bank Statements',
        html: emailHtml,
    });
}

export async function notifyStaffOfDocumentUpload({ orderId, clientName, assignedStaffName, assignedStaffEmail }: { orderId: string, clientName: string, assignedStaffName: string, assignedStaffEmail: string }) {
    const emailHtml = render(
        ClientDocumentUploadEmail({
            assigneeName: assignedStaffName,
            clientName: clientName,
            orderId: orderId,
            orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${orderId}`,
        })
    );

    await sendEmail({
        to: assignedStaffEmail,
        subject: `Documents Uploaded for Order #${orderId}`,
        html: emailHtml,
    });
}
