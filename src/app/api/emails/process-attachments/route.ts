
// /src/app/api/emails/process-attachments/route.ts
import { NextResponse } from 'next/server';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, getFirestore, serverTimestamp, doc, setDoc, getDocs, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { ExtractedInvoice } from '@/lib/types';


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
    const { email: emailStub, reprocess, attachmentFilename } = await req.json();

    if (!emailStub || !emailStub.uid) {
      return NextResponse.json({ error: 'Invalid email data provided.' }, { status: 400 });
    }
    
    const fullEmail = await fetchFullEmail(emailStub.uid);
    const attachments = fullEmail.attachments.filter(att => att.dataUrl);

    const allowedContentTypes = [
        'application/pdf'
    ];

    let processableAttachments = attachments.filter(
      (att: any) => att.contentType && allowedContentTypes.includes(att.contentType)
    );

    if (attachmentFilename) {
        processableAttachments = processableAttachments.filter(
            (att: any) => att.filename === attachmentFilename
        );
         if (processableAttachments.length === 0) {
            return NextResponse.json({ message: `Attachment ${attachmentFilename} not found or not processable in this email.` }, { status: 404 });
        }
    }


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
    let failedCount = 0;
    let duplicateCount = 0;

    for (const attachment of processableAttachments) {
      const existingInvoiceQuery = query(
        collection(db, "extractedInvoices"),
        where("sourceEmailUid", "==", emailStub.uid),
        where("fileName", "==", attachment.filename)
      );

      try {
        if(!attachment.dataUrl) continue;
        
        const existingInvoicesSnapshot = await getDocs(existingInvoiceQuery);
        const existingInvoiceDoc = existingInvoicesSnapshot.empty ? null : existingInvoicesSnapshot.docs[0];

        if (existingInvoiceDoc && !reprocess) {
            duplicateCount++;
            continue;
        }

        const result = await extractInvoiceData({ invoiceImage: attachment.dataUrl });

        if (!result || !result.supplier || !result.invoiceNumber) {
          throw new Error('AI could not read the required details from the invoice.');
        }

        const storageRef = ref(storage, `invoices/email-${emailStub.uid}/${Date.now()}-${attachment.filename}`);
        const base64Data = attachment.dataUrl.split(',')[1];
        const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: attachment.contentType || undefined });
        const downloadURL = await getDownloadURL(uploadResult.ref);
        
        const invoiceData: Partial<ExtractedInvoice> = {
          ...result,
          fileName: attachment.filename || 'N/A',
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: 'email_inbox',
          sourceEmailUid: emailStub.uid,
          rejectionReason: null, // Clear previous rejection reasons
        };
        
        if (existingInvoiceDoc) {
            await updateDoc(existingInvoiceDoc.ref, {...invoiceData, modifiedAt: serverTimestamp()});
        } else {
            await addDoc(collection(db, "extractedInvoices"), {...invoiceData, createdAt: serverTimestamp()});
        }

        processedCount++;

      } catch (error: any) {
        failedCount++;
        console.error(`Failed to process attachment ${attachment.filename}:`, error);
        
        // Record the failure in Firestore
        const failureData: Partial<ExtractedInvoice> = {
            status: 'extraction_failed',
            rejectionReason: error.message || 'An unknown error occurred during processing.',
            supplier: emailStub.from.split('<')[0].trim() || 'Unknown',
            invoiceNumber: `FAILED-${Date.now()}`,
            date: new Date().toLocaleDateString('en-CA'),
            lineItems: [],
            invoiceTotal: 0,
            fileName: attachment.filename || 'N/A',
            sourceEmailUid: emailStub.uid,
            uploadedBy: 'email_inbox',
        };

        const existingFailureSnapshot = await getDocs(existingInvoiceQuery);
        if (!existingFailureSnapshot.empty) {
            await updateDoc(existingFailureSnapshot.docs[0].ref, failureData);
        } else {
            await addDoc(collection(db, "extractedInvoices"), {...failureData, createdAt: serverTimestamp()});
        }
      }
      // Add a delay between API calls to avoid rate limiting
      if (processableAttachments.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Mark the email as processed in Firestore ONLY IF all attachments were handled successfully (or skipped as duplicates).
    const allAccountedFor = (processedCount + duplicateCount + failedCount) >= processableAttachments.length;
    
    if (allAccountedFor && failedCount === 0 && !attachmentFilename) { // Only mark full email if not processing single file
        const processedEmailRef = doc(db, 'processedEmails', String(emailStub.uid));
        await setDoc(processedEmailRef, {
            uid: emailStub.uid,
            processedAt: serverTimestamp(),
            subject: emailStub.subject,
            from: emailStub.from,
            status: 'processed'
        });
    }

    return NextResponse.json({ 
        message: 'Attachments processed.',
        totalProcessable: processableAttachments.length,
        processedCount: processedCount,
        duplicateCount: duplicateCount,
        failedCount: failedCount
    });
  } catch (error: any) {
    console.error('Error processing attachments:', error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
