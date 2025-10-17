
'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, OrderNote } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload, ClipboardCheck, MessageSquare, Send, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';


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

export default function ClientOrderDetailsPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const id = params.orderId as string;
  const { user: currentUser } = useAuth();
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const { toast } = useToast();

   const noteForm = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { noteText: "" },
  });

  const fetchOrderAndServices = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
        setAllStaff(fetchedStaff);

        // Fetch all services from Firestore
        const servicesQuery = query(collection(db, 'services'));
        const servicesSnapshot = await getDocs(servicesQuery);
        const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setAllServices(fetchedServices);

        // Fetch the specific order
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            ...data,
            id: docSnap.id,
            date: data.date.toDate(),
            notes: (data.notes || []).map((note: any) => ({...note, date: note.date.toDate()})),
          } as Order);
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
    fetchOrderAndServices();
  }, [id]);
  
  const onNoteSubmit = async (values: z.infer<typeof noteFormSchema>) => {
    if (!currentUser || !order) return;

    const newNote: OrderNote = {
      text: values.noteText,
      authorId: currentUser.uid,
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
      await fetchOrderAndServices(); // Re-fetch to display the new note
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

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
    // Also check current user in case they aren't in the staff list (e.g. client)
    if (currentUser?.uid === authorId) return currentUser;
    return allStaff.find(u => u.uid === authorId);
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

   const orderedItemsWithServices = order.items.map(item => {
        const serviceDetails = allServices.find(s => s.id === item.id);
        return { ...item, service: serviceDetails };
    });

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" asChild>
                <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
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
                    <CardContent className="space-y-6">
                        {orderedItemsWithServices.map((item, index) => (
                            <div key={item.id} className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-lg">{item.title}</p>
                                    </div>
                                    <p className="font-semibold text-lg">{formatPrice(item.price)}</p>
                                </div>
                                {item.service && item.service.informationToProvide && item.service.informationToProvide.length > 0 && (
                                    <div className="pl-4 ml-4 border-l-2 space-y-4">
                                        <h4 className="font-medium text-md text-muted-foreground">Documents Required:</h4>
                                        {item.service.informationToProvide.map((info, infoIndex) => (
                                            <div key={infoIndex} className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <ClipboardCheck className="h-4 w-4" />
                                                    {info.label}
                                                </label>
                                                <Input type={info.type === 'pdf' ? 'file' : 'text'} accept={info.type === 'pdf' ? 'application/pdf' : undefined} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {index < orderedItemsWithServices.length - 1 && <Separator />}
                            </div>
                        ))}
                        
                        <Separator className="my-4" />
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total</span>
                            <span>{formatPrice(order.total)}</span>
                        </div>
                        {orderedItemsWithServices.some(item => item.service?.informationToProvide?.length) && (
                            <Button className="w-full mt-6" size="lg">
                                <Upload className="mr-2 h-4 w-4" />
                                Submit All Documents
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
             <div className="lg:col-span-1 space-y-6 sticky top-24">
                  <Card>
                    <CardHeader>
                        <CardTitle>Communication History</CardTitle>
                        <CardDescription>Internal notes and sent emails for this order.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {order.notes && order.notes.length > 0 ? (
                                order.notes.slice().reverse().map((note, index) => {
                                    const author = getAuthor(note.authorId);
                                    const isEmail = note.type === 'email';
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="p-3 rounded-lg w-full bg-muted">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-xs font-semibold">{author?.name || 'System'}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(note.date), 'dd/MM/yyyy, HH:mm')}</p>
                                                </div>
                                                 {isEmail ? (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm font-semibold">{note.subject}</p>
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
        </div>
    </div>
  );
}
