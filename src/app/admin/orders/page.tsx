

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestore, collection, getDocs, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, Timestamp, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, OrderNote, Task } from '@/lib/types';
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
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { users, services as allServices } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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


const db = getFirestore(firebaseApp);

const allStaff = users.filter(u => u.role === 'staff' || u.role === 'admin');

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

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

    let assignedStaffId = orderToUpdate.assignedTo;
    let assignedStaffMember = allStaff.find(s => s.id === assignedStaffId);

    // New Logic: Assign staff only when moving to "Processing"
    if (newStatus === 'Processing' && !assignedStaffId) {
        const department = orderToUpdate.department as 'Accounting and Tax' | 'Administration' | undefined;
        if (department) {
            const newStaffAssignment = getNextStaffMember(department);
            if (newStaffAssignment) {
                assignedStaffMember = newStaffAssignment;
                assignedStaffId = newStaffAssignment.id;
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
        assignedTo: assignedStaffId || null,
      });

      // Create a task if moving to processing and a staff member is assigned
      if (newStatus === 'Processing' && assignedStaffId && user) {
          const taskData = {
              title: `Process Order: ${orderToUpdate.id}`,
              description: `Fulfill the services for order ${orderToUpdate.id}. Services include: ${orderToUpdate.items.map(i => i.title).join(', ')}.`,
              assignedTo: [assignedStaffId],
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
          order.id === orderId ? { ...order, status: newStatus, assignedTo: assignedStaffId } : order
      );
      setOrders(updatedOrders);

      toast({
        title: 'Status Updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });
      
      const reseller = orderToUpdate.resellerId ? users.find(u => u.id === orderToUpdate.resellerId) : undefined;
      const isOutsourced = !!orderToUpdate.resellerId;
      const emailTo = isOutsourced ? orderToUpdate.endCustomerEmail : orderToUpdate.customerEmail;
      const customerName = isOutsourced ? orderToUpdate.endCustomerName : orderToUpdate.customerName;
      const emailOrder = {...orderToUpdate, customerName, id: orderToUpdate.originalOrderId || orderToUpdate.id };
      
      if (newStatus === 'Processing' && emailTo) {
        const itemsWithServices = orderToUpdate.items.map(item => {
            const service = allServices.find(s => s.id === item.id);
            return { ...item, service };
        }).filter(item => item.service) as { service: Service }[];
        
        const subject = `Action Required: Documents needed for your order #${emailOrder.id}`;
        const message = "Sent 'Request Documents' email to client.";
        const emailHtml = render(<DocumentRequestEmail order={emailOrder} items={itemsWithServices} reseller={reseller} />);
        
        await sendEmail({
            to: emailTo,
            subject: subject,
            html: emailHtml,
            resellerId: orderToUpdate.resellerId
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
    return users.find(u => u.id === userId);
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
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const assignee = getAssignee(order.assignedTo);
                  const lastNote = order.notes && order.notes.length > 0 ? order.notes[order.notes.length - 1] : null;
                  const lastNoteAuthor = lastNote ? getAssignee(lastNote.authorId) : null;
                  const customerName = order.resellerId ? order.endCustomerName : order.customerName;
                  return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                        <p>{order.originalOrderId || order.id}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.date), 'dd MMM yyyy')}</p>
                    </TableCell>
                    <TableCell>{customerName}</TableCell>
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






