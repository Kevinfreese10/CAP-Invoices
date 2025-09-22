

'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User } from '@/lib/types';
import { services } from '@/lib/data';
import { users } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User as UserIcon, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

const db = getFirestore(firebaseApp);

type OrderItemWithService = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  service: Service;
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function AdminOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItemsWithServices, setOrderItemsWithServices] = useState<OrderItemWithService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.id as string;
  const [assignee, setAssignee] = useState<User | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const fetchedOrder = {
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
          } as Order;
          setOrder(fetchedOrder);
          
          if (fetchedOrder.assignedTo) {
            const assignedUser = users.find(u => u.id === fetchedOrder.assignedTo);
            setAssignee(assignedUser || null);
          }
          
          if (fetchedOrder.userId) {
            const customerUser = users.find(u => u.id === fetchedOrder.userId);
            setCustomer(customerUser || null);
          }

          const itemsWithServices = fetchedOrder.items.map(item => {
            const serviceDetails = services.find(s => s.id === item.id);
            if (!serviceDetails) {
              console.warn(`Service with id ${item.id} not found.`);
              return { ...item, service: null };
            }
            return { ...item, service: serviceDetails };
          }).filter(item => item.service !== null) as OrderItemWithService[];

          setOrderItemsWithServices(itemsWithServices);

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

    fetchOrder();
  }, [id]);

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
  
  if (currentUser && currentUser.role === 'client') {
      return (
          <div className="flex justify-center items-center h-screen">
              <p>Access Denied.</p>
          </div>
      )
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
                <Link href="/admin/orders">
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
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                        </div>
                    </CardContent>
                </Card>

            </div>
            <div className="lg:col-span-1 space-y-6 sticky top-24">
                 <Card>
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <UserIcon className="h-5 w-5 text-muted-foreground"/>
                        <CardTitle className="text-lg">Customer</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-2">
                        <p className="font-semibold">{order.customerName}</p>
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${order.customerEmail}`} className="text-primary hover:underline">{order.customerEmail}</a>
                        </div>
                        {customer && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{customer.contactNumber || 'N/A'}</span>
                            </div>
                        )}
                    </CardContent>
                 </Card>
                 {assignee && (
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                           <UserIcon className="h-5 w-5 text-muted-foreground"/>
                           <CardTitle className="text-lg">Assigned To</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${assignee.email}`} alt={assignee.name} />
                                    <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{assignee.name}</p>
                                    <p className="text-sm text-muted-foreground">{assignee.department}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                 )}
            </div>
        </div>
    </div>
  );
}
