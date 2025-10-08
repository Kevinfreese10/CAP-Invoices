import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

export async function POST() {
  const config = {
    imap: {
      user: 'invoices2@myacc.co.za',
      password: 'Thinkestry10$',
      host: 'mail.myacc.co.za',
      port: 993,
      tls: true,
      authTimeout: 5000, // Slightly longer timeout for testing
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
