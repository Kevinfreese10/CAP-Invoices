'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const allOrders = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date.toDate(),
          } as Order;
        });
        setOrders(allOrders);
      } catch (error) {
        console.error("Error fetching orders: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Manage Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Client Orders</CardTitle>
          <CardDescription>View and manage all orders in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{format(new Date(order.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">R {order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View Order</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Completed</DropdownMenuItem>
                          <DropdownMenuItem>Cancel Order</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
