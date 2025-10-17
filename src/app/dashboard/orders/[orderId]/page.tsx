
'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ClientOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.orderId as string;

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'orders', id);
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
  }, [id]);

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Processing':
        return 'info';
      case 'Pending Payment':
        return 'warning';
      case 'Cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };
  
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
                <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id}</CardTitle>
                        <CardDescription>
                        Date: {format(new Date(order.date), 'dd MMMM yyyy')} | Status: <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{item.title}</p>
                            </div>
                            <p>{formatPrice(item.price)}</p>
                            </div>
                        ))}
                        </div>
                        <Separator className="my-4" />
                        <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <div className="lg:col-span-1 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Upload Documents</CardTitle>
                        <CardDescription>Upload the required documents for this order.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Files
                        </Button>
                    </CardContent>
                 </Card>
             </div>
        </div>
    </div>
  );
}
