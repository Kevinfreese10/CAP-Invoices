

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
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
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};


export default function OutsourcedOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const ordersRef = collection(db, 'orders');
        // Query for orders that belong to this reseller AND have an originalOrderId,
        // which marks them as outsourced orders.
        const q = query(ordersRef, where('resellerId', '==', user.id), where('originalOrderId', '!=', null), orderBy('date', 'desc'));

        const querySnapshot = await getDocs(q);
        let allOrders = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date.toDate(),
          } as Order;
        });
        
        setOrders(allOrders.filter(order => order.status !== 'Cancelled'));
      } catch (error) {
        console.error("Error fetching orders: ", error);
        toast({
            title: 'Error Fetching Orders',
            description: 'Could not load your outsourced orders. Please try again later.',
            variant: 'destructive',
        })
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
        fetchOrders();
    }
  }, [user, toast]);

  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allStaff.find(u => u.id === userId);
  }

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


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Outsourced Orders</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>
            These are the orders you have outsourced to My Accountant for fulfillment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
             orders.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">You haven't outsourced any orders yet.</p>
                     <Button asChild className="mt-4">
                        <Link href="/reseller/orders">View Client Orders</Link>
                    </Button>
                </div>
             ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Outsourced Date</TableHead>
                    <TableHead>Original Order ID</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Outsourcing Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => {
                    const assignee = getAssignee(order.assignedTo?.[0]);
                    return (
                    <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                            <Button variant="link" asChild className="p-0 h-auto font-semibold">
                                <Link href={`/reseller/orders/${order.originalOrderId}`}>{order.originalOrderId}</Link>
                            </Button>
                        </TableCell>
                         <TableCell>
                            {assignee ? (
                                <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${assignee.email}`} alt={assignee.name} />
                                        <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                    <p>{assignee.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <span className="text-muted-foreground">N/A</span>
                            )}
                        </TableCell>
                        <TableCell>
                        <Badge variant={getStatusVariant(order.status)}>
                            {order.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatPrice(order.total)}</TableCell>
                        <TableCell className="text-right">
                         <Button variant="ghost" size="icon" asChild>
                            <Link href={`/reseller/outsourced-orders/${order.id}`}>
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                        </TableCell>
                    </TableRow>
                    )})}
                </TableBody>
                </Table>
             )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
