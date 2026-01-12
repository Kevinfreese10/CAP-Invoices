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

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Fetch only the last 100 messages to avoid timeouts
    const messageCount = await connection.getBoxInfo().then(info => info.messages.total);
    const start = Math.max(1, messageCount - 99);
    const searchCriteria = [`${start}:*`];

    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)', ''], // Fetch specific headers and body
      markSeen: false,
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    
    const emails = await Promise.all(
      messages.map(async (item) => {
        const bodyPart = item.parts.find((part: any) => part.which === '');
        const rawEmail = bodyPart ? bodyPart.body : '';
        
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
    // Ensure connection is closed on error
    if (connection) {
      try {
        connection.end();
      } catch (endError) {
        console.error('Failed to end IMAP connection:', endError);
      }
    }
    return NextResponse.json({ error: `Failed to connect to mail server: ${error.message}` }, { status: 500 });
  } finally {
    if (connection && connection.state !== 'disconnected') {
      connection.end();
    }
  }
}