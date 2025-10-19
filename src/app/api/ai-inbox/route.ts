
// /src/app/api/ai-inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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
    const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
    const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Fetch only unseen emails to improve efficiency
    const searchCriteria = ['UNSEEN']; 
    const fetchOptions = {
      bodies: [''],
      markSeen: false, // We won't mark them as seen automatically
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    connection.end();
    
    // Fetch already processed emails to show them in the list as well
    const processedMessagesPromises = Array.from(processedUids).map(async (uid) => {
        try {
            const connection = await imaps.connect(config);
            await connection.openBox('INBOX');
            const criteria = [['UID', uid]];
            const processedMessage = await connection.search(criteria, fetchOptions);
            connection.end();
            return processedMessage[0];
        } catch (e) {
            console.warn(`Could not fetch processed email with UID ${uid}:`, e);
            return null;
        }
    });

    const processedMessagesRaw = (await Promise.all(processedMessagesPromises)).filter(m => m);
    const allMessages = [...messages, ...processedMessagesRaw];
    
    // Deduplicate messages based on UID
    const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.attributes.uid, m])).values());

    const emails = await Promise.all(
      uniqueMessages.map(async (item) => {
        if (!item) return null;
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

        return {
          uid: id,
          from: mail.from?.text || 'No Sender',
          to: mail.to?.text || '',
          subject: mail.subject || 'No Subject',
          date: mail.date?.toISOString() || new Date().toISOString(),
          body: mail.html || mail.textAsHtml || 'No content',
          attachments: attachments,
          isProcessed: processedUids.has(id),
        };
      })
    );
    
    const validEmails = emails.filter(e => e !== null) as NonNullable<typeof emails>[number][];
    validEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(validEmails);
  } catch (error: any) {
    console.error('IMAP connection error for kev@myacc.co.za:', error);
    return NextResponse.json({ error: `Failed to connect to mail server: ${error.message}` }, { status: 500 });
  }
}
