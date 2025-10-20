
import { NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';

const db = getFirestore(firebaseApp);

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
                const requestText = `Subject: ${email.subject}\n\nBody: ${email.body.replace(/<[^>]*>?/gm, ' ')}`; // simple html strip
                const clientName = email.from.split('<')[0].trim();
                
                try {
                    const analysis = await categorizeSupportRequest({ 
                        request: requestText, 
                        clientName,
                        attachments: email.attachments,
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
