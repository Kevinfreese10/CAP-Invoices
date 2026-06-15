'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, ArrowRight, Loader2, AlertTriangle, Building, CreditCard, User, Landmark } from 'lucide-react';
import Link from 'next/link';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function OrderConfirmationPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) return;
            setIsLoading(true);
            try {
                const docRef = doc(db, 'orders', orderId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
                }
            } catch (error) {
                console.error("Error fetching order details for confirmation:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading order details...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 p-4 text-center">
                <AlertTriangle className="h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-bold">Order Not Found</h1>
                <p className="text-muted-foreground max-w-md">We couldn't retrieve the details for order reference "{orderId}". Please verify the link or contact support.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center space-y-4 text-center mb-8">
                <div className="rounded-full bg-green-100 p-3 text-green-600">
                    <CheckCircle2 className="h-12 w-12" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Order Received!</h1>
                <p className="text-lg text-muted-foreground max-w-md">
                    Thank you for your order, <span className="font-semibold text-foreground">{order.customerName}</span>. Your request is now being processed.
                </p>
                <div className="flex gap-2">
                    <Badge variant="outline">Reference: {order.id}</Badge>
                    <Badge variant={order.status === 'Pending Payment' ? 'warning' : 'success'}>
                        {order.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <Card className="md:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">Order Summary</CardTitle>
                        <CardDescription>Items in this transaction</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="divide-y">
                            {order.items && order.items.map((item, index) => (
                                <div key={index} className="flex justify-between py-3">
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-sm">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">Qty: {item.quantity || 1}</p>
                                    </div>
                                    <p className="text-sm font-semibold">{formatPrice(item.price * (item.quantity || 1))}</p>
                                </div>
                            ))}
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg pt-2">
                            <span>Total Due</span>
                            <span>{formatPrice(order.total)}</span>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 rounded-b-lg flex flex-col items-start p-4 text-xs text-muted-foreground gap-1.5">
                        <p>Customer Email: <span className="text-foreground font-medium">{order.customerEmail}</span></p>
                        {order.endCustomerName && (
                            <p>End Customer: <span className="text-foreground font-medium">{order.endCustomerName} ({order.endCustomerEmail})</span></p>
                        )}
                    </CardFooter>
                </Card>

                <Card className="border-primary/40 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md font-bold flex items-center gap-2 text-primary">
                            <Landmark className="h-5 w-5" />
                            Manual EFT Payment
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Please make a bank transfer for the total amount due.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="rounded-lg bg-primary/5 p-3.5 space-y-3 font-mono text-xs border border-primary/10">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-sans">Bank</span>
                                <span className="font-semibold text-foreground">First National Bank (FNB)</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-sans">Account Holder</span>
                                <span className="font-semibold text-foreground">CAP Portal (Pty) Ltd</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-sans">Account Number</span>
                                <span className="font-semibold text-foreground">62000000000</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-sans">Branch Code</span>
                                <span className="font-semibold text-foreground">250655</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-[red] uppercase tracking-wider font-sans font-bold">Payment Reference</span>
                                <span className="font-bold text-foreground bg-yellow-100 px-1 py-0.5 rounded w-max">{order.id}</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            💡 Send your proof of payment to <span className="font-semibold text-foreground">billing@myacc.co.za</span> once complete to speed up your order processing.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
                <Button asChild>
                    <Link href={`/dashboard/orders/${order.id}`}>
                        Submit Documents
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
