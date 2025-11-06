
// /src/app/api/emails/inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET() {
  const config = {
    imap: {
      user: 'invoices2@myacc.co.za',
      password: 'Thinkestry10$',
      host: 'mail.myacc.co.za',
      port: 993,
      tls: true,
      authTimeout: 3000,
      tlsOptions: { rejectUnauthorized: false } 
    },
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['ALL']; // Fetch all emails for now
    const fetchOptions = {
      bodies: [''],
      markSeen: false, // Set to false to not mark emails as read
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    connection.end();

    const emails = await Promise.all(
      messages.map(async (item) => {
        const all = item.parts.find((part) => part.which === '');
        const id = item.attributes.uid;
        const idHeader = 'Imap-Id: ' + id + '\r\n';
        const mail = await simpleParser(all?.body || '');
        
        const attachments = mail.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            dataUrl: null, // DO NOT send content to the client
            size: att.size,
        }));

        return {
          uid: id,
          from: mail.from?.text || 'No Sender',
          subject: mail.subject || 'No Subject',
          date: mail.date?.toISOString() || new Date().toISOString(),
          body: mail.html || mail.textAsHtml || 'No content',
          attachments: attachments,
        };
      })
    );
    
    // Sort emails by date, newest first
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('IMAP connection error:', error);
    return NextResponse.json({ error: `Failed to connect to mail server: ${error.message}` }, { status: 500 });
  }
}
