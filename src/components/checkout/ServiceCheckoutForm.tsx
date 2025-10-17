
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Tag, LogIn } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service, User, DiscountCode, OrderNote } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { sendEmail } from '@/lib/email';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { render } from '@react-email/components';
import Link from 'next/link';
import { getNextOrderId } from '@/lib/sequence';
import PayFastCheckout from './PayFastCheckout';


const db = getFirestore(firebaseApp);

const formSchema = z.object({
  name_first: z.string().min(1, 'First name is required.'),
  name_last: z.string().min(1, 'Last name is required.'),
  email_address: z.string().email('Invalid email address.'),
  cell_number: z.string().min(10, 'A valid phone number is required.'),
  password: z.string().optional(),
  agreePrereqs: z.boolean().refine(val => val === true, {
    message: 'You must confirm you have the prerequisites.',
  }),
  agreeRefund: z.boolean().refine(val => val === true, {
    message: 'You must agree to the refund policy.',
  }),
  discountCode: z.string().optional(),
});

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};


export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { signup, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<Partial<Order> | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; percentage: number; } | null>(null);
  const [isVerifyingDiscount, setIsVerifyingDiscount] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name_first: '',
      name_last: '',
      email_address: '',
      cell_number: '',
      password: '',
      agreePrereqs: false,
      agreeRefund: false,
      discountCode: '',
    },
    mode: 'onChange',
  });
  
  useEffect(() => {
    if (currentUser) {
        form.setValue('name_first', currentUser.name.split(' ')[0] || '');
        form.setValue('name_last', currentUser.name.split(' ').slice(1).join(' ') || '');
        form.setValue('email_address', currentUser.email || '');
    }
  }, [currentUser, form]);

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
        setAppliedDiscount({ code: discountSnap.id, amount: discountAmount, percentage: discountData.percentage });
        toast({ title: 'Discount Applied!', description: `You've received a ${discountData.percentage}% discount.`});
    } catch (error) {
        toast({ title: 'Error', description: 'Could not verify discount code.', variant: 'destructive'});
    } finally {
        setIsVerifyingDiscount(false);
    }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
      title: 'Processing Order...',
      description: 'Please wait while we generate your order.',
    });

    let userId = currentUser?.uid;

    if (!currentUser) {
      if (!values.password) {
        form.setError('password', { message: 'Password is required to create an account.' });
        setIsLoading(false);
        return;
      }
      try {
        const newUser = await signup(values.email_address, values.password, `${values.name_first} ${values.name_last}`);
        if (typeof newUser === 'string') {
          toast({ title: 'Signup Failed', description: newUser, variant: 'destructive' });
          setIsLoading(false);
          return;
        }
        userId = newUser.uid;
        toast({ title: 'Account Created!', description: 'You are now logged in.' });
      } catch (e: any) {
        toast({ title: 'Signup Failed', description: e.message || 'An unexpected error occurred.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
    }


    if (!userId) {
       toast({ title: 'Error', description: 'Could not identify user. Please try logging in again.', variant: 'destructive' });
       setIsLoading(false);
       return;
    }

    try {
      const orderId = await getNextOrderId();
      const department = service.department as 'Accounting and Tax' | 'Administration' | 'CAP' | undefined;

      const orderData: Order = {
        id: orderId,
        userId: userId,
        customerName: `${values.name_first} ${values.name_last}`,
        customerEmail: values.email_address,
        customerPhone: values.cell_number,
        items: [{ 
            id: service.id, 
            title: service.title, 
            price: service.price,
            quantity: 1
        }],
        total: finalTotal,
        discountCode: appliedDiscount ? appliedDiscount.code : null,
        discountAmount: appliedDiscount ? appliedDiscount.amount : null,
        paymentMethod: 'PayFast',
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: department || null,
        assignedTo: null,
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
      
      setOrderForPayment(orderData);
      
    } catch (error) {
        console.error("Error creating order: ", error);
        toast({
            title: 'Order Failed',
            description: 'There was a problem saving your order. Please try again.',
            variant: 'destructive',
        });
        setIsLoading(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Place Your Order</CardTitle>
      </CardHeader>
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="name_first" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="name_last" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="email_address" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="cell_number" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    {!currentUser && (
                         <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Create Password</FormLabel><FormControl><Input type="password" {...field} placeholder="Min. 6 characters" /></FormControl><FormMessage /></FormItem> )} />
                    )}
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
                     {appliedDiscount && (
                        <p className="text-sm text-green-600">
                            Successfully applied a {appliedDiscount.percentage}% discount!
                        </p>
                    )}
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
                 {orderForPayment ? (
                    <PayFastCheckout
                        order={orderForPayment}
                        isDisabled={isLoading}
                        onPaymentStart={() => setIsLoading(true)}
                        onPaymentSuccess={() => { /* Redirects handled by PayFast */ }}
                        onPaymentError={(err) => {
                            toast({ title: 'Payment Error', description: err, variant: 'destructive'});
                            setIsLoading(false);
                        }}
                    />
                ) : (
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading || !form.formState.isValid}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? 'Processing...' : 'Proceed to Payment'}
                    </Button>
                )}
            </CardFooter>
          </form>
        </Form>
    </Card>
  );
}
