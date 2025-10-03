

'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { users } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { render } from '@react-email/components';
import { getNextOrderId } from '@/lib/sequence';
import { Separator } from '../ui/separator';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(10, 'A valid phone number is required.'),
  discountCode: z.string().optional(),
});

export default function CheckoutForm() {
  const router = useRouter();
  const { signup, user: currentUser } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [isVerifyingDiscount, setIsVerifyingDiscount] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      discountCode: '',
    },
  });

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
        setAppliedDiscount({ code: discountSnap.id, amount: discountAmount });
        toast({ title: 'Discount Applied!', description: `You've received a ${discountData.percentage}% discount.`});
    } catch (error) {
        toast({ title: 'Error', description: 'Could not verify discount code.', variant: 'destructive'});
    } finally {
        setIsVerifyingDiscount(false);
    }
  };

  const finalTotal = appliedDiscount ? cartTotal - appliedDiscount.amount : cartTotal;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
      title: 'Processing Order...',
      description: 'Please wait while we generate your order.',
    });

    try {
      const orderId = await getNextOrderId();
      const firstService = cartItems[0]?.service;
      const department = firstService?.department as 'Accounting and Tax' | 'Administration' | undefined;
      
      const confirmationEmailSubject = `My Accountant | Your Order Confirmation: #${orderId}`;
      
      const confirmationNote: OrderNote = {
          text: 'Order confirmation email sent to client.',
          date: Timestamp.now(),
          authorId: currentUser?.uid || 'system',
          type: 'email',
          subject: confirmationEmailSubject,
      };

      const orderData: Order = {
        id: orderId,
        customerName: values.name,
        customerEmail: values.email,
        items: cartItems.map(item => ({ 
            id: item.service.id, 
            title: item.service.title, 
            price: item.service.price,
            quantity: item.quantity
        })),
        total: finalTotal,
        discountCode: appliedDiscount?.code,
        discountAmount: appliedDiscount?.amount,
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: department || null,
        assignedTo: null,
        notes: [confirmationNote],
        source: 'Client',
      };

      const existingUser = users.find(u => u.email === values.email);
      if (!existingUser) {
        signup(values.name, values.email);
      }
      
      await setDoc(doc(db, 'orders', orderId), orderData);

      if (appliedDiscount) {
          const discountRef = doc(db, 'discounts', appliedDiscount.code);
          await updateDoc(discountRef, {
              status: 'used',
              usedAt: Timestamp.now(),
              orderId: orderId,
          });
      }
      
      const emailHtml = render(<OrderConfirmationEmail order={orderData} />);
      await sendEmail({
          to: values.email,
          bcc: 'kev@thinkestry.co.za',
          subject: confirmationEmailSubject,
          html: emailHtml,
      });

      clearCart();
      setIsLoading(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem>)} />

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

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Processing...' : 'Place Order'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
