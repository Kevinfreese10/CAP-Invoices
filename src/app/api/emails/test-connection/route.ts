import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

const defaultImapPassword = Buffer.from('VGhpbmtlc3RyeTEwJA==', 'base64').toString('utf8');

export async function POST() {
  const password = (process.env.IMAP_PASSWORD || '').trim() || defaultImapPassword;
  const config = {
    imap: {
      user: process.env.IMAP_USER || 'invoices2@myacc.co.za',
      password,
      host: process.env.IMAP_HOST || 'mail.myacc.co.za',
      port: Number(process.env.IMAP_PORT) || 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false } 
    },
  };

  try {
    const connection = await imaps.connect(config);
    connection.end();
    return NextResponse.json({ success: true, message: 'IMAP connection successful!' });
  } catch (error: any) {
    console.error('IMAP test connection error:', error);
    return NextResponse.json({ success: false, error: `Failed to connect to mail server: ${error.message}` }, { status: 500 });
  }
}
