
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight, Banknote, Building, Clock, MoreHorizontal, PlusCircle, BrainCircuit, Briefcase, Users, CheckCircle, BadgeDollarSign, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Order, Service, User } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { services as allServices } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import CreateResellerOrderForm from '@/components/reseller/CreateResellerOrderForm';
import CommunityQnA from '@/components/reseller/CommunityQnA';
import { useRouter } from 'next/navigation';

const db = getFirestore(firebaseApp);

export default function ResellerDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();
    const [orders, setOrders] = useState<Order[]>([]);
    const [outsourcedOrders, setOutsourcedOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isOutsourceModalOpen, setIsOutsourceModalOpen] = useState(false);
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    const [outsourcedOrderDetails, setOutsourcedOrderDetails] = useState<Order | null>(null);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const staffCounters = useRef<{ [key: string]: number }>({});
    
    const orderStatuses: Order['status'][] = ['Pending Payment', 'Processing', 'Completed', 'Cancelled'];

    const getNextStaffMember = (department: 'Accounting and Tax' | 'Administration' | 'CAP'): User | undefined => {
      const staffInDept = allStaff.filter(u => u.role === 'staff' && u.department === department);
      if (staffInDept.length === 0) return undefined;

      const currentIndex = staffCounters.current[department] || 0;
      const nextStaff = staffInDept[currentIndex];
      
      staffCounters.current[department] = (currentIndex + 1) % staffInDept.length;
      
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
            router.push(`/order-confirmation/${newOrderId}`);
    
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
    
    const handleOrderCreated = () => {
        setIsCreateOrderOpen(false);
        fetchOrdersAndStaff();
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
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle>Become a Premium Member</CardTitle>
                        <CardDescription>Upgrade to unlock powerful tools to automate and scale your practice.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-4">
                            <BrainCircuit className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold">AI Accountant</h4>
                                <p className="text-sm text-muted-foreground">Upload your CSV bank statements and let our AI Accountant do the heavy lifting. It automatically allocates all transactions within minutes — perfectly categorized and VAT-ready. Review, adjust, and finalize your books with just a few clicks, saving hours of manual work every month.</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <Briefcase className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold">Practice Manager</h4>
                                <p className="text-sm text-muted-foreground">Easily manage your clients and deadlines in one place. When you add a new client, the system automatically creates related tasks, due dates, and compliance reminders — keeping your practice organized and your workflow seamless.</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <Users className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold">White-Label Outsourcing</h4>
                                <p className="text-sm text-muted-foreground">Offer professional accounting and compliance products under your own brand. Our team communicates with your clients directly through your email, ensuring your brand identity stays intact while we handle the work in the background.</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="pt-4">
                            <CardTitle>Premium Member Pricing</CardTitle>
                            <CardDescription>Upgrade your practice with automation, white-label outsourcing, and AI-powered tools — all at an affordable monthly rate.</CardDescription>
                            <div className="grid md:grid-cols-3 gap-6 mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><BadgeDollarSign /> Monthly Subscription</CardTitle>
                                        <p className="text-3xl font-bold">R290<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <p className="text-muted-foreground">Get full access to the Premium platform and unlock:</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> AI Accountant access</li>
                                            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Practice Manager</li>
                                            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> White-Label Outsourcing</li>
                                            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 25% discount on all products</li>
                                            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Partner support & client dashboard</li>
                                        </ul>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><BrainCircuit /> AI Accountant Usage</CardTitle>
                                        <p className="text-3xl font-bold">R450<span className="text-sm font-normal text-muted-foreground">/client/month</span></p>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                                        <p>Add AI automation to any of your client profiles.</p>
                                        <p>Upload their CSV or bank statements — and the AI Accountant will allocate and categorize all transactions in minutes.</p>
                                        <p className="font-semibold text-foreground">Pay only for the clients you activate AI products for.</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><UserPlus /> Additional Users</CardTitle>
                                        <p className="text-3xl font-bold">R50<span className="text-sm font-normal text-muted-foreground">/user/month</span></p>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                                        <p>Invite your staff or junior bookkeepers to your dashboard and manage client work collaboratively.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Dialog>
                            <DialogTrigger asChild>
                                 <Button>Upgrade to Premium</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirm Your Subscription</DialogTitle>
                                    <DialogDescription>Please make payment to the details below to activate your premium membership.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                     <div className="space-y-2">
                                        <p className="text-sm font-medium">Bank Name:</p>
                                        <p className="text-lg font-semibold p-2 bg-muted rounded-md">FNB</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Account Holder:</p>
                                        <p className="text-lg font-semibold p-2 bg-muted rounded-md">My Accountant (Pty) Ltd</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Amount:</p>
                                        <p className="text-lg font-semibold p-2 bg-muted rounded-md">R 290.00</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Reference:</p>
                                        <p className="text-lg font-semibold p-2 bg-destructive/10 text-destructive rounded-md">{user?.email}</p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <p className="text-xs text-muted-foreground">Your premium membership will be activated once payment is confirmed.</p>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>
            </section>
            
            <section>
              <CommunityQnA />
            </section>

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
                                                <p className="text-xs text-muted-foreground">{format(new Date(post.date), 'dd/MM/yyyy')}</p>
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
                <div className="flex items-center justify-between">
                    <div>
                    <CardTitle>Your Client Orders</CardTitle>
                    <CardDescription>
                        View and manage all orders you've created for your clients.
                    </CardDescription>
                    </div>
                     <Dialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen}>
                        <DialogTrigger asChild>
                             <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create New Order
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-4xl">
                             <DialogHeader>
                                <DialogTitle>New Order Details</DialogTitle>
                                <DialogDescription>Fill out the form below to create a new order for a client.</DialogDescription>
                            </DialogHeader>
                            <CreateResellerOrderForm onOrderCreated={handleOrderCreated} />
                        </DialogContent>
                    </Dialog>
                </div>
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
                       <Button asChild>
                           <Link href={`/order-confirmation/${order.id}`}>Pay Now</Link>
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
    </>
    );
}
