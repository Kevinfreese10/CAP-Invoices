
'use client';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2, CheckCircle, Banknote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

export default function OrderConfirmationPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (orderId) {
            const fetchOrder = async () => {
                setIsLoading(true);
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);
                if (orderSnap.exists()) {
                    setOrder({ ...orderSnap.data(), id: orderSnap.id } as Order);
                } else {
                    notFound();
                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Loading Your Order Confirmation...</h1>
            </div>
        );
    }

    if (!order) {
        return notFound();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card>
                <CardHeader className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <CardTitle className="text-3xl mt-4">Order Placed Successfully!</CardTitle>
                    <CardDescription>
                        Thank you for your order. Please use the banking details below to complete your payment via EFT.
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
                                <p>Total Due</p>
                                <p>{formatPrice(order.total)}</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Banknote/> EFT Payment Details</h3>
                         <div className="border rounded-lg p-4 space-y-3">
                            <div className="grid grid-cols-[150px_1fr] items-center">
                                <span className="font-medium text-muted-foreground">Bank Name:</span>
                                <span className="font-semibold">FNB</span>
                            </div>
                            <div className="grid grid-cols-[150px_1fr] items-center">
                                <span className="font-medium text-muted-foreground">Account Holder:</span>
                                <span className="font-semibold">My Accountant (Pty) Ltd</span>
                            </div>
                            <div className="grid grid-cols-[150px_1fr] items-center">
                                <span className="font-medium text-muted-foreground">Account Number:</span>
                                <span className="font-semibold">63084378223</span>
                            </div>
                            <div className="grid grid-cols-[150px_1fr] items-center">
                                <span className="font-medium text-muted-foreground">Branch Code:</span>
                                <span className="font-semibold">250655</span>
                            </div>
                             <div className="grid grid-cols-[150px_1fr] items-center mt-2">
                                <span className="font-medium text-muted-foreground">Reference:</span>
                                <span className="font-semibold text-destructive p-1 bg-destructive/10 rounded-sm">{order.id}</span>
                            </div>
                         </div>
                    </section>
                    
                    <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">An email with these payment details has been sent to you.</p>
                        <Button asChild className="mt-4">
                            <Link href="/">Back to Homepage</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
