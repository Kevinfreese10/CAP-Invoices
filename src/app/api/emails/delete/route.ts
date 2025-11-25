
import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { getFirestore, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

export async function POST(req: Request) {
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
  
  const { uids } = await req.json();

  if (!uids || !Array.isArray(uids) || uids.length === 0) {
    return NextResponse.json({ error: 'Missing email UIDs to delete.' }, { status: 400 });
  }

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    await connection.deleteMessage(uids);
    
    connection.end();

    // Now, delete the records from Firestore
    const batch = writeBatch(db);
    uids.forEach(uid => {
      const docRef = doc(db, 'processedEmails', String(uid));
      batch.delete(docRef);
    });
    await batch.commit();
    
    return NextResponse.json({ message: `${uids.length} email(s) deleted successfully.` });

  } catch (error: any) {
    console.error('IMAP deletion error:', error);
    if (connection) connection.end();
    return NextResponse.json({ error: `Failed to delete emails: ${error.message}` }, { status: 500 });
  }
}
