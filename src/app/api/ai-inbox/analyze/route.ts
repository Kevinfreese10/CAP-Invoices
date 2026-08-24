import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import ImapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

const defaultImapPassword = Buffer.from('VGhpbmtlc3RyeTEwJA==', 'base64').toString('utf8');

async function fetchEmailBodyText(uid: number): Promise<string> {
    const password = (process.env.IMAP_PASSWORD || '').trim() || defaultImapPassword;
    const imapConfig = {
        imap: {
            user: process.env.IMAP_USER || 'invoices2@myacc.co.za',
            password,
            host: process.env.IMAP_HOST || 'mail.myacc.co.za',
            port: Number(process.env.IMAP_PORT) || 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    let connection: ImapSimple | null = null;
    try {
        connection = await ImapSimple.connect(imapConfig);
        await connection.openBox('INBOX');
        const results = await connection.search([['UID', uid]], { bodies: [''], struct: true });

        if (!results || results.length === 0) {
            throw new Error(`Email with UID ${uid} not found on IMAP server.`);
        }

        const message = results[0];
        const all = message.parts.find(part => part.which === '');
        if (!all) throw new Error("Body part not found");
        
        const parsed = await simpleParser(all.body);
        return parsed.text || parsed.html || 'No body text found.';

    } catch (err: any) {
        console.error(`IMAP fetch failed for UID ${uid}:`, err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                // Ignore disconnect errors
            }
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
            const docRef = adminDb.collection('inboxEmails').doc(String(uid));
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const email = docSnap.data();
                if (email) {
                    try {
                        const emailBodyText = await fetchEmailBodyText(uid);
                        const requestText = `Subject: ${email.subject || ''}\n\nBody: ${emailBodyText}`;
                        const clientName = email.from ? email.from.split('<')[0].trim() : 'Client';
                        
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
                            
                            await adminDb.collection('tasks').add({
                                title: analysis.task.title,
                                description: analysis.task.description || 'Generated from email.',
                                status: 'To-Do',
                                priority: analysis.priority,
                                dueDate: Timestamp.fromDate(dueDate),
                                createdAt: FieldValue.serverTimestamp(),
                                createdBy: 'ai_system',
                                assignedTo: [],
                            });
                            updateData.isProcessed = true;
                            updateData.processedAction = 'processed';
                        }

                        await docRef.update(updateData);
                        successCount++;
                    } catch (aiError) {
                         console.error(`AI analysis failed for email UID ${uid}:`, aiError);
                    }
                }
            }
        }
        
        if (successCount === 0) {
            throw new Error("AI analysis failed for all selected emails.");
        }

        return NextResponse.json({ message: `Successfully analyzed ${successCount} of ${uids.length} emails.` });
    } catch (error: any) {
        console.error('Error analyzing emails:', error);
        return NextResponse.json({ error: `An unexpected error occurred during analysis: ${error.message}` }, { status: 500 });
    }
}
