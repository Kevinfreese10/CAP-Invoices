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
import { Loader2 } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order, Service } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';

const db = getFirestore(firebaseApp);

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
});

export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      agreePrereqs: false,
      agreeRefund: false,
    },
  });

  const { reset } = form;
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: '',
        agreePrereqs: false,
        agreeRefund: false,
      });
    }
  }, [user, reset]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    toast({
      title: 'Processing Order...',
      description: 'Please wait while we generate your order.',
    });

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    
    try {
      const orderData: Order = {
        id: orderId,
        customerName: values.name,
        customerEmail: values.email,
        items: [{ 
            id: service.id, 
            title: service.title, 
            price: service.price,
            quantity: 1
        }],
        total: service.price,
        status: 'Pending Payment',
        date: Timestamp.now(),
      };

      if (user) {
        orderData.userId = user.id;
      }

      await setDoc(doc(db, 'orders', orderId), orderData);
      
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
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Complete Your Order</CardTitle>
      </CardHeader>
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4">
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
                </div>
                <Separator />
                <div className="space-y-4">
                     <FormField
                        control={form.control}
                        name="agreePrereqs"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                 I confirm I have all the prerequisite documents ready.
                                </FormLabel>
                                <FormMessage />
                            </div>
                            </FormItem>
                        )}
                        />
                     <FormField
                        control={form.control}
                        name="agreeRefund"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                 I understand and agree to the no-refund policy.
                                </FormLabel>
                                <FormMessage />
                            </div>
                            </FormItem>
                        )}
                        />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-4">
                <div className="flex justify-between items-center w-full">
                    <span className="text-muted-foreground">Total:</span>
                    <p className="text-2xl font-bold">R {service.price.toFixed(2)}</p>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Processing...' : 'Place Order & Proceed to Payment'}
                </Button>
                 <p className="text-xs text-muted-foreground text-center w-full">
                    You will be asked to make a manual EFT payment after placing your order.
                </p>
            </CardFooter>
          </form>
        </Form>
    </Card>
  );
}
