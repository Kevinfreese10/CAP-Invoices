
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog, Service, User, Task } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import { getDocs, collection, query, where, addDoc } from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// Helper function for RFC3986 encoding
function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

// Function to generate MD5 signature from data object
function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    const sortedKeys = Object.keys(data).sort();
    let pfOutput = '';
    sortedKeys.forEach(key => {
        if (data[key] !== '' && data[key] !== null && data[key] !== undefined) {
            pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    });

    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }
    return crypto.createHash('md5').update(getString).digest('hex');
}

// Main handler for the ITN POST request
export async function POST(req: NextRequest) {
    let data: { [key: string]: string } = {};
    let orderId: string = '';

    try {
        const bodyText = await req.text();
        data = Object.fromEntries(new URLSearchParams(bodyText));
        orderId = data.m_payment_id;

        if (!orderId) {
            console.warn('ITN received without m_payment_id.');
            return new NextResponse('OK', { status: 200 });
        }
        
        const orderRef = doc(db, 'orders', orderId);

        // --- Log the ITN attempt ---
        const logItnAttempt = async (message: string, status: ItnLog['status']) => {
            const logEntry: ItnLog = {
                receivedAt: Timestamp.now(),
                status: status,
                message: message,
                payload: data,
            };
            try {
                await updateDoc(orderRef, { itnHistory: arrayUnion(logEntry) });
            } catch (logError) {
                console.error(`Failed to log ITN attempt for order ${orderId}:`, logError);
            }
        };

        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            await logItnAttempt(`Order ${orderId} not found in database.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        const orderData = orderSnap.data() as Order;

        // --- Idempotency Check: If already processed, do nothing ---
        if (orderData.status === 'Processing' || orderData.status === 'Completed') {
            await logItnAttempt('Duplicate ITN received for already processed order. Ignored.', 'Success');
            return new NextResponse('OK', { status: 200 });
        }

        // --- 1. SIGNATURE VALIDATION ---
        const receivedSignature = data.signature;
        if (!receivedSignature) {
            await logItnAttempt('ITN received without signature.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        
        const sigData = { ...data };
        delete sigData.signature;
        const expectedSignature = generateSignature(sigData, process.env.PAYFAST_PASSPHRASE);

        if (receivedSignature.toLowerCase() !== expectedSignature.toLowerCase()) {
            await logItnAttempt(`Signature mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        
        // --- 2. AMOUNT VALIDATION ---
        const amountGross = parseFloat(data.amount_gross);
        if (Math.abs(amountGross - orderData.total) > 0.01) {
            await logItnAttempt(`Amount mismatch. Expected ${orderData.total}, but PayFast reported ${amountGross}.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        // --- 3. PROCESS PAYMENT STATUS ---
        if (data.payment_status === 'COMPLETE') {
            await updateDoc(orderRef, { status: 'Processing' });
            
            // --- Post-Payment Actions ---
            try {
                const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
                const staffSnapshot = await getDocs(staffQuery);
                const allStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));

                const department = orderData.department as 'Accounting and Tax' | 'Administration' | 'CAP' | undefined;
                let assignedStaff: User | undefined;
                if (department) {
                    const staffInDept = allStaff.filter(u => u.role === 'staff' && u.department === department);
                    if (staffInDept.length > 0) {
                        const randomIndex = Math.floor(Math.random() * staffInDept.length);
                        assignedStaff = staffInDept[randomIndex];
                    }
                }

                if (assignedStaff) {
                    await updateDoc(orderRef, { assignedTo: [assignedStaff.id] });
                    const taskData: Omit<Task, 'id'> = {
                      title: `Process Order: ${orderData.id}`,
                      description: `Fulfill the services for order ${orderData.id}.`,
                      assignedTo: [assignedStaff.id],
                      createdBy: 'system',
                      createdAt: Timestamp.now(),
                      dueDate: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
                      priority: 'Medium',
                      status: 'To-Do',
                      orderId: orderData.id,
                      comments: [],
                    };
                    await addDoc(collection(db, 'tasks'), taskData);
                }

                const itemsWithServices = orderData.items.map(item => {
                    const service = allServices.find(s => s.id === item.id);
                    return { ...item, service };
                }).filter(item => item.service) as { service: Service }[];
        
                const emailHtml = render(<DocumentRequestEmail order={orderData} items={itemsWithServices} replyTo={assignedStaff?.email || 'info@myacc.co.za'} />);
                await sendEmail({
                    to: orderData.customerEmail,
                    subject: `Action Required for Your Order #${orderId}`,
                    html: emailHtml,
                });
                
                await logItnAttempt('Payment completed successfully. Order processed, task created, and email sent.', 'Success');

            } catch (actionError: any) {
                 await logItnAttempt(`Payment validated, but post-payment actions failed: ${actionError.message}`, 'Failed');
            }

        } else {
            await logItnAttempt(`Payment not complete. Status: ${data.payment_status}.`, 'Failed');
        }

        return new NextResponse('OK', { status: 200 });
        
    } catch (error: any) {
        console.error('Critical Error in ITN handler:', error);
        // Still respond 200 OK to prevent PayFast from retrying a failing request.
        return new NextResponse('OK', { status: 200 });
    }
}
