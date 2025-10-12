

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, Timestamp, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, OrderNote, Task, ItnLog } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { services as allServices } from '@/lib/data';
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
import { MoreHorizontal, Loader2, PlusCircle, MessageSquare } from 'lucide-react';
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
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import ReviewRequestEmail from '@/components/emails/ReviewRequestEmail';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';


const db = getFirestore(firebaseApp);

function BackendSummaryModal({ order }: { order: Order }) {
  if (!order.itnHistory || order.itnHistory.length === 0) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backend Summary for Order {order.id}</DialogTitle>
          <DialogDescription>No backend notifications have been received for this order yet.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Backend Summary for Order {order.id}</DialogTitle>
        <DialogDescription>History of notifications received from PayFast.</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] pr-6">
        <div className="space-y-4">
          {order.itnHistory.slice().reverse().map((log, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base flex justify-between items-center">
                  <span>
                    Status: <Badge variant={log.status === 'Success' ? 'success' : 'destructive'}>{log.status}</Badge>
                  </span>
                   <span className="text-xs font-normal text-muted-foreground">
                    {format(log.receivedAt.toDate(), 'dd/MM/yyyy, HH:mm:ss')}
                  </span>
                </CardTitle>
                <CardDescription className="pt-2">{log.message}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold text-sm mb-2">Received Payload:</h4>
                <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </DialogContent>
  );
}


export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [viewingBackendSummary, setViewingBackendSummary] = useState<Order | null>(null);

  // Simple round-robin counter for staff assignment
  const [staffCounters, setStaffCounters] = useState<{ [key: string]: number }>({});
  
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };


  const fetchOrdersAndStaff = async () => {
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const ordersRef = collection(db, 'orders');
        let filteredOrders: Order[] = [];

        if (user?.role === 'staff') {
          // Staff view: only see orders assigned to them
          const q = query(ordersRef, where('assignedTo', 'array-contains', user.id), orderBy('date', 'desc'));
          const querySnapshot = await getDocs(q);
          filteredOrders = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date.toDate(),
              notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
            } as Order;
          });
        } else {
          // Admin view: See main store orders OR outsourced reseller orders
          const allOrdersSnapshot = await getDocs(query(ordersRef, orderBy('date', 'desc')));
          const allFetchedOrders = allOrdersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date.toDate(),
              notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
              itnHistory: (data.itnHistory || []).map((log: any) => ({...log, receivedAt: log.receivedAt.toDate()})),
            } as Order;
          });
          
          const ordersWithClientDetails = await Promise.all(allFetchedOrders.map(async (order) => {
              if (order.resellerId && order.originalOrderId && !order.endCustomerEmail) {
                const originalOrderRef = doc(db, 'orders', order.originalOrderId);
                const originalOrderSnap = await getDoc(originalOrderRef);
                if (originalOrderSnap.exists()) {
                    const originalOrderData = originalOrderSnap.data();
                    order.endCustomerName = originalOrderData.customerName;
                    order.endCustomerEmail = originalOrderData.customerEmail;
                }
              }
              return order;
          }));

          filteredOrders = ordersWithClientDetails.filter(order => !order.resellerId || (order.resellerId && order.originalOrderId));
        }
        
        setOrders(filteredOrders.filter(order => order.status !== 'Cancelled'));
      } catch (error) {
        console.error("Error fetching orders: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    
  useEffect(() => {
    if (user) {
        fetchOrdersAndStaff();
    }
  }, [user]);

   const handleAssignment = async (orderId: string, staffId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        assignedTo: [staffId],
      });

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, assignedTo: [staffId] } : order
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

  const addEmailToHistory = async (orderId: string, subject: string, message: string) => {
    if (!user) return;

     const emailNote: OrderNote = {
      text: message,
      subject: subject,
      authorId: user.id,
      date: Timestamp.now(),
      type: 'email',
    };

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        notes: arrayUnion(emailNote),
      });
      // Optimistically update the UI to avoid a full re-fetch
       setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, notes: [...(order.notes || []), {...emailNote, date: new Date()}] } // Use JS Date for UI
            : order
        )
      );
    } catch (error) {
        console.error("Error logging email to history:", error);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate || !user) return;

    let assignedStaffIds = orderToUpdate.assignedTo;
    let assignedStaffMember = assignedStaffIds?.[0] ? allStaff.find(s => s.id === assignedStaffIds![0]) : undefined;


    // New Logic: Assign staff only when moving to "Processing"
    if (newStatus === 'Processing' && !assignedStaffIds?.length) {
        const department = orderToUpdate.department as 'Accounting and Tax' | 'Administration' | 'CAP' | undefined;
        if (department) {
            const newStaffAssignment = getNextStaffMember(department);
            if (newStaffAssignment) {
                assignedStaffMember = newStaffAssignment;
                assignedStaffIds = [newStaffAssignment.id];
                 toast({
                    title: 'Order Assigned',
                    description: `Order has been assigned to ${assignedStaffMember.name}.`
                });
            }
        }
    }
    
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        assignedTo: assignedStaffIds || null,
      });

      // Create a task if moving to processing and a staff member is assigned
      if (newStatus === 'Processing' && assignedStaffIds && assignedStaffIds.length > 0 && user) {
          const taskData = {
              title: `Process Order: ${orderToUpdate.id}`,
              description: `Fulfill the services for order ${orderToUpdate.id}. Services include: ${orderToUpdate.items.map(i => i.title).join(', ')}.`,
              assignedTo: assignedStaffIds,
              createdBy: user.id,
              dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
              priority: 'Medium',
              status: 'To-Do',
              orderId: orderToUpdate.id,
              comments: [],
          };
          await addDoc(collection(db, 'tasks'), taskData);
          toast({
              title: 'Task Created',
              description: `A new task has been created for ${assignedStaffMember?.name} to process this order.`,
          });
      }


      // Update local state
      const updatedOrders = orders.map(order =>
          order.id === orderId ? { ...order, status: newStatus, assignedTo: assignedStaffIds } : order
      );
      setOrders(updatedOrders);

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });
      
      const reseller = orderToUpdate.resellerId ? allStaff.find(u => u.id === orderToUpdate.resellerId) : undefined;
      const isOutsourced = !!orderToUpdate.resellerId;
      const emailTo = isOutsourced ? orderToUpdate.endCustomerEmail : orderToUpdate.customerEmail;
      const customerName = isOutsourced ? orderToUpdate.endCustomerName : orderToUpdate.customerName;
      const emailOrder = {...orderToUpdate, customerName, id: orderToUpdate.originalOrderId || orderToUpdate.id };
      
      if (newStatus === 'Processing' && emailTo) {
        const itemsWithServices = orderToUpdate.items.map(item => {
            const service = allServices.find(s => s.id === item.id);
            return { ...item, service };
        }).filter(item => item.service) as { service: Service }[];
        
        const subject = `Action Required for Your Order #${emailOrder.id}`;
        const message = "Sent 'Request Documents' email to client.";
        const replyToEmail = assignedStaffMember?.email || 'info@myacc.co.za';

        const emailHtml = render(<DocumentRequestEmail order={emailOrder} items={itemsWithServices} reseller={reseller} replyTo={replyToEmail} />);
        
        const attachments = itemsWithServices
            .filter(item => item.service.attachmentUrl)
            .map(item => ({
                filename: `${item.service.title.replace(/\s/g, '_')}.pdf`,
                path: item.service.attachmentUrl!,
            }));
        
        await sendEmail({
            to: emailTo,
            subject: subject,
            html: emailHtml,
            resellerId: orderToUpdate.resellerId,
            attachments: attachments,
            replyTo: replyToEmail,
        });
        
        await addEmailToHistory(orderToUpdate.id, subject, message);

        toast({
            title: 'Document Request Sent',
            description: `An email has been sent to the client requesting the necessary documents.`
        });
      }

      if (newStatus === 'Completed' && emailTo) {
        const emailHtml = render(<ReviewRequestEmail order={emailOrder} reseller={reseller} />);
        await sendEmail({
            to: emailTo,
            subject: `We'd love your feedback on order #${emailOrder.id}`,
            html: emailHtml,
            resellerId: orderToUpdate.resellerId
        });
        toast({
            title: 'Review Request Sent',
            description: `An email has been sent to the client requesting a review.`
        });
      }


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

  const getSourceText = (order: Order) => {
    if (order.resellerId) return 'Reseller';
    return order.source || 'Client';
  }


  return (
    <Dialog>
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
            ) : orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders to display.</p>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => {
                    const assignee = getAssignee(order.assignedTo?.[0]);
                    const lastNote = order.notes && order.notes.length > 0 ? order.notes[order.notes.length - 1] : null;
                    const lastNoteAuthor = lastNote ? getAssignee(lastNote.authorId) : null;
                    const customerName = order.resellerId ? order.endCustomerName : order.customerName;
                    return (
                    <TableRow key={order.id}>
                        <TableCell className="font-medium">
                            <p>{order.originalOrderId || order.id}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.date), 'dd/MM/yyyy')}</p>
                        </TableCell>
                        <TableCell>{customerName}</TableCell>
                        <TableCell>
                        {assignee ? (
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <span>{assignee.name}</span>
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
                        <TableCell className="max-w-[250px] truncate">
                            {lastNote && lastNoteAuthor ? (
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <span className="font-semibold">{lastNoteAuthor.name}:</span>
                                        <span className="text-muted-foreground ml-1">"{lastNote.subject || lastNote.text}"</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-muted-foreground text-xs">No updates</span>
                            )}
                        </TableCell>
                        <TableCell>
                        <Badge variant={getStatusVariant(order.status)}>
                            {order.status}
                        </Badge>
                        </TableCell>
                        <TableCell>
                        <Badge variant="secondary">{getSourceText(order)}</Badge>
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
                            <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={() => setViewingBackendSummary(order)}>
                                    Backend Summary
                                </DropdownMenuItem>
                            </DialogTrigger>
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
                                            disabled={order.assignedTo?.[0] === staff.id}
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
        {viewingBackendSummary && <BackendSummaryModal order={viewingBackendSummary} />}
    </Dialog>
  );
}
