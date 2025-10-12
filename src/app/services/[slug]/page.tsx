

'use client';

import { notFound, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Clock, ClipboardCheck } from 'lucide-react';
import { Service } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { getFirestore, collection, query, where, getDocs, Timestamp, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Metadata, ResolvingMetadata } from 'next';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Tag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { getNextOrderId } from '@/lib/sequence';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


const db = getFirestore(firebaseApp);

export const dynamic = 'force-dynamic';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(10, 'A valid phone number is required.'),
  agreePrereqs: z.boolean().refine(val => val === true, {
    message: 'You must confirm you have the prerequisites.',
  }),
  agreeRefund: z.boolean().refine(val => val === true, {
    message: 'You must agree to the refund policy.',
  }),
  discountCode: z.string().optional(),
});

async function getService(slug: string): Promise<Service | null> {
    const q = query(collection(db, 'services'), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }
    const doc = querySnapshot.docs[0];
    const data = doc.data();

    // Convert Firestore Timestamp to a serializable format (ISO string)
    const serviceData = {
        id: doc.id,
        ...data,
    } as any;

    if (data.createdAt && data.createdAt instanceof Timestamp) {
        serviceData.createdAt = data.createdAt.toDate().toISOString();
    }
    
    return serviceData as Service;
}

type Props = {
  params: { slug: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const service = await getService(params.slug);

  if (!service) {
    return {
      title: 'Service Not Found',
    }
  }
 
  return {
    title: service.metaTitle || service.title,
    description: service.metaDescription || service.description,
    openGraph: {
      images: [service.imageUrl],
    },
  }
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function ServiceDetailPage() {
  const params = useParams();
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [isVerifyingDiscount, setIsVerifyingDiscount] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      agreePrereqs: false,
      agreeRefund: false,
      discountCode: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const fetchService = async () => {
        if (!params.slug) return;
        setIsLoading(true);
        const serviceData = await getService(params.slug as string);
        if (serviceData) {
            setService(serviceData);
        } else {
            notFound();
        }
        setIsLoading(false);
    };
    fetchService();
  }, [params.slug]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!service) {
    notFound();
  }

  const finalTotal = appliedDiscount ? service.price - appliedDiscount.amount : service.price;
  
  const handleApplyDiscount = async () => {
    const code = form.getValues('discountCode');
    if (!code) {
        toast({ title: 'No Code Entered', description: 'Please enter a discount code to apply.', variant: 'destructive'});
        return;
    }
    setIsVerifyingDiscount(true);
    try {
        const discountRef = doc(db, 'discounts', code);
        const discountSnap = await getDoc(discountRef);

        if (!discountSnap.exists() || discountSnap.data()?.status !== 'active') {
            toast({ title: 'Invalid Code', description: 'This discount code is either invalid or has already been used.', variant: 'destructive'});
            setAppliedDiscount(null);
            return;
        }

        const discountData = discountSnap.data() as Omit<DiscountCode, 'id'>;
        const discountAmount = service.price * (discountData.percentage / 100);
        setAppliedDiscount({ code: discountSnap.id, amount: discountAmount });
        toast({ title: 'Discount Applied!', description: `You've received a ${discountData.percentage}% discount.`});
    } catch (error) {
        toast({ title: 'Error', description: 'Could not verify discount code.', variant: 'destructive'});
    } finally {
        setIsVerifyingDiscount(false);
    }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    toast({
      title: 'Processing Order...',
      description: 'Please wait while we generate your order.',
    });

    try {
      const orderId = await getNextOrderId();
      const department = service.department as 'Accounting and Tax' | 'Administration' | undefined;

      const orderData = {
        id: orderId,
        customerName: values.name,
        customerEmail: values.email,
        items: [{ 
            id: service.id, 
            title: service.title, 
            price: service.price,
            quantity: 1
        }],
        total: finalTotal,
        discountCode: appliedDiscount ? appliedDiscount.code : null,
        discountAmount: appliedDiscount ? appliedDiscount.amount : null,
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: department || null,
        assignedTo: null,
        notes: [],
        source: 'Client',
      };
      
      await setDoc(doc(db, 'orders', orderId), orderData);

      if (appliedDiscount) {
          const discountRef = doc(db, 'discounts', appliedDiscount.code);
          await updateDoc(discountRef, {
              status: 'used',
              usedAt: Timestamp.now(),
              orderId: orderId,
          });
      }
      
      setIsSubmitting(false);
      router.push(`/order-confirmation/${orderId}`);

    } catch (error) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Order Failed',
            description: 'There was a problem saving your order. Please try again.',
            variant: 'destructive',
        });
        setIsSubmitting(false);
    }
  }


  return (
    <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
            <TrustIndexWidget />
        </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-8 md:col-span-2">
            
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">{service.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.title}</h1>
             <p className="text-3xl font-bold text-primary">{formatPrice(service.price)}</p>
            <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">{service.turnaroundTime}</span>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold">Service Description</h2>
            <Separator className="my-3" />
            <p className="text-muted-foreground">{service.longDescription}</p>
          </div>

          {service.whatsIncluded && service.whatsIncluded.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold">What's Included</h2>
              <Separator className="my-3" />
              <ul className="space-y-3">
                {service.whatsIncluded.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <BadgeCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold">Prerequisites</h2>
            <Separator className="my-3" />
             <ul className="space-y-3">
              {service.clientRequirements.map((doc, index) => (
                <li key={index} className="flex items-start">
                  <ClipboardCheck className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="md:col-span-1">
             <Card className="sticky top-24">
                <CardHeader>
                    <CardTitle>Place Your Order</CardTitle>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <FormLabel>Discount Code</FormLabel>
                                <div className="flex gap-2">
                                    <FormField control={form.control} name="discountCode" render={({ field }) => ( <FormItem className="flex-grow"><FormControl><Input placeholder="Enter your code" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <Button type="button" variant="secondary" onClick={handleApplyDiscount} disabled={isVerifyingDiscount}>
                                        {isVerifyingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                                        <span className="ml-2">Apply</span>
                                    </Button>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <FormField control={form.control} name="agreePrereqs" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>I confirm I have all the prerequisite documents ready.</FormLabel><FormMessage /></div></FormItem>)} />
                                <FormField control={form.control} name="agreeRefund" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>I understand and agree to the <Link href="/refund-policy" className="underline hover:text-primary" target="_blank">refund policy</Link>.</FormLabel><FormMessage /></div></FormItem>)} />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col items-start gap-4">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-muted-foreground">Total:</span>
                                <div className="text-right">
                                    {appliedDiscount && (
                                        <p className="text-sm line-through text-muted-foreground">{formatPrice(service.price)}</p>
                                    )}
                                    <p className="text-2xl font-bold">{formatPrice(finalTotal)}</p>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !form.formState.isValid}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
      </div>
    </div>
  );
}
