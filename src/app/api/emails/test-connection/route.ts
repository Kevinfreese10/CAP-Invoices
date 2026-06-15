import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

export async function POST() {
  const config = {
    imap: {
      user: process.env.IMAP_USER || '',
      password: (process.env.IMAP_PASSWORD || '').trim(),
      host: process.env.IMAP_HOST || '',
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
