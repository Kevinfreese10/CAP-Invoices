'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/lib/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', user.id), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const userOrders = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toDate(), // Convert Firestore Timestamp to JS Date
            } as Order;
        });
        setOrders(userOrders);
      } catch (error) {
        console.error("Error fetching orders: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [user]);


  return (
    <Card>
        <CardHeader>
            <CardTitle>My Orders</CardTitle>
            <CardDescription>Here is a list of your recent orders.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : orders.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">You haven't placed any orders yet.</p>
                    <Button asChild className="mt-4">
                        <Link href="/services">Browse Services</Link>
                    </Button>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[150px]">Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{format(new Date(order.date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                                <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'}>
                                    {order.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">R {order.total.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/dashboard/orders/${order.id}`}>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
    </Card>
  );
}
