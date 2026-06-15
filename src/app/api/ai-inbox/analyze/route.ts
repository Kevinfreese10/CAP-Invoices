import { NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

const db = getFirestore(firebaseApp);

async function connectToImap() {
    const config = {
      imap: {
        user: process.env.IMAP_USER || '',
        password: (process.env.IMAP_PASSWORD || '').trim(),
        host: process.env.IMAP_HOST || '',
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false } 
      },
    };
    return await imaps.connect(config);
}

async function fetchEmailBodyText(uid: number): Promise<string> {
    let connection;
    try {
        connection = await connectToImap();
        await connection.openBox('INBOX');
        const messages = await connection.search([['UID', uid]], { bodies: [''] });
        if (messages.length === 0) {
            throw new Error(`Email with UID ${uid} not found on server.`);
        }
        const item = messages[0];
        const all = item.parts.find((part) => part.which === '');
        const mail = await simpleParser(all?.body || '');
        
        // Return plain text if available, fallback to html (stripped of tags), fallback to empty string
        if (mail.text) {
            return mail.text;
        } else if (mail.html) {
            return mail.html.replace(/<[^>]*>?/gm, ' ');
        }
        return '';
    } catch (error: any) {
        console.error(`Error fetching email body for UID ${uid}:`, error);
        throw error;
    } finally {
        if (connection) {
            connection.end();
        }
    }
}

export async function POST(req: Request) {
    const { uids } = await req.json();

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
        return NextResponse.json({ error: 'Missing or invalid email UIDs.' }, { status: 400 });
    }

    try {
        let successCount = 0;
        for (const uid of uids) {
            const docRef = doc(db, 'inboxEmails', String(uid));
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const email = docSnap.data();
                
                try {
                    // Fetch the full email body text directly from IMAP server on-demand
                    const emailBodyText = await fetchEmailBodyText(uid);
                    const requestText = `Subject: ${email.subject}\n\nBody: ${emailBodyText}`;
                    const clientName = email.from.split('<')[0].trim();
                    
                    const analysis = await categorizeSupportRequest({ 
                        request: requestText, 
                        clientName,
                        attachments: email.attachments || [],
                    });
                    
                    const updateData: any = {
                        summary: analysis.summary || null,
                        category: analysis.category || null,
                        priority: analysis.priority || null,
                        sla: analysis.sla || null,
                        suggestedAction: analysis.suggestedAction || 'none',
                        draftReply: analysis.draftReply || null,
                    };
                    
                    if (analysis.task?.shouldCreate && analysis.task.title) {
                        const dueDate = new Date();
                        dueDate.setHours(dueDate.getHours() + (analysis.sla || 48));
                        
                        await addDoc(collection(db, 'tasks'), {
                            title: analysis.task.title,
                            description: analysis.task.description || 'Generated from email.',
                            status: 'To-Do',
                            priority: analysis.priority,
                            dueDate: Timestamp.fromDate(dueDate),
                            createdAt: serverTimestamp(),
                            createdBy: 'ai_system',
                            assignedTo: [], // Needs manual assignment
                        });
                        updateData.isProcessed = true;
                        updateData.processedAction = 'processed';
                    }

                    await updateDoc(docRef, updateData);
                    successCount++;
                } catch (aiError) {
                     console.error(`AI analysis failed for email UID ${uid}:`, aiError);
                    // Continue to next email even if one fails
                }
            }
        }
        
        if(successCount === 0) {
            throw new Error("AI analysis failed for all selected emails.");
        }

        return NextResponse.json({ message: `Successfully analyzed ${successCount} of ${uids.length} emails.` });
    } catch (error: any) {
        console.error('Error analyzing emails:', error);
        return NextResponse.json({ error: `An unexpected error occurred during analysis: ${error.message}` }, { status: 500 });
    }
}
