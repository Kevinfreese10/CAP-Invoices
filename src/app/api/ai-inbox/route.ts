
// /src/app/api/ai-inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
    // Fetch processed email UIDs from Firestore first
    const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
    const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: [''],
      markSeen: false,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    connection.end();

    const emails = await Promise.all(
      messages.map(async (item) => {
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
    
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('IMAP connection error for kev@myacc.co.za:', error);
    return NextResponse.json({ error: `Failed to connect to mail server: ${error.message}` }, { status: 500 });
  }
}
