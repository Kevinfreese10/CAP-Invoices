
'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, OrderNote } from '@/lib/types';
import { users } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User as UserIcon, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ResellerOutsourcedOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.id as string;
  const [assignee, setAssignee] = useState<User | null>(null);
  const { user: currentUser } = useAuth();

  const fetchOrder = async () => {
      if (!id || !currentUser) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
           // Security check: ensure the fetched order belongs to the reseller
          if (data.resellerId !== currentUser.id) {
             notFound();
             return;
          }

          const fetchedOrder = {
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
          } as Order;
          setOrder(fetchedOrder);
          
          if (fetchedOrder.assignedTo && fetchedOrder.assignedTo.length > 0) {
            const assignedUser = users.find(u => u.id === fetchedOrder.assignedTo[0]);
            setAssignee(assignedUser || null);
          }

        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching order details: ", error);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (currentUser) {
        fetchOrder();
    }
  }, [id, currentUser]);


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
  
  const getAuthor = (authorId: string): User | undefined => {
    return users.find(u => u.id === authorId);
  }
  
  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!order) {
    return notFound();
  }

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/reseller/orders">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id}</CardTitle>
                        <CardDescription>
                        Date: {format(new Date(order.date), 'dd MMMM yyyy')} | Status: <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{item.title}</p>
                                <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                            </div>
                            <p>{formatPrice(item.price)}</p>
                            </div>
                        ))}
                        </div>
                        <Separator className="my-4" />
                        <div className="flex justify-between font-bold text-lg">
                        <span>Total Outsourcing Cost</span>
                        <span>{formatPrice(order.total)}</span>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Communication History</CardTitle>
                        <CardDescription>Internal notes and sent emails for this order from My Accountant.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const isEmail = note.type === 'email';
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="bg-muted p-3 rounded-lg w-full">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-xs font-semibold">{author?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd MMM yyyy, HH:mm')}</p>
                                                </div>
                                                 {isEmail ? (
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2 mb-1 text-sm">
                                                          <div className="flex items-center gap-2">
                                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                                            <p className="font-semibold">{note.subject}</p>
                                                          </div>
                                                          {order.endCustomerEmail && (
                                                            <p className="text-xs text-muted-foreground">To: {order.endCustomerEmail}</p>
                                                          )}
                                                        </div>
                                                        <p className="text-sm italic text-muted-foreground">"{note.text}"</p>
                                                    </div>
                                                 ) : (
                                                    <p className="text-sm">{note.text}</p>
                                                 )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
            <div className="lg:col-span-1 space-y-6">
                 <Card>
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                           <UserIcon className="h-5 w-5 text-muted-foreground"/>
                           <CardTitle className="text-lg">Fulfillment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <p className="text-sm text-muted-foreground">This order is being processed by My Accountant. Your original order ID for your client is <Button variant="link" asChild className="p-0 h-auto font-semibold"><Link href={`/reseller/orders/${order.originalOrderId}`}>{order.originalOrderId}</Link></Button>.</p>
                           {assignee ? (
                                <div className="space-y-4 pt-2">
                                     <h4 className="font-semibold text-sm">Assigned To</h4>
                                     <div className="flex items-center gap-4">
                                        <div>
                                            <p className="font-semibold">{assignee.name}</p>
                                            <p className="text-sm text-muted-foreground">{assignee.department}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href={`mailto:${assignee.email}?subject=Query regarding Order ${order.id}`}>
                                            <Mail className="mr-2 h-4 w-4"/>
                                            Contact Accountant
                                        </a>
                                    </Button>
                                </div>
                           ) : (
                                <p className="text-sm text-muted-foreground pt-2">This order has not been assigned to a consultant yet.</p>
                           )}
                        </CardContent>
                 </Card>
            </div>
        </div>
    </div>
  );
}
