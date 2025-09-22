

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc } from 'firebase/firestore';
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
import { MoreHorizontal, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { users as allUsers } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const db = getFirestore(firebaseApp);

const allStaff = allUsers.filter(u => u.role === 'staff');

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        let filteredOrders: Order[] = [];

        if (user?.role === 'staff') {
          // Staff view: only see orders assigned to them
          const q = query(ordersRef, where('assignedTo', '==', user.id), orderBy('date', 'desc'));
          const querySnapshot = await getDocs(q);
          filteredOrders = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date.toDate(),
            } as Order;
          });
        } else {
          // Admin view: See main store orders OR outsourced reseller orders
          const allOrdersSnapshot = await getDocs(query(ordersRef, orderBy('date', 'desc')));
          filteredOrders = allOrdersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date.toDate(),
            } as Order;
          }).filter(order => !order.resellerId || (order.resellerId && order.originalOrderId));
        }
        
        setOrders(filteredOrders);
      } catch (error) {
        console.error("Error fetching orders: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
        fetchOrders();
    }
  }, [user]);

   const handleAssignment = async (orderId: string, staffId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        assignedTo: staffId,
      });

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, assignedTo: staffId } : order
        )
      );

      toast({
        title: 'Order Assigned',
        description: `Order has been successfully assigned.`,
      });
    } catch (error) {
      console.error('Error assigning order: ', error);
      toast({
        title: 'Assignment Failed',
        description: 'There was a problem assigning the order.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
      });

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating order status: ', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem updating the order status.',
        variant: 'destructive',
      });
    }
  };

  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allUsers.find(u => u.id === userId);
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
        <h1 className="text-3xl font-bold tracking-tight">Manage Orders</h1>
        <Button asChild>
          <Link href="/admin/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Custom Order
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Client Orders</CardTitle>
          <CardDescription>
            {user?.role === 'staff' ? 'Showing all orders assigned to you.' : 'View and manage all orders in the system.'}
          </CardDescription>
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
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const assignee = getAssignee(order.assignedTo);
                  return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{format(new Date(order.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
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
                    <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
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
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orders/${order.id}`}>View Order</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user?.role === 'admin' && (
                             <>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Assign To</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {allStaff.map(staff => (
                                      <DropdownMenuItem 
                                        key={staff.id} 
                                        onClick={() => handleAssignment(order.id, staff.id)}
                                        disabled={order.assignedTo === staff.id}
                                      >
                                        {staff.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                             </>
                          )}
                           <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, 'Pending Payment')}
                             disabled={order.status === 'Pending Payment'}
                          >
                            Mark as Pending Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, 'Processing')}
                             disabled={order.status === 'Processing'}
                          >
                            Mark as Processing
                          </DropdownMenuItem>
                           <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, 'Completed')}
                            disabled={order.status === 'Completed'}
                          >
                            Mark as Completed
                          </DropdownMenuItem>
                           <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                            className="text-destructive"
                            disabled={order.status === 'Cancelled'}
                          >
                            Cancel Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    