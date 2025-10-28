
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

export async function POST(req: Request) {
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
  
  const { uids } = await req.json();

  if (!uids || !Array.isArray(uids) || uids.length === 0) {
    return NextResponse.json({ error: 'Missing email UIDs to delete.' }, { status: 400 });
  }

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    // Mark emails for deletion
    await connection.addFlags(uids.join(','), '\\Deleted');
    
    // Expunge to permanently delete
    await connection.expunge();
    
    connection.end();
    
    return NextResponse.json({ message: `${uids.length} email(s) deleted successfully.` });

  } catch (error: any) {
    console.error('IMAP deletion error:', error);
    if (connection) connection.end();
    return NextResponse.json({ error: `Failed to delete emails: ${error.message}` }, { status: 500 });
  }
}
