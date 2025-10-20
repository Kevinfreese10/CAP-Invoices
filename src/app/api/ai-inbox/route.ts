
// /src/app/api/ai-inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp, query, where, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';

const db = getFirestore(firebaseApp);

async function connectToImap() {
    const config = {
      imap: {
        user: 'kev@myacc.co.za',
        password: 'Thinkestry10$',
        host: 'mail.myacc.co.za',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false } 
      },
    };
    return await imaps.connect(config);
}


export async function GET() {
    let connection;
    try {
        // Step 1: Fetch existing email UIDs from Firestore
        const inboxEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('uid', 'desc')));
        const existingUids = new Set(inboxEmailsSnapshot.docs.map(doc => doc.data().uid));

        // Step 2: Connect to IMAP and get all email UIDs from server
        connection = await connectToImap();
        await connection.openBox('INBOX');
        const serverMessages = await connection.search(['ALL'], { bodies: [], headers: ['message-id'] });
        const serverUids = new Set(serverMessages.map(msg => msg.attributes.uid));
        
        // Step 3: Determine which emails are new
        const newUids = Array.from(serverUids).filter(uid => !existingUids.has(uid));
        
        // Step 4: Fetch only the new emails from the server
        if (newUids.length > 0) {
            const newMessages = await connection.search([['UID', newUids.join(',')]], { bodies: [''], markSeen: false });
            const batch = writeBatch(db);

            for (const item of newMessages) {
                const all = item.parts.find((part) => part.which === '');
                const mail = await simpleParser(all?.body || '');
                
                const emailData = {
                  uid: item.attributes.uid,
                  from: mail.from?.text || 'No Sender',
                  subject: mail.subject || 'No Subject',
                  date: mail.date?.toISOString() || new Date().toISOString(),
                  body: mail.html || mail.textAsHtml || '',
                  attachments: mail.attachments.map(att => ({
                      filename: att.filename,
                      contentType: att.contentType,
                      size: att.size,
                  })),
                  createdAt: serverTimestamp(),
                  processedAction: null,
                };
                
                const docRef = doc(db, 'inboxEmails', String(emailData.uid));
                batch.set(docRef, emailData);
            }
            await batch.commit();
        }

        // Step 5: Fetch all emails (new and old) from Firestore and combine with processed status
        const allEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('date', 'desc')));
        const allEmails = allEmailsSnapshot.docs.map(doc => doc.data());
        
        return NextResponse.json(allEmails);

    } catch (error: any) {
        console.error('AI Inbox API Error:', error);
        return NextResponse.json({ error: `Failed to sync with mail server: ${error.message}` }, { status: 500 });
    } finally {
        if(connection) connection.end();
    }
}

export async function POST(req: Request) {
    const { uids, action } = await req.json();
    if (!uids || !action) {
      return NextResponse.json({ error: 'Missing UIDs or action.' }, { status: 400 });
    }

    try {
        const batch = writeBatch(db);

        if (action === 'delete') {
            uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.delete(docRef);
            });
        } else { // process or archive
             uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.update(docRef, { processedAction: action });
            });
        }
        
        await batch.commit();

        return NextResponse.json({ message: 'Action completed successfully.' });
    } catch (error: any) {
        console.error('Error performing email action:', error);
        return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
    }
}
