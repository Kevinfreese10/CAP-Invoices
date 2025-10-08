
// /src/app/api/emails/process-attachments/route.ts
import { NextResponse } from 'next/server';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, getFirestore, serverTimestamp, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';

const storage = getStorage(firebaseApp);
const db = getFirestore(firebaseApp);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.attachments) {
      return NextResponse.json({ error: 'Invalid email data provided.' }, { status: 400 });
    }

    const pdfAttachments = email.attachments.filter(
      (att: any) => att.contentType === 'application/pdf'
    );

    if (pdfAttachments.length === 0) {
      return NextResponse.json({ error: 'No PDF attachments found in the email.' }, { status: 400 });
    }

    let processedCount = 0;

    for (const attachment of pdfAttachments) {
      try {
        // --- Duplicate Prevention Check ---
        const invoiceQuery = query(
          collection(db, "extractedInvoices"),
          where("sourceEmailUid", "==", email.uid),
          where("fileName", "==", attachment.filename)
        );
        const existingInvoices = await getDocs(invoiceQuery);
        if (!existingInvoices.empty) {
          console.log(`Skipping duplicate attachment: ${attachment.filename} from email UID ${email.uid}`);
          continue; // Skip to the next attachment
        }
        // --- End of Duplicate Prevention Check ---

        // 1. Upload the file to Firebase Storage from data URL
        const storageRef = ref(storage, `invoices/email-${email.uid}/${Date.now()}-${attachment.filename}`);
        // Data URL format: 'data:<mime_type>;base64,<encoded_data>'
        const base64Data = attachment.dataUrl.split(',')[1];
        const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: attachment.contentType });
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // 2. Extract data using AI
        const result = await extractInvoiceData({ invoiceImage: attachment.dataUrl });

        if (!result || !result.supplier) {
          console.warn(`AI could not extract valid data for ${attachment.filename}. Skipping.`);
          continue; // Skip this attachment if AI fails
        }
        
        // 3. Save to Firestore with the download URL
        const invoiceData = {
          ...result,
          fileName: attachment.filename || 'N/A',
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: 'email_inbox', // Mark as system upload
          createdAt: serverTimestamp(),
          sourceEmailUid: email.uid,
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
    const processedEmailRef = doc(db, 'processedEmails', String(email.uid));
    await setDoc(processedEmailRef, {
        uid: email.uid,
        processedAt: serverTimestamp(),
        subject: email.subject,
        from: email.from,
    });
    

    return NextResponse.json({ 
        message: 'Attachments processed successfully.',
        totalPdfs: pdfAttachments.length,
        processedCount: processedCount,
    });
  } catch (error: any) {
    console.error('Error processing attachments:', error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
