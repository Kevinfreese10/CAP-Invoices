

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { services as allServices } from '@/lib/data';
import { users } from '@/lib/data';
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
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

// Simple round-robin counter for staff assignment
let staffCounters: { [key: string]: number } = {};

const getNextStaffMember = (department: 'Accounting and Tax' | 'Administration'): User | undefined => {
    const staffInDept = users.filter(u => u.role === 'staff' && u.department === department);
    if (staffInDept.length === 0) return undefined;

    if (staffCounters[department] === undefined) {
        staffCounters[department] = 0;
    }

    const staffMember = staffInDept[staffCounters[department]];
    staffCounters[department] = (staffCounters[department] + 1) % staffInDept.length;
    
    return staffMember;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};


export default function ResellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('resellerId', '==', user.id), orderBy('date', 'desc'));

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
            description: 'Could not load your orders. Please try again later.',
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

  const handleOutsource = async (orderToOutsource: Order) => {
    if (!user) return;
    
    toast({
        title: 'Outsourcing Order...',
        description: `Submitting order ${orderToOutsource.id} to My Accountant.`
    });

    try {
        const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
        const firstServiceId = orderToOutsource.items[0]?.id;
        const serviceDetails = allServices.find(s => s.id === firstServiceId);
        const department = serviceDetails?.department;
        
        const newOrderData: Partial<Order> = {
            id: newOrderId,
            customerName: user.companyName || user.name, // The customer is the reseller
            customerEmail: user.email,
            date: Timestamp.now(),
            items: orderToOutsource.items.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price, // This is the reseller's cost
                quantity: item.quantity,
            })),
            total: orderToOutsource.total,
            status: 'Pending Payment', // The new order for the admin is 'Pending Payment'
            resellerId: user.id, // Link back to the reseller
            originalOrderId: orderToOutsource.id, // Link to the original order
        };
        
        if (department) {
          const assignedStaff = getNextStaffMember(department);
          newOrderData.department = department;
          newOrderData.assignedTo = assignedStaff?.id || null;
        } else {
            newOrderData.department = null;
            newOrderData.assignedTo = null;
        }
        
        await setDoc(doc(db, 'orders', newOrderId), newOrderData);

        // Update the original order to mark it as outsourced
        const originalOrderRef = doc(db, 'orders', orderToOutsource.id);
        await updateDoc(originalOrderRef, {
            status: 'Outsourced',
            isOutsourced: true
        });

        // Update local state to reflect the change immediately
        setOrders(prevOrders =>
            prevOrders.map(order =>
                order.id === orderToOutsource.id ? { ...order, status: 'Outsourced', isOutsourced: true } : order
            )
        );
        
        toast({
            title: 'Order Outsourced Successfully!',
            description: `Your order has been sent to My Accountant for processing. New order ID: ${newOrderId}`
        });

    } catch (error) {
         console.error('Error outsourcing order: ', error);
        toast({
            title: 'Outsourcing Failed',
            description: 'There was a problem submitting your order. Please try again.',
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

      if (newStatus === 'Cancelled') {
        // If an order is cancelled, we remove it from the list after a brief moment
        setTimeout(() => {
          setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
        }, 500);
      }
    } catch (error) {
      console.error('Error updating order status: ', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem updating the order status.',
        variant: 'destructive',
      });
    }
  };

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Processing':
        return 'info';
      case 'Outsourced':
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
          <Link href="/reseller/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Custom Order
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Client Orders</CardTitle>
          <CardDescription>
            View and manage all orders you've created for your clients.
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
                  <TableHead>Status</TableHead>
                  <TableHead>Outsourcing Cost</TableHead>
                  <TableHead>Selling Price</TableHead>
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
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.isOutsourced ? 'Outsourced' : order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{formatPrice(order.total)}</TableCell>
                    <TableCell className="font-semibold">{formatPrice(order.clientTotal || 0)}</TableCell>
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
                            <Link href={`/reseller/orders/${order.id}`}>Review Order</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <DropdownMenuItem 
                                onClick={() => handleOutsource(order)}
                                disabled={order.isOutsourced || order.status !== 'Pending Payment'}>
                             Outsource to My Accountant
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                            className="text-destructive"
                            disabled={order.status === 'Cancelled' || order.isOutsourced}
                          >
                            Cancel Order
                          </DropdownMenuItem>
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
