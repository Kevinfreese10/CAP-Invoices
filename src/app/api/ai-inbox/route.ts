import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp, query, where, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

// This regex matches any character that is not a standard printable ASCII character,
// newline, carriage return, or tab. This helps remove control characters that break JSON parsing.
const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitizes a string by removing non-printable control characters.
 * @param str The string to sanitize.
 * @returns A sanitized string, or an empty string if input is null/undefined.
 */
function sanitizeString(str: string | null | undefined): string {
    if (!str) {
        return '';
    }
    return str.replace(controlCharRegex, '');
}


async function connectToImap() {
    const config = {
      imap: {
        user: process.env.IMAP_USER || '',
        password: process.env.IMAP_PASSWORD || '',
        host: process.env.IMAP_HOST || '',
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false } 
      },
    };
    return await imaps.connect(config);
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const shouldSync = searchParams.get('sync') === 'true';

    let connection;
    try {
        if (shouldSync) {
            const inboxEmailsSnapshot = await getDocs(query(collection(db, 'inboxEmails'), orderBy('uid', 'desc')));
            const existingUids = new Set(inboxEmailsSnapshot.docs.map(doc => doc.data().uid));

            connection = await connectToImap();
            await connection.openBox('INBOX');
            
            const serverMessages = await connection.search(['ALL'], { bodies: [], headers: ['message-id'] });
            const serverUids = new Set(serverMessages.map(msg => msg.attributes.uid));
            
            const newUids = Array.from(serverUids).filter(uid => !existingUids.has(uid));
            
            if (newUids.length > 0) {
                const newMessages = await connection.search([['UID', newUids.join(',')]], { bodies: [''], markSeen: false });
                const batch = writeBatch(db);

                for (const item of newMessages) {
                    const all = item.parts.find((part) => part.which === '');
                    const mail = await simpleParser(all?.body || '');
                    
                    const attachments = await Promise.all(mail.attachments.map(async (att) => {
                      if (att.content) {
                          const dataUrl = `data:${sanitizeString(att.contentType)};base64,${att.content.toString('base64')}`;
                          return {
                            filename: sanitizeString(att.filename),
                            contentType: sanitizeString(att.contentType),
                            dataUrl: dataUrl,
                            size: att.size || null,
                          };
                      }
                      return {
                          filename: sanitizeString(att.filename),
                          contentType: sanitizeString(att.contentType),
                          dataUrl: null,
                          size: att.size || null,
                      };
                    }));

                    const emailData = {
                      uid: item.attributes.uid,
                      from: sanitizeString(mail.from?.text),
                      subject: sanitizeString(mail.subject),
                      date: mail.date?.toISOString() || new Date().toISOString(),
                      body: sanitizeString(mail.html || mail.textAsHtml),
                      attachments: attachments,
                      createdAt: serverTimestamp(),
                      processedAction: null,
                    };
                    
                    const docRef = doc(db, 'inboxEmails', String(emailData.uid));
                    batch.set(docRef, emailData);
                }
                await batch.commit();
            }
        }

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
            let connection;
            try {
                connection = await connectToImap();
                await connection.openBox('INBOX');
                await connection.deleteMessage(uids);
            } catch (imapError: any) {
                 console.error('IMAP deletion error during POST:', imapError);
                 // Don't fail the whole request, just log it. The Firestore part will still run.
            } finally {
                 if (connection) connection.end();
            }
            
            uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.delete(docRef);
                 const processedDocRef = doc(db, 'processedEmails', String(uid));
                batch.delete(processedDocRef);
            });

        } else if (action === 'unarchive') {
             uids.forEach((uid: number) => {
                const docRef = doc(db, 'inboxEmails', String(uid));
                batch.update(docRef, { processedAction: null });
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
