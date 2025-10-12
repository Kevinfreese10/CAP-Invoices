
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, User, Service } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

let staffCounters: { [key: string]: number } = {};

// Helper function to get the next staff member in a round-robin fashion
const getNextStaffMember = async (department: 'Accounting and Tax' | 'Administration' | 'CAP'): Promise<User | undefined> => {
    const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']), where('department', '==', department));
    const staffSnapshot = await getDocs(staffQuery);
    const staffInDept = staffSnapshot.docs.map(d => ({...d.data(), id: d.id } as User));

    if (staffInDept.length === 0) return undefined;

    const currentIndex = staffCounters[department] || 0;
    const nextStaff = staffInDept[currentIndex];
    
    staffCounters[department] = (currentIndex + 1) % staffInDept.length;
    
    return nextStaff;
};


// Function to generate the signature string from the data received from PayFast.
// Note: PayFast's ITN signature calculation is different from the payment request signature.
// ITN signature uses alphabetical sorting of the received data.
function generateItnSignature(data: { [key: string]: any }, passphrase?: string): string {
    // Create a new object for sorting, excluding the signature
    const sigData = { ...data };
    delete sigData.signature;

    // Sort the keys alphabetically
    const sortedKeys = Object.keys(sigData).sort();

    // Create the parameter string
    let pfOutput = '';
    sortedKeys.forEach(key => {
        if (sigData[key] !== '') {
            pfOutput += `${key}=${encodeURIComponent(sigData[key]).replace(/%20/g, '+')}&`;
        }
    });

    // Remove the last ampersand
    let getString = pfOutput.slice(0, -1);

    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(getString, 'utf8').digest('hex');
}


export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const data = Object.fromEntries(new URLSearchParams(bodyText));
        
        console.log('Received PayFast ITN:', data);

        // --- 1. SIGNATURE VALIDATION ---
        const receivedSignature = data.signature;
        const expectedSignature = generateItnSignature(data, process.env.PAYFAST_PASSPHRASE);

        if (receivedSignature !== expectedSignature) {
            console.error('ITN Signature Mismatch. Received:', receivedSignature, 'Expected:', expectedSignature);
            // Respond 200 OK to PayFast to stop retries, but do not process.
            return new NextResponse('Signature mismatch', { status: 200 }); 
        }

        // --- 2. DATA VALIDATION ---
        const orderId = data.m_payment_id;
        if (!orderId) {
            console.error('No m_payment_id in ITN payload.');
            return new NextResponse('Missing payment ID', { status: 200 });
        }

        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found.`);
            return new NextResponse('Order not found', { status: 200 });
        }

        const orderData = orderSnap.data() as Order;

        // --- 3. AMOUNT VALIDATION ---
        const amountGross = parseFloat(data.amount_gross);
        const orderTotal = orderData.total;

        if (Math.abs(amountGross - orderTotal) > 0.01) {
            console.error(`Amount mismatch for order ${orderId}. Expected ${orderTotal}, got ${amountGross}`);
            return new NextResponse('Amount mismatch', { status: 200 });
        }
        
        // --- 4. PROCESS PAYMENT ---
        if (data.payment_status === 'COMPLETE') {
            if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                console.log(`Order ${orderId} already processed. Ignoring ITN.`);
                return new NextResponse('Order already processed', { status: 200 });
            }

            // Find department from the first service to assign a staff member
            const firstService = allServices.find(s => s.id === orderData.items[0]?.id);
            const department = firstService?.department;
            let assignedStaff: User | undefined;
            let assignedToId: string | null = null;
            
            if (department) {
                assignedStaff = await getNextStaffMember(department);
                assignedToId = assignedStaff?.id || null;
            }

            // Update order status and assign staff
            await updateDoc(orderRef, {
                status: 'Processing',
                assignedTo: assignedToId ? [assignedToId] : [],
                department: department || null,
            });

            // Create task for assigned staff member
            if (assignedStaff?.id) {
                const taskData: Omit<Task, 'id'> = {
                    title: `Process Order: ${orderId}`,
                    description: `Fulfill the services for order ${orderId}. Services include: ${orderData.items.map(i => i.title).join(', ')}.`,
                    assignedTo: [assignedStaff.id],
                    createdBy: 'system', // Indicates automated creation
                    createdAt: Timestamp.now(),
                    dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
                    priority: 'Medium',
                    status: 'To-Do',
                    orderId: orderId,
                    comments: [],
                };
                await addDoc(collection(db, 'tasks'), taskData);

                // Send email notification to staff member
                if (assignedStaff.email) {
                    const taskEmailHtml = render(<NewTaskEmail 
                        assigneeName={assignedStaff.name.split(' ')[0]}
                        taskTitle={taskData.title}
                        taskDescription={taskData.description}
                        dueDate={format(taskData.dueDate.toDate(), 'dd MMMM yyyy')}
                        assignedBy={"System"}
                        taskUrl={`${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`}
                    />);
                    await sendEmail({
                        to: assignedStaff.email,
                        subject: `New Task Assigned: ${taskData.title}`,
                        html: taskEmailHtml,
                    });
                }
            }
             console.log(`Order ${orderId} successfully updated to Processing.`);
        } else {
            // Handle other statuses like FAILED, CANCELLED etc.
            console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
            if (orderData.status !== 'Cancelled') {
                await updateDoc(orderRef, { status: 'Cancelled' });
            }
        }
        
        // Acknowledge receipt of the ITN to PayFast
        return new NextResponse('OK', { status: 200 });
        
    } catch (error) {
        console.error('Error processing ITN:', error);
        // Still return 200 OK to prevent PayFast from retrying a failing request.
        return new NextResponse('Internal Server Error', { status: 200 });
    }
}
