
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { Loader2, CheckCircle, Banknote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { services as allServices } from '@/lib/data';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function PaymentSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [assignee, setAssignee] = useState<User | null>(null);
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (orderId) {
            const fetchOrderDetails = async () => {
                setIsLoading(true);
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);

                if (orderSnap.exists()) {
                    const orderData = { ...orderSnap.data(), id: orderSnap.id } as Order;
                    
                     if (orderData.status !== 'Processing') {
                        // Update status to 'Processing'
                        await updateDoc(orderRef, { status: 'Processing' });
                        orderData.status = 'Processing';

                        const itemsWithServices = orderData.items.map(item => {
                            const service = allServices.find(s => s.id === item.id);
                            return { ...item, service };
                        }).filter(item => item.service) as { service: Service }[];

                        const emailHtml = render(<DocumentRequestEmail order={orderData} items={itemsWithServices} replyTo="info@myacc.co.za" />);
                        
                        const attachments = itemsWithServices
                            .filter(item => item.service.attachmentUrl)
                            .map(item => ({
                                filename: `${item.service.title.replace(/\s/g, '_')}.pdf`,
                                path: item.service.attachmentUrl!,
                            }));
                        
                        try {
                            await sendEmail({
                                to: orderData.customerEmail,
                                bcc: 'kev@thinkestry.co.za',
                                subject: `Action Required for Your Order #${orderId}`,
                                html: emailHtml,
                                attachments: attachments,
                            });
                             const emailNote: OrderNote = {
                                text: 'Sent "Request Documents" email to client after payment.',
                                date: Timestamp.now(),
                                authorId: 'system', // System-sent
                                type: 'email',
                                subject: `Action Required for Your Order #${orderId}`,
                            };
                            await updateDoc(orderRef, { notes: arrayUnion(emailNote) });
                        } catch(e) {
                             console.error("Failed to send document request email:", e);
                             toast({ title: 'Email Failed', description: 'Could not send document request email.', variant: 'destructive'});
                        }

                    }
                    
                    setOrder(orderData);

                    if (orderData.assignedTo && orderData.assignedTo.length > 0) {
                         const staffQuery = query(collection(db, "users"), where('uid', '==', orderData.assignedTo[0]));
                         const staffSnapshot = await getDocs(staffQuery);
                         if (!staffSnapshot.empty) {
                             setAssignee(staffSnapshot.docs[0].data() as User);
                         }
                    }
                } else {
                    notFound();
                }
                setIsLoading(false);
            };

            fetchOrderDetails();
        } else {
            // No order ID, redirect to dashboard or home
            router.push(user ? '/dashboard' : '/');
        }
    }, [orderId, toast, user, router]);
    
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Finalizing your order...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </div>
        );
    }
    
    if (!order) {
        return notFound();
    }

    const orderedServices = order.items.map(item => {
        return allServices.find(s => s.id === item.id);
    }).filter((s): s is Service => s !== undefined);


    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Payment Received!</CardTitle>
                    <CardDescription>
                       Thank you for your payment. Your order is now being processed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <section>
                        <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                           <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono">{order.id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order Date:</span>
                                <span>{new Date(order.date.seconds * 1000).toLocaleDateString()}</span>
                            </div>
                            <Separator />
                            {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <p>{item.title}</p>
                                    <p className="font-semibold">{formatPrice(item.price)}</p>
                                </div>
                            ))}
                             <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <p>Total Paid</p>
                                <p>{formatPrice(order.total)}</p>
                            </div>
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="font-semibold text-lg mb-2">Next Steps: Required Documents</h3>
                         <p className="text-sm text-muted-foreground mb-4">
                            To get started, please check your email for instructions on where to upload the following documents. You can also upload them directly in your client dashboard.
                        </p>
                         <div className="space-y-4">
                            {orderedServices.map(service => (
                                <div key={service.id}>
                                    <h4 className="font-semibold">{service.title}</h4>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
                                        {service.clientRequirements.map((req, index) => (
                                            <li key={index}>{req}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    <div className="text-center pt-4">
                        <Button asChild>
                            <Link href="/dashboard/orders">Go to My Dashboard</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
