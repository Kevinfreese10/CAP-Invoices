// /src/app/api/emails/inbox/route.ts
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

// This regex matches any character that is not a standard printable ASCII character,
// newline, carriage return, or tab. This is a safe way to remove control characters.
const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export async function GET() {
  const config = {
    imap: {
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: Number(process.env.IMAP_PORT) || 993,
      tls: true,
      authTimeout: 30000, // Increased timeout
      tlsOptions: { rejectUnauthorized: false } 
    },
  };

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    // Fetch only emails since the specified date to prevent timeouts
    const searchCriteria = [['SINCE', '25-Jan-2026']]; 

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
        
        const attachments = await Promise.all(mail.attachments.map(async (att) => {
            if (att.content) {
                const dataUrl = `data:${att.contentType};base64,${att.content.toString('base64')}`;
                return {
                    filename: att.filename || null,
                    contentType: att.contentType || null,
                    dataUrl: dataUrl,
                    size: att.size || null,
                };
            }
            return {
                filename: att.filename || null,
                contentType: att.contentType || null,
                dataUrl: null,
                size: att.size || null,
            };
        }));
        
        const rawBody = mail.html || mail.textAsHtml || 'No content';

        return {
          uid: item.attributes.uid,
          from: mail.from?.text || 'No Sender',
          subject: mail.subject || 'No Subject',
          date: mail.date?.toISOString() || new Date().toISOString(),
          body: rawBody.replace(controlCharRegex, ''), // Sanitize the body
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
