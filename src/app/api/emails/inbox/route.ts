
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
        const headerPart = item.parts.find((part: any) => part.which === 'HEADER');
        const bodyPart = item.parts.find((part: any) => part.which === '');

        if (!bodyPart) {
          // This can happen if the email body is too large or has a complex structure not fetched.
          // We'll parse just the header to get essential info.
          const mail = await simpleParser(headerPart ? headerPart.body : '');
          return {
            uid: item.attributes.uid,
            from: mail.from?.text || 'No Sender',
            subject: mail.subject || 'No Subject',
            date: mail.date?.toISOString() || new Date().toISOString(),
            body: '[Email body too large or unreadable]',
            attachments: [],
          };
        }

        // Reconstruct the raw email source by combining header and body
        const rawEmail = (headerPart ? headerPart.body : '') + (bodyPart ? bodyPart.body : '');
        
        const mail = await simpleParser(rawEmail);
        
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
