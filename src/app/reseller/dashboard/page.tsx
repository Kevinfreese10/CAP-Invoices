
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight, Banknote, Building, Clock, MoreHorizontal, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Order, Service, User } from '@/lib/types';
import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { services as allServices } from '@/lib/data';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

export default function ResellerDashboardPage() {
    const { user } = useAuth();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();
    const [orders, setOrders] = useState<Order[]>([]);
    const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isOutsourceModalOpen, setIsOutsourceModalOpen] = useState(false);
    const [outsourcedOrderDetails, setOutsourcedOrderDetails] = useState<Order | null>(null);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [staffCounters, setStaffCounters] = useState<{ [key: string]: number }>({});
    
    const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];

    const getNextStaffMember = (department: 'Accounting and Tax' | 'Administration' | 'CAP'): User | undefined => {
      const staffInDept = allStaff.filter(u => u.role === 'staff' && u.department === department);
      if (staffInDept.length === 0) return undefined;

      const currentIndex = staffCounters[department] || 0;
      const nextStaff = staffInDept[currentIndex];
      
      setStaffCounters(prev => ({
          ...prev,
          [department]: (currentIndex + 1) % staffInDept.length
      }));
      
      return nextStaff;
    };

    const fetchOrdersAndStaff = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      };
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const ordersRef = collection(db, 'orders');
        
        const clientOrdersQuery = query(ordersRef, where('resellerId', '==', user.uid), where('originalOrderId', '==', null), orderBy('date', 'desc'));
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

        const outsourcedOrdersQuery = query(ordersRef, where('resellerId', '==', user.uid), where('originalOrderId', '!=', null), orderBy('date', 'desc'));
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
        if (user) {
            fetchOrdersAndStaff();
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
            customerName: user.companyName || user.name,
            customerEmail: user.email,
            endCustomerName: orderToOutsource.customerName,
            endCustomerEmail: orderToOutsource.customerEmail,
            date: Timestamp.now(),
            items: orderToOutsource.items.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
            })),
            total: orderToOutsource.total,
            status: 'Pending Payment',
            resellerId: user.uid,
            originalOrderId: orderToOutsource.id,
        };
        
        if (department) {
          const assignedStaff = getNextStaffMember(department);
          newOrderData.department = department;
          newOrderData.assignedTo = assignedStaff?.id ? [assignedStaff.id] : null;
        } else {
            newOrderData.department = null;
            newOrderData.assignedTo = null;
        }
        
        await setDoc(doc(db, 'orders', newOrderId), newOrderData);

        const originalOrderRef = doc(db, 'orders', orderToOutsource.id);
        await updateDoc(originalOrderRef, {
            isOutsourced: true,
            status: 'Outsourced',
        });

        fetchOrdersAndStaff();
        
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: price % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
        }).format(price);
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

    const latestNews = blogPosts.slice(0, 3);
    const pendingApprovalOrders = outsourcedOrders.filter(o => o.status === 'Pending Payment');
    const activeOutsourcedOrders = outsourcedOrders.filter(o => o.status !== 'Pending Payment');

    return (
        <>
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.contactPerson}!</h1>
                <p className="text-lg text-muted-foreground">{user?.companyName}</p>
            </div>

            <section>
                <WebsiteAIWidget />
            </section>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Create New Order</CardTitle>
                        <CardDescription>Create a custom order for your clients.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-end">
                        <Button asChild>
                            <Link href="/reseller/orders/new">Create Order</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Manage Orders</CardTitle>
                        <CardDescription>View history and status of all your orders.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-end">
                        <Button asChild>
                            <Link href="/reseller/orders">View Orders</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Latest News</CardTitle>
                        <CardDescription>Stay up-to-date with the latest tax tips and articles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isBlogLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {latestNews.map(post => (
                                    <div key={post.id} className="group">
                                        <Link href={`/blog/${post.slug}`} className="block">
                                            <div className="relative h-40 w-full overflow-hidden rounded-lg">
                                                <Image
                                                    src={post.imageUrl}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    data-ai-hint={post.imageHint}
                                                />
                                            </div>
                                            <div className="mt-3">
                                                <p className="text-sm font-semibold group-hover:text-primary">{post.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(post.date), 'dd MMMM yyyy')}</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>

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
                    <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
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
                    <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
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
                {activeOutsourcedOrders.map((order) => {
                  return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <Button variant="link" asChild className="p-0 h-auto">
                        <Link href={`/reseller/orders/${order.originalOrderId}`}>{order.originalOrderId}</Link>
                      </Button>
                    </TableCell>
                    <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/reseller/outsourced-orders/${order.id}`}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                View Details & History
                            </Link>
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
