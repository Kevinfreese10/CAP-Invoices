
// /src/app/api/emails/process-attachments/route.ts
import { NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { ExtractedInvoice } from '@/lib/types';


// Admin SDK initialized via imports

async function fetchFullEmail(uid: number) {
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
      const processedEmailRef = adminDb.collection('processedEmails').doc(String(emailStub.uid));
      await processedEmailRef.set({
          uid: emailStub.uid,
          processedAt: FieldValue.serverTimestamp(),
          subject: emailStub.subject,
          from: emailStub.from,
          status: 'no_attachments'
      });
      return NextResponse.json({ message: 'No processable attachments found.' }, { status: 200 });
    }

    let processedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;

    for (const [index, attachment] of processableAttachments.entries()) {
      // Add a delay between API calls to avoid rate limiting, especially on free tiers.
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second delay
      }

      const existingInvoiceQuery = adminDb.collection("extractedInvoices")
        .where("sourceEmailUid", "==", emailStub.uid)
        .where("fileName", "==", attachment.filename);

      try {
        if(!attachment.dataUrl) continue;
        
        const existingInvoicesSnapshot = await existingInvoiceQuery.get();
        const existingInvoiceDoc = existingInvoicesSnapshot.empty ? null : existingInvoicesSnapshot.docs[0];

        if (existingInvoiceDoc && !reprocess) {
            duplicateCount++;
            continue;
        }

        const result = await extractInvoiceData({ invoiceImage: attachment.dataUrl });

        if (!result || !result.supplier || !result.invoiceNumber) {
          throw new Error('AI could not read the required details from the invoice.');
        }

        const bucket = adminStorage.bucket();
        const file = bucket.file(`invoices/email-${emailStub.uid}/${Date.now()}-${attachment.filename}`);
        const base64Data = attachment.dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        await file.save(buffer, {
          metadata: { contentType: attachment.contentType || 'application/pdf' },
        });
        
        await file.makePublic();
        const downloadURL = file.publicUrl();
        
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
            await existingInvoiceDoc.ref.update({...invoiceData, modifiedAt: FieldValue.serverTimestamp()});
        } else {
            await adminDb.collection("extractedInvoices").add({...invoiceData, createdAt: FieldValue.serverTimestamp()});
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

        const existingFailureSnapshot = await existingInvoiceQuery.get();
        if (!existingFailureSnapshot.empty) {
            await existingFailureSnapshot.docs[0].ref.update(failureData);
        } else {
            await adminDb.collection("extractedInvoices").add({...failureData, createdAt: FieldValue.serverTimestamp()});
        }
      }
    }

    // Mark the email as processed in Firestore ONLY IF all attachments were handled successfully (or skipped as duplicates).
    const allAccountedFor = (processedCount + duplicateCount + failedCount) >= processableAttachments.length;
    
    if (allAccountedFor && failedCount === 0 && !attachmentFilename) { // Only mark full email if not processing single file
        const processedEmailRef = adminDb.collection('processedEmails').doc(String(emailStub.uid));
        await processedEmailRef.set({
            uid: emailStub.uid,
            processedAt: FieldValue.serverTimestamp(),
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
