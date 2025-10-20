
// /src/app/api/ai-inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs, query, where, doc, setDoc, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

export async function GET() {
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

  try {
    // 1. Get UIDs of emails already stored in Firestore
    const storedEmailsSnapshot = await getDocs(collection(db, 'inboxEmails'));
    const storedUids = new Set(storedEmailsSnapshot.docs.map(doc => doc.data().uid));

    // 2. Connect to IMAP and fetch UIDs of all emails on the server
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    const serverMessages = await connection.search(['ALL'], { bodies: ['HEADER'], markSeen: false });
    const serverUids = new Set(serverMessages.map(m => m.attributes.uid));
    
    // 3. Determine which emails are new
    const newUids = Array.from(serverUids).filter(uid => !storedUids.has(uid));
    
    // 4. Fetch and store new emails
    if (newUids.length > 0) {
        const fetchOptions = { bodies: [''], markSeen: false };
        const newMessages = await connection.search([['UID', newUids.join(',')]], fetchOptions);

        for (const item of newMessages) {
            const all = item.parts.find((part) => part.which === '');
            const id = item.attributes.uid;
            const idHeader = 'Imap-Id: ' + id + '\r\n';
            const mail = await simpleParser(idHeader + all?.body);
            
            const attachments = mail.attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                dataUrl: `data:${att.contentType};base64,${att.content.toString('base64')}`,
                size: att.size,
            }));

            const emailData = {
              uid: id,
              from: mail.from?.text || 'No Sender',
              to: mail.to?.text || '',
              subject: mail.subject || 'No Subject',
              date: mail.date?.toISOString() || new Date().toISOString(),
              body: mail.html || mail.textAsHtml || 'No content',
              attachments: attachments,
            };
            
            // Save the new email to Firestore using its UID as the document ID
            await setDoc(doc(db, 'inboxEmails', String(id)), emailData);
        }
    }
    
    connection.end();
    
    // 5. Fetch all emails from Firestore and check their processed status
    const allStoredEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('date', 'desc')));
    const allStoredEmails = allStoredEmailsSnapshot.docs.map(doc => ({ uid: doc.data().uid, ...doc.data() }));

    const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
    const processedEmailsMap = new Map();
    processedSnapshot.forEach(doc => {
        const data = doc.data();
        processedEmailsMap.set(data.uid, {
            processedAt: data.processedAt,
            processedBy: data.processedBy,
            processedAction: data.processedAction,
        });
    });

    const emailsWithStatus = allStoredEmails.map(email => {
        const processedInfo = processedEmailsMap.get(email.uid);
        return {
            ...email,
            isProcessed: !!processedInfo,
            processedInfo: processedInfo || null,
        };
    });

    return NextResponse.json(emailsWithStatus);

  } catch (error: any) {
    console.error('IMAP/Firestore sync error for kev@myacc.co.za:', error);
    return NextResponse.json({ error: `Failed to sync emails: ${error.message}` }, { status: 500 });
  }
}
