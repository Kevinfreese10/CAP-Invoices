

'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User as UserIcon, Mail, Phone, Send, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const noteFormSchema = z.object({
  noteText: z.string().min(3, "Note must be at least 3 characters."),
});

export default function ResellerOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.id as string;
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [allStaff, setAllStaff] = useState<User[]>([]);

  const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const fetchOrder = async () => {
      if (!id || !currentUser) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
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
    fetchOrder();
  }, [id, currentUser]);
  
  const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    const newNote: OrderNote = {
      text: values.noteText,
      authorId: currentUser.id,
      date: Timestamp.now(),
      type: 'note',
    };

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        notes: arrayUnion(newNote),
      });

      toast({ title: "Note Added", description: "Your note has been saved." });
      noteForm.reset();
      await fetchOrder(); // Re-fetch to display the new note
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };
  
   const getAuthor = (authorId: string): User | undefined => {
    return allStaff.find(u => u.id === authorId);
  }

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
                            <p>{formatPrice(item.clientPrice || 0)}</p>
                            </div>
                        ))}
                        </div>
                        <Separator className="my-4" />
                        <div className="flex justify-between font-bold text-lg">
                        <span>Total Selling Price</span>
                        <span>{formatPrice(order.clientTotal || 0)}</span>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Order Notes</CardTitle>
                        <CardDescription>Internal notes for this order.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="bg-muted p-3 rounded-lg w-full">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-xs font-semibold">{author?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd MMM yyyy, HH:mm')}</p>
                                                </div>
                                                <p className="text-sm">{note.text}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">No notes for this order yet.</p>
                            )}
                        </div>
                         <Form {...noteForm}>
                          <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="flex items-start gap-2 pt-4">
                            <FormField
                              control={noteForm.control}
                              name="noteText"
                              render={({ field }) => (
                                <FormItem className="flex-grow">
                                  <FormControl>
                                    <Textarea placeholder="Add a new note..." {...field} rows={2} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" size="icon" className="flex-shrink-0 mt-1">
                              <Send className="h-4 w-4" />
                            </Button>
                          </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6 sticky top-24">
                 <Card>
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <UserIcon className="h-5 w-5 text-muted-foreground"/>
                        <CardTitle className="text-lg">Client Details</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-2">
                        <p className="font-semibold">{order.customerName}</p>
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${order.customerEmail}`} className="text-primary hover:underline">{order.customerEmail}</a>
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
    </div>
  );
}
