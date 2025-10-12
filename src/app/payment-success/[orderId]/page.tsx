

'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User } from '@/lib/types';
import { Loader2, CheckCircle, Clock, ClipboardCheck, User as UserIcon } from 'lucide-react';
import { services as allServices } from '@/lib/data';
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
        if (orderId) {
            const fetchOrderDetails = async () => {
                setIsLoading(true);
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);

                if (orderSnap.exists()) {
                    const orderData = orderSnap.data() as Order;
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

            // It can take a moment for the ITN to update the order status.
            // We'll poll a few times to give it a chance to complete.
            let attempts = 0;
            const interval = setInterval(() => {
                fetchOrderDetails();
                attempts++;
                if (attempts > 5 || (order && order.status === 'Processing')) {
                    clearInterval(interval);
                }
            }, 2000);
            
            return () => clearInterval(interval);

        }
    }, [orderId, order?.status]);
    
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
                        <h3 className="font-semibold text-lg mb-2">Next Steps: Required Documents</h3>
                         <p className="text-sm text-muted-foreground mb-4">
                            To get started, please prepare the following documents. You will receive an email shortly with instructions on where to upload them.
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
