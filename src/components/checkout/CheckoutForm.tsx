
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Tag } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service, DiscountCode, OrderNote } from '@/lib/types';
import { getNextOrderId } from '@/lib/sequence';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { sendEmail } from '@/lib/email';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { render } from '@react-email/components';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  name_first: z.string().min(1, 'First name is required.'),
  name_last: z.string().min(1, 'Last name is required.'),
  email_address: z.string().email('Invalid email address.'),
  cell_number: z.string().min(10, 'A valid phone number is required.'),
  discountCode: z.string().optional(),
});

export default function CheckoutForm() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; percentage: number; } | null>(null);
  const [isVerifyingDiscount, setIsVerifyingDiscount] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name_first: '',
      name_last: '',
      email_address: '',
      cell_number: '',
      discountCode: '',
    },
  });
  
  useEffect(() => {
    if (currentUser) {
        form.setValue('name_first', currentUser.name.split(' ')[0] || '');
        form.setValue('name_last', currentUser.name.split(' ').slice(1).join(' ') || '');
        form.setValue('email_address', currentUser.email || '');
        if(currentUser.contactNumber) form.setValue('cell_number', currentUser.contactNumber);
    }
  }, [currentUser, form]);

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
        const discountAmount = cartTotal * (discountData.percentage / 100);
        setAppliedDiscount({ code: discountSnap.id, amount: discountAmount, percentage: discountData.percentage });
        toast({ title: 'Discount Applied!', description: `You've received a ${discountData.percentage}% discount.`});
    } catch (error) {
        toast({ title: 'Error', description: 'Could not verify discount code.', variant: 'destructive'});
    } finally {
        setIsVerifyingDiscount(false);
    }
  };

  const finalTotal = appliedDiscount ? cartTotal - appliedDiscount.amount : cartTotal;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!currentUser) {
       toast({ title: 'Please Log In', description: 'You must be logged in to place an order.', variant: 'destructive' });
       return;
    }
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait a moment.',
    });

    try {
      const orderId = await getNextOrderId();
      const firstService = cartItems[0]?.service;
      const department = firstService?.department as 'Accounting and Tax' | 'Administration' | 'CAP' | undefined;
      
      const orderData: Order = {
        id: orderId,
        userId: currentUser.uid,
        customerName: `${values.name_first} ${values.name_last}`,
        customerEmail: values.email_address,
        customerPhone: values.cell_number,
        items: cartItems.map(item => ({ 
            id: item.service.id, 
            title: item.service.title, 
            price: item.service.price,
            quantity: item.quantity
        })),
        total: finalTotal,
        discountCode: appliedDiscount ? appliedDiscount.code : null,
        discountAmount: appliedDiscount ? appliedDiscount.amount : null,
        paymentMethod: 'EFT',
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
      
      // Send confirmation email with EFT details
      const emailHtml = render(<OrderConfirmationEmail order={orderData} />);
      await sendEmail({
          to: orderData.customerEmail,
          subject: `Order Confirmation #${orderId}`,
          html: emailHtml,
      });

      clearCart();
      router.push(`/order-confirmation/${orderId}`);

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

  if (!currentUser) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Please Log In</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You need to be logged in to place an order.</p>
                <Button asChild className="mt-4">
                    <Link href="/login">Log In or Sign Up</Link>
                </Button>
            </CardContent>
        </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Billing Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name_first" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="name_last" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="email_address" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="cell_number" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />

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

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? 'Processing...' : 'Place Order via EFT'}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
