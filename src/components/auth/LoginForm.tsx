
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { User, Order } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getNextOrderId } from '@/lib/sequence';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generatePayFastSignature } from '@/app/actions/payfast';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function LoginForm() {
  const router = useRouter();
  const { login, user: tempUser } = useAuth();
  const { toast } = useToast();
  const [isLapsedOpen, setIsLapsedOpen] = useState(false);
  const [lapsedUser, setLapsedUser] = useState<User | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [payfastFormData, setPayfastFormData] = useState<{ [key: string]: string } | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

   async function handleRenew() {
    if (!lapsedUser || !lapsedUser.subscription) return;
    setIsProcessingPayment(true);
    toast({ title: "Creating renewal order...", description: "Please wait while we redirect you to payment." });
    
    try {
        const orderId = await getNextOrderId();
        const renewalOrderData: Order = {
            id: orderId,
            userId: lapsedUser.uid,
            customerName: lapsedUser.name,
            customerEmail: lapsedUser.email,
            items: [{
                id: 'subscription_renewal',
                title: `AI Accountant Subscription Renewal`,
                price: lapsedUser.subscription.monthlyTotal,
                quantity: 1,
            }],
            total: lapsedUser.subscription.monthlyTotal,
            discountCode: null,
            discountAmount: null,
            status: 'Pending Payment',
            date: Timestamp.now(),
            source: 'AI Accountant Signup',
            renewalForClientId: lapsedUser.uid, // Link this order to the client being renewed
        };
        
        await setDoc(doc(db, 'orders', orderId), renewalOrderData);
        
        const dataForSignature = {
            merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
            merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${orderId}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
            notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
            email_address: lapsedUser.email,
            m_payment_id: orderId,
            amount: lapsedUser.subscription.monthlyTotal.toFixed(2),
            item_name: `Subscription Renewal for ${lapsedUser.name}`,
        };

        const signature = await generatePayFastSignature(dataForSignature);
        setPayfastFormData({ ...dataForSignature, signature });
        
        // The form will be submitted via a useEffect when payfastFormData is set
    } catch(e) {
        console.error(e);
        toast({ title: 'Error', description: 'Could not create renewal order.', variant: 'destructive'});
        setIsProcessingPayment(false);
    }
  }
  
  if (payfastFormData) {
      setTimeout(() => {
          document.getElementById('payfast-redirect-form')?.submit();
      }, 500);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await login(values.email, values.password);

    if (result === 'subscription_lapsed') {
        // tempUser is set in the auth context when subscription is lapsed
        setLapsedUser(tempUser);
        setIsLapsedOpen(true);
        return;
    }
    
    if (result === 'invalid_credentials') {
        toast({
            title: 'Login Failed',
            description: 'Invalid email or password.',
            variant: 'destructive',
        });
        return;
    }
    
    if (result === 'invalid_role') {
      toast({
        title: 'Access Denied',
        description: 'This portal is for staff, admins, and resellers only.',
        variant: 'destructive',
      });
      return;
    }

    if (!result) {
        toast({
            title: 'Login Failed',
            description: 'An unknown error occurred.',
            variant: 'destructive',
        });
        return;
    }
    
    toast({
      title: 'Logged in successfully',
      description: `Welcome back, ${result?.name}! Redirecting...`,
    });
    
    if (result.role === 'admin' || result.role === 'staff') {
        router.push('/admin/dashboard');
    } else if (result.role === 'reseller') {
        router.push('/reseller/dashboard');
    } else {
        router.push('/dashboard');
    }
  }

  return (
    <>
      <Dialog open={isLapsedOpen} onOpenChange={setIsLapsedOpen}>
        <DialogContent hideCloseButton={true}>
            <DialogHeader>
                <div className="flex justify-center">
                    <AlertCircle className="h-12 w-12 text-destructive"/>
                </div>
                <DialogTitle className="text-center text-2xl">Subscription Expired</DialogTitle>
                <DialogDescription className="text-center">
                    Your AI Accountant subscription has lapsed. To continue using the service, please renew your subscription.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button className="w-full" onClick={handleRenew} disabled={isProcessingPayment}>
                     {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Renew Subscription
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Log In
          </Button>
        </form>
      </Form>
      {payfastFormData && (
        <form id="payfast-redirect-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" style={{ display: 'none' }}>
            {Object.entries(payfastFormData).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value as string} />
            ))}
        </form>
      )}
    </>
  );
}
