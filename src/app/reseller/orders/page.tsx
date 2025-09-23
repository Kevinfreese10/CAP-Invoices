

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
import { MoreHorizontal, Loader2, PlusCircle, Banknote, Building, Clock, ArrowRight } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

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
  const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOutsourceModalOpen, setIsOutsourceModalOpen] = useState(false);
  const [outsourcedOrderDetails, setOutsourcedOrderDetails] = useState<Order | null>(null);
  
  const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];
  
  const fetchOrders = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        
        // Fetch client-facing orders (no originalOrderId)
        const clientOrdersQuery = query(ordersRef, where('resellerId', '==', user.id), where('originalOrderId', '==', null), orderBy('date', 'desc'));
        const clientOrdersSnapshot = await getDocs(clientOrdersQuery);
        let clientOrders = clientOrdersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date.toDate(),
          } as Order;
        });
        setOrders(clientOrders.filter(order => order.status !== 'Cancelled'));

        // Fetch outsourced orders (with originalOrderId)
        const outsourcedOrdersQuery = query(ordersRef, where('resellerId', '==', user.id), where('originalOrderId', '!=', null), orderBy('date', 'desc'));
        const outsourcedOrdersSnapshot = await getDocs(outsourcedOrdersQuery);
        let fetchedOutsourcedOrders = outsourcedOrdersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toDate(),
            } as Order;
        });
        setOutsourcedOrders(fetchedOutsourcedOrders);

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

  useEffect(() => {
    // We are not fetching orders on load to ensure a clean slate.
    // fetchOrders can be called later, for example, by a refresh button.
    setIsLoading(false);
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
            endCustomerName: orderToOutsource.customerName, // Pass the end client's name
            endCustomerEmail: orderToOutsource.customerEmail, // Pass the end client's email
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
            isOutsourced: true,
            status: 'Outsourced',
        });

        fetchOrders(); // Re-fetch all orders to update the UI correctly
        
        setOutsourcedOrderDetails(newOrderData as Order);
        setIsOutsourceModalOpen(true);
        
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
  
  const pendingApprovalOrders = outsourcedOrders.filter(o => o.status === 'Pending Payment');
  const activeOutsourcedOrders = outsourcedOrders.filter(o => o.status !== 'Pending Payment');


  return (
    <>
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
          ) : orders.length === 0 ? (
             <p className="text-center text-muted-foreground py-8">No client orders to display.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
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
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {order.isOutsourced ? (
                            <Badge variant="info">Outsourced</Badge>
                        ) : (
                            <Badge variant="secondary">Internal</Badge>
                        )}
                    </TableCell>
                    <TableCell className="font-semibold">{formatPrice(order.clientTotal || 0)}</TableCell>
                    <TableCell className="text-right">
                    <AlertDialog>
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
                            <Link href={`/reseller/orders/${order.id}`}>View/Add Notes</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <DropdownMenuSub>
                              <DropdownMenuSubTrigger disabled={order.isOutsourced}>Change Status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                  {orderStatuses.map(status => (
                                      <DropdownMenuItem 
                                        key={status} 
                                        onClick={() => handleUpdateStatus(order.id, status)} 
                                        disabled={order.status === status}
                                      >
                                          Mark as {status}
                                      </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                           </DropdownMenuSub>
                          <AlertDialogTrigger asChild>
                             <DropdownMenuItem disabled={order.isOutsourced}>
                               Outsource to My Accountant
                             </DropdownMenuItem>
                           </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will create a new internal order for My Accountant to fulfill. The cost to you will be {formatPrice(order.total)}. You will be shown payment details after confirming. Are you sure you want to proceed?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleOutsource(order)}>
                              Yes, Outsource this Order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Pending Approval</CardTitle>
          <CardDescription>
            These outsourced orders are awaiting your payment to be processed by My Accountant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : pendingApprovalOrders.length === 0 ? (
             <p className="text-center text-muted-foreground py-4">No orders are pending approval.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Original Order</TableHead>
                  <TableHead>Outsourced Date</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovalOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <Button variant="link" asChild className="p-0 h-auto">
                        <Link href={`/reseller/orders/${order.originalOrderId}`}>{order.originalOrderId}</Link>
                      </Button>
                    </TableCell>
                    <TableCell>{format(new Date(order.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-right">
                       <Button onClick={() => { setOutsourcedOrderDetails(order); setIsOutsourceModalOpen(true); }}>
                            Pay Now
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>My Outsourced Orders</CardTitle>
          <CardDescription>
            These are the orders you have sent to My Accountant for fulfillment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : activeOutsourcedOrders.length === 0 ? (
             <p className="text-center text-muted-foreground py-4">You have no active outsourced orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Original Order</TableHead>
                  <TableHead>Outsourced Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOutsourcedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <Button variant="link" asChild className="p-0 h-auto">
                        <Link href={`/reseller/orders/${order.originalOrderId}`}>{order.originalOrderId}</Link>
                      </Button>
                    </TableCell>
                    <TableCell>{format(new Date(order.date), 'dd MMM yyyy')}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
    
    <Dialog open={isOutsourceModalOpen} onOpenChange={setIsOutsourceModalOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Order Outsourced: Payment Required</DialogTitle>
                <DialogDescription>
                    Your new internal order has been created. Please make payment using the details below to begin fulfillment.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                {outsourcedOrderDetails && (
                    <Card>
                        <CardHeader>
                            <CardTitle>New Internal Order</CardTitle>
                            <CardDescription>
                                Order ID: <span className="font-semibold text-primary">{outsourcedOrderDetails.id}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-2">
                                {outsourcedOrderDetails.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <p>{item.title}</p>
                                        <p className="font-medium">{formatPrice(item.price)}</p>
                                    </div>
                                ))}
                            </div>
                            <Separator className="my-3" />
                            <div className="flex justify-between font-bold text-base">
                                <span>Total Due</span>
                                <span>{formatPrice(outsourcedOrderDetails.total)}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}
                 <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Banknote className="h-6 w-6 text-primary" />
                            <CardTitle>EFT Instructions</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="space-y-1">
                            <p className="font-medium">Bank Name:</p>
                            <p className="p-2 bg-muted rounded-md">FNB</p>
                        </div>
                         <div className="space-y-1">
                            <p className="font-medium">Account Holder:</p>
                            <p className="p-2 bg-muted rounded-md">My Accountant (Pty) Ltd</p>
                        </div>
                         <div className="space-y-1">
                            <p className="font-medium">Account Number:</p>
                            <p className="p-2 bg-muted rounded-md">6280 123 4567</p>
                        </div>
                         <div className="space-y-1">
                            <p className="font-medium">Branch Code:</p>
                            <p className="p-2 bg-muted rounded-md">250655</p>
                        </div>
                         <div className="space-y-1">
                            <p className="font-medium">Reference:</p>
                            <p className="p-2 bg-destructive/10 text-destructive rounded-md font-semibold">{outsourcedOrderDetails?.id}</p>
                        </div>
                         <Separator className="my-3" />
                         <p className="font-semibold text-foreground">
                            Please send your proof of payment to{' '}
                            <a href="mailto:info@myacc.co.za" className="text-primary underline">
                                info@myacc.co.za
                            </a>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </DialogContent>
    </Dialog>

    </>
  );
}

    

    

