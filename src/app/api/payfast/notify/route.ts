
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, Service, User, OrderNote, Task } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

let staffCounters: { [key: string]: number } = {};

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

const processSuccessfulPayment = async (orderId: string) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
        throw new Error(`Order ${orderId} not found.`);
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    // Prevent re-processing
    if (order.status === 'Processing' || order.status === 'Completed') {
        console.log(`Order ${orderId} has already been processed.`);
        return { success: true, message: 'Order already processed.' };
    }
    
    const firstService = allServices.find(s => s.id === order.items[0]?.id);
    const department = firstService?.department;
    let assignedStaff: User | undefined;
    let assignedToId: string | null = null;
    
    if (department) {
        assignedStaff = await getNextStaffMember(department);
        assignedToId = assignedStaff?.id || null;
    }
    
    await updateDoc(orderRef, {
        status: 'Processing',
        assignedTo: assignedToId ? [assignedToId] : [],
        department: department || null,
    });
    
    // The email is now sent from the success page to give immediate feedback.
    // However, the task creation should happen here reliably.
    if (assignedStaff?.id) {
        const taskData: Omit<Task, 'id'> = {
            title: `Process Order: ${orderId}`,
            description: `Fulfill the services for order ${orderId}. Services include: ${order.items.map(i => i.title).join(', ')}.`,
            assignedTo: [assignedStaff.id],
            createdBy: 'system',
            createdAt: Timestamp.now(),
            dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            priority: 'Medium',
            status: 'To-Do',
            orderId: orderId,
            comments: [],
        };
        await addDoc(collection(db, 'tasks'), taskData);

        if(assignedStaff.email) {
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

    return { success: true, message: `Order ${orderId} processed.` };
}

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    
    // Use the exact order from the form submission, not the ITN order
    const orderedKeys = [
        'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
        'name_first', 'name_last', 'email_address', 'cell_number', 'm_payment_id',
        'amount', 'item_name', 'item_description', 'payment_method'
    ];
    
    // Create a new object with only the keys relevant for signature generation
    // from the ITN payload
    const dataForSignature: {[key: string]: any} = {};
     orderedKeys.forEach(key => {
        if(data.hasOwnProperty(key)) {
            dataForSignature[key] = data[key];
        }
    });

    for (const key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            const value = data[key];
             if (value !== '' && value !== null && value !== undefined) {
                pfOutput += `${key}=${rfc3986Encode(String(value).trim())}&`;
            }
        }
    }

    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
  // Acknowledge receipt of the ITN post from PayFast
  const response = new NextResponse('OK', { status: 200 });

  const body = await req.text();
  const data: { [key:string]: any } = Object.fromEntries(new URLSearchParams(body));

  console.log('Received PayFast ITN:', data);
  
  // Security Checks
  // 1. Signature Validation
  // Note: The signature from ITN uses ALL POSTed fields, not the ordered list from the initial request.
  const tempParamString = Object.keys(data)
    .filter(key => key !== 'signature')
    .map(key => `${key}=${rfc3986Encode(String(data[key]).trim())}`)
    .join('&');

    const signatureStringWithPassphrase = `${tempParamString}&passphrase=${rfc3986Encode(process.env.PAYFAST_PASSPHRASE || '')}`;
    const expectedSignature = crypto.createHash('md5').update(signatureStringWithPassphrase).digest('hex');

    if (data.signature !== expectedSignature) {
        console.error('ITN Signature Mismatch');
        console.error('Received:', data.signature);
        console.error('Expected:', expectedSignature);
        // Don't process, but still return 200 OK to stop PayFast retries.
        return response;
    }

    const orderId = data.m_payment_id;
    if (!orderId) {
        console.error('No m_payment_id in ITN payload.');
        return response;
    }
  
    // Fetch order from Firestore
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
        console.error(`Order ${orderId} not found.`);
        return response;
    }
    const orderData = orderSnap.data() as Order;
    
    // 2. Amount Validation
    const amountGross = parseFloat(data.amount_gross);
    const orderTotal = orderData.total;
    if (Math.abs(amountGross - orderTotal) > 0.01) {
        console.error(`Amount mismatch for order ${orderId}. Expected ${orderTotal}, got ${amountGross}`);
        return response;
    }

    // 3. Status Check & Update
    if (data.payment_status === 'COMPLETE') {
        try {
            await processSuccessfulPayment(orderId);
            console.log(`Order ${orderId} processing initiated successfully via ITN.`);
        } catch(error) {
            console.error(`Error processing order ${orderId} from ITN:`, error);
        }
    } else {
        console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
    }

    return response;
}
