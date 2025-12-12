
// /src/app/api/emails/process-attachments/route.ts
import { NextResponse } from 'next/server';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, getFirestore, serverTimestamp, doc, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';


const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

async function fetchFullEmail(uid: number) {
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
        const messages = await connection.search([['UID', uid]], { bodies: [''] });
        if (messages.length === 0) {
            throw new Error(`Email with UID ${uid} not found on server.`);
        }
        const item = messages[0];
        const all = item.parts.find((part) => part.which === '');
        const mail = await simpleParser(all?.body || '');
        
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

        return { ...mail, attachments };

    } finally {
        if(connection) connection.end();
    }
}

export async function POST(req: Request) {
  try {
    const { email: emailStub, reprocess } = await req.json();

    if (!emailStub || !emailStub.uid) {
      return NextResponse.json({ error: 'Invalid email data provided.' }, { status: 400 });
    }
    
    const fullEmail = await fetchFullEmail(emailStub.uid);
    const attachments = fullEmail.attachments.filter(att => att.dataUrl);

    const allowedContentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const processableAttachments = attachments.filter(
      (att: any) => att.contentType && allowedContentTypes.includes(att.contentType)
    );

    if (processableAttachments.length === 0) {
      // Mark as processed even if no attachments, to prevent retries
      const processedEmailRef = doc(db, 'processedEmails', String(emailStub.uid));
      await setDoc(processedEmailRef, {
          uid: emailStub.uid,
          processedAt: serverTimestamp(),
          subject: emailStub.subject,
          from: emailStub.from,
          status: 'no_attachments'
      });
      return NextResponse.json({ message: 'No processable attachments found.' }, { status: 200 });
    }

    let processedCount = 0;

    for (const attachment of processableAttachments) {
      try {
        if(!attachment.dataUrl) continue;
        
        // 1. Extract data using AI first to check for duplicates before uploading
        const result = await extractInvoiceData({ invoiceImage: attachment.dataUrl });

        if (!result || !result.supplier || !result.invoiceNumber) {
          console.warn(`AI could not extract valid data for ${attachment.filename}. Skipping.`);
          continue; // Skip this attachment if AI fails
        }
        
        // --- Duplicate Prevention Check ---
        const invoiceQuery = query(
            collection(db, "extractedInvoices"),
            where("supplier", "==", result.supplier),
            where("invoiceNumber", "==", result.invoiceNumber)
        );
        const existingInvoices = await getDocs(invoiceQuery);
        
        // If reprocessing, we don't create a new one. If not reprocessing, we mark as duplicate.
        if (!existingInvoices.empty) {
            if (reprocess) {
                 console.log(`Reprocess: Invoice for ${result.supplier} #${result.invoiceNumber} already exists. Skipping.`);
                 continue;
            }
             // Not reprocessing, so create it but mark as duplicate
            const storageRef = ref(storage, `invoices/email-${emailStub.uid}/${Date.now()}-${attachment.filename}`);
            const base64Data = attachment.dataUrl.split(',')[1];
            const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: attachment.contentType || undefined });
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const invoiceData = {
              ...result,
              fileName: attachment.filename || 'N/A',
              fileUrl: downloadURL,
              status: 'duplicate' as const,
              uploadedBy: 'email_inbox',
              createdAt: serverTimestamp(),
              sourceEmailUid: emailStub.uid,
            };
            await addDoc(collection(db, "extractedInvoices"), invoiceData);
            processedCount++;
            continue; // Move to next attachment
        }
        // --- End of Duplicate Prevention Check ---

        // 2. If not a duplicate, proceed with upload and save
        const storageRef = ref(storage, `invoices/email-${emailStub.uid}/${Date.now()}-${attachment.filename}`);
        const base64Data = attachment.dataUrl.split(',')[1];
        const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: attachment.contentType || undefined });
        const downloadURL = await getDownloadURL(uploadResult.ref);
        
        // 3. Save to Firestore with the download URL
        const invoiceData = {
          ...result,
          fileName: attachment.filename || 'N/A',
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: 'email_inbox', // Mark as system upload
          createdAt: serverTimestamp(),
          sourceEmailUid: emailStub.uid,
        };
        
        await addDoc(collection(db, "extractedInvoices"), invoiceData);
        processedCount++;

      } catch (error) {
        console.error(`Failed to process attachment ${attachment.filename}:`, error);
        // Continue to the next attachment even if one fails
      }
    }

    // 4. Mark the email as processed in Firestore to avoid re-processing in future sessions
    // This happens even if some attachments failed, to prevent reprocessing successful ones.
    const processedEmailRef = doc(db, 'processedEmails', String(emailStub.uid));
    await setDoc(processedEmailRef, {
        uid: emailStub.uid,
        processedAt: serverTimestamp(),
        subject: emailStub.subject,
        from: emailStub.from,
        status: processedCount > 0 ? 'processed' : 'failed'
    });
    

    return NextResponse.json({ 
        message: 'Attachments processed successfully.',
        totalProcessable: processableAttachments.length,
        processedCount: processedCount,
    });
  } catch (error: any) {
    console.error('Error processing attachments:', error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
