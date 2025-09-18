'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import DocumentUpload from '@/components/dashboard/DocumentUpload';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!params.id) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'orders', params.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
          } as Order);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching order details: ", error);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [params.id]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!order) {
    return notFound();
  }

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/dashboard/orders">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Order {order.id}</CardTitle>
                <CardDescription>
                Date: {format(new Date(order.date), 'dd MMMM yyyy')} | Status: <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'}>{order.status}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                {order.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                    </div>
                    <p>R {item.price.toFixed(2)}</p>
                    </div>
                ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R {order.total.toFixed(2)}</span>
                </div>
            </CardContent>
        </Card>

        <DocumentUpload orderId={order.id} />
    </div>
  );
}
