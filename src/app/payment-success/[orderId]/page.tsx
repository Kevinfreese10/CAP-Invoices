
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
    const router = useRouter();
    const { user, isAuthenticated, login } = useAuth();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (!orderId) return;

        const fetchOrderDetails = async () => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);

            if (orderSnap.exists()) {
                const orderData = orderSnap.data() as Order;

                if (orderData.status !== 'Processing' && orderData.status !== 'Completed') {
                    // Still pending, ITN might be slow.
                    return; // Wait for the next poll.
                }

                if (orderData.source === 'AI Accountant Signup') {
                    // If it's a signup order and the user is not logged in, attempt to log them in.
                    if (!isAuthenticated) {
                        const signupData = (orderData as any).signupData;
                        if (signupData?.email && signupData?.password) {
                            await login(signupData.email, signupData.password);
                        }
                    }
                    // Redirect to dashboard after login or if already logged in.
                    router.replace('/admin/ai-accountant');
                    return;
                }
                
                // For regular orders, send document request if not already sent.
                if (!orderData.notes?.some(n => n.subject === `Action Required for Your Order #${orderId}`)) {
                    const itemsWithServices = orderData.items.map(item => {
                        const service = allServices.find(s => s.id === item.id);
                        return { ...item, service };
                    }).filter(item => item.service) as { service: Service }[];

                    const emailHtml = render(<DocumentRequestEmail order={orderData} items={itemsWithServices} replyTo="info@myacc.co.za" />);
                    
                    const attachments = itemsWithServices.filter(item => item.service.attachmentUrl).map(item => ({
                        filename: `${item.service.title.replace(/\s/g, '_')}.pdf`,
                        path: item.service.attachmentUrl!,
                    }));
                    
                    try {
                        await sendEmail({ to: orderData.customerEmail, subject: `Action Required for Your Order #${orderId}`, html: emailHtml, attachments });
                        const emailNote: OrderNote = { text: 'Sent "Request Documents" email to client after payment.', date: Timestamp.now(), authorId: 'system', type: 'email', subject: `Action Required for Your Order #${orderId}` };
                        await updateDoc(orderRef, { notes: arrayUnion(emailNote) });
                    } catch(e) {
                         console.error("Failed to send document request email:", e);
                    }
                }
                
                setOrder(orderData);
                setIsFinalizing(false);
                
                // If a logged-in client lands here, redirect to their order details page.
                if (isAuthenticated && user?.role === 'client') {
                    router.replace(`/dashboard/orders/${orderId}`);
                    return;
                }

            } else {
                setIsFinalizing(false);
                notFound();
            }
            setIsLoading(false);
        };
        
        let attempts = 0;
        const interval = setInterval(() => {
            if (attempts < 5 && isFinalizing) {
                fetchOrderDetails();
                attempts++;
            } else {
                clearInterval(interval);
                if (isFinalizing) {
                  // If still finalizing after multiple attempts, stop loading and show the page.
                  setIsLoading(false);
                  setIsFinalizing(false);
                  if(!order) fetchOrderDetails(); // One last try
                }
            }
        }, 2000);

        return () => clearInterval(interval);

    }, [orderId, isAuthenticated, user, router, login, isFinalizing, order]);
    
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
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                 <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                 <h1 className="mt-4 text-2xl font-semibold">Waiting for Payment Confirmation</h1>
                 <p className="text-muted-foreground">We are still waiting for the payment notification from PayFast. This page will update automatically.</p>
            </div>
        )
    }
    
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Order Placed Successfully!</CardTitle>
                    <CardDescription>
                        Thank you for your order. We have received your payment and will begin processing your services shortly. An email confirmation has been sent to you.
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
                            <Separator />
                            {order.items.map((item: any, index: number) => (
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
                    
                    <div className="text-center pt-4">
                        <Button asChild>
                            <Link href="/">Back to Homepage</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
