
// /src/app/api/emails/inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET() {
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

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['ALL']; // Fetch all emails for now
    const fetchOptions = {
      bodies: ['HEADER', ''], // Fetch both header and body
      markSeen: false,
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    connection.end();

    const emails = await Promise.all(
      messages.map(async (item) => {
        const headerPart = item.parts.find(part => part.which === 'HEADER');
        const bodyPart = item.parts.find(part => part.which === '' && part.size < 1048576);

        const fullBody = (headerPart ? headerPart.body : '') + (bodyPart ? bodyPart.body : '');
        
        const mail = await simpleParser(fullBody);
        
        const attachments = mail.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            dataUrl: null, // DO NOT send content to the client
            size: att.size,
        }));

        return {
          uid: item.attributes.uid,
          from: mail.from?.text || 'No Sender',
          subject: mail.subject || 'No Subject',
          date: mail.date?.toISOString() || new Date().toISOString(),
          body: bodyPart ? (mail.html || mail.textAsHtml || 'No content') : '[Email body too large to display]',
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
