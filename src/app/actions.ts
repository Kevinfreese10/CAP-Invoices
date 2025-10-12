
'use server';

import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
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

export async function processSuccessfulPayment(orderId: string) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
        throw new Error(`Order ${orderId} not found.`);
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    // Check if already processed to avoid duplicate actions
    if (order.status === 'Processing') {
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
    
    // 1. Update order status and assignment
    await updateDoc(orderRef, {
        status: 'Processing',
        assignedTo: assignedToId ? [assignedToId] : null,
        department: department || null,
    });

    // 2. Send document request email
    const itemsWithServices = order.items.map(item => {
        const service = allServices.find(s => s.id === item.id);
        return { ...item, service };
    }).filter(item => item.service) as { service: Service }[];

    const emailHtml = render(<DocumentRequestEmail order={order} items={itemsWithServices} replyTo={assignedStaff?.email || 'info@myacc.co.za'} />);
    const attachments = itemsWithServices
        .filter(item => item.service.attachmentUrl)
        .map(item => ({
            filename: `${item.service.title.replace(/\s/g, '_')}.pdf`,
            path: item.service.attachmentUrl!,
        }));

    await sendEmail({
        to: order.customerEmail,
        subject: `Action Required for Your Order #${orderId}`,
        html: emailHtml,
        attachments: attachments,
        replyTo: assignedStaff?.email,
    });

    const emailNote: OrderNote = {
        text: 'Sent "Request Documents" email to client after payment confirmation.',
        date: Timestamp.now(),
        authorId: 'system',
        type: 'email',
        subject: `Action Required for Your Order #${orderId}`,
    };
    await updateDoc(orderRef, { notes: arrayUnion(emailNote) });

    // 3. Create a task for the assigned staff member
    if (assignedStaff?.id) {
        const taskData: Omit<Task, 'id'> = {
            title: `Process Order: ${orderId}`,
            description: `Fulfill the services for order ${orderId}. Services include: ${order.items.map(i => i.title).join(', ')}.`,
            assignedTo: [assignedStaff.id],
            createdBy: 'system',
            createdAt: Timestamp.now(),
            dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
            priority: 'Medium',
            status: 'To-Do',
            orderId: orderId,
            comments: [],
        };
        await addDoc(collection(db, 'tasks'), taskData);

        // 4. Send internal task notification email
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
