

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
import { Loader2 } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, User, Service } from '@/lib/types';
import { users } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { render } from '@react-email/components';

const db = getFirestore(firebaseApp);

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(10, 'A valid phone number is required.'),
});

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


export default function CheckoutForm() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
      title: 'Processing Order...',
      description: 'Please wait while we generate your order.',
    });

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    
    try {
      // Login or create user
      const orderUser = login(values.email, values.name);

      const firstService = cartItems[0]?.service;
      const department = firstService?.department as 'Accounting and Tax' | 'Administration' | undefined;
      let assignedStaff: User | undefined;
      if (department) {
        assignedStaff = getNextStaffMember(department);
      }
      
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
        total: cartTotal,
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: department,
        assignedTo: assignedStaff?.id,
      };

      if (orderUser) {
        orderData.userId = orderUser.id;
      }

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      // Send confirmation email
      const emailHtml = render(<OrderConfirmationEmail order={orderData} />);
      await sendEmail({
          to: values.email,
          subject: `Your My Accountant Order Confirmation: #${orderId}`,
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="082 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

    