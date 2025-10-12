
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User } from '@/lib/types';
import { Loader2, CheckCircle, User as UserIcon } from 'lucide-react';
import { allServices } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

export default function PaymentSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [assignee, setAssignee] = useState<User | null>(null);

    useEffect(() => {
        if (!orderId) {
            setIsLoading(false);
            return;
        }

        const fetchOrderDetails = async () => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);

            if (orderSnap.exists()) {
                const orderData = orderSnap.data() as Order;
                setOrder(orderData);

                if (orderData.status === 'Processing') {
                    if (orderData.assignedTo && orderData.assignedTo.length > 0) {
                         const staffQuery = query(collection(db, "users"), where('uid', '==', orderData.assignedTo[0]));
                         const staffSnapshot = await getDocs(staffQuery);
                         if (!staffSnapshot.empty) {
                             setAssignee(staffSnapshot.docs[0].data() as User);
                         }
                    }
                    setIsLoading(false);
                    return true; // Stop polling
                }
            } else {
                setIsLoading(false);
                notFound();
                return true; // Stop polling
            }
            return false; // Continue polling
        };
        
        let attempts = 0;
        const interval = setInterval(async () => {
            const shouldStop = await fetchOrderDetails();
            attempts++;
            if (shouldStop || attempts > 5) {
                clearInterval(interval);
                setIsLoading(false); // Stop loading even if status didn't change
            }
        }, 3000);

        return () => clearInterval(interval);

    }, [orderId]);
    
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Finalizing your order...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </div>
        );
    }
    
    if (!order || order.status !== 'Processing') {
        return (
             <div className="container mx-auto px-4 py-20 text-center">
                <h1 className="mt-4 text-2xl font-semibold">Waiting for Payment Confirmation</h1>
                <p className="text-muted-foreground">We are waiting for the payment provider to confirm your transaction. This page will update automatically.</p>
            </div>
        );
    }

    const orderedServices = order.items.map(item => {
        return allServices.find(s => s.id === item.id);
    }).filter((s): s is Service => s !== undefined);


    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Payment Successful!</CardTitle>
                    <CardDescription>
                        Thank you for your order. We have received your payment and will begin processing your services shortly.
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
                                    <p className="font-semibold">R {item.price.toFixed(2)}</p>
                                </div>
                            ))}
                             <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <p>Total Paid</p>
                                <p>R {order.total.toFixed(2)}</p>
                            </div>
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="font-semibold text-lg mb-2">What Happens Next?</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">Order Status Updated</p>
                                    <p className="text-sm text-muted-foreground">Your order status has been set to "Processing".</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">Order Allocated</p>
                                    <p className="text-sm text-muted-foreground">
                                        Your order has been assigned to a consultant who will manage the fulfillment.
                                        {assignee && <span className="font-bold"> ({assignee.name})</span>}
                                    </p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">Documents Requested</p>
                                    <p className="text-sm text-muted-foreground">An email has been sent to you with a list of required documents to get started. Please check your inbox (and spam folder).</p>
                                </div>
                            </div>
                        </div>
                    </section>
                    
                    {assignee && (
                         <section>
                            <h3 className="font-semibold text-lg mb-2">Your Consultant</h3>
                            <div className="border rounded-lg p-4 flex items-center gap-4">
                                <UserIcon className="h-8 w-8 text-primary"/>
                                <div>
                                    <p className="font-semibold">{assignee.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Your order has been assigned. You can contact them directly with any questions.
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}
                    
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
