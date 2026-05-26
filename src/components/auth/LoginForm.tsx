
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
import { db, auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Label } from '@/components/ui/label';

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
  
  // Password Reset States
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

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
    toast({ title: "Creating renewal order...", description: "Please wait." });
    
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
            renewalForClientId: lapsedUser.uid,
        };
        
        await setDoc(doc(db, 'orders', orderId), renewalOrderData, { merge: true });
        router.push(`/order-confirmation/${orderId}`);
        
    } catch(e) {
        console.error(e);
        toast({ title: 'Error', description: 'Could not create renewal order.', variant: 'destructive'});
        setIsProcessingPayment(false);
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
        toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
    }
    setIsSendingReset(true);
    try {
        await sendPasswordResetEmail(auth, resetEmail);
        toast({ title: 'Email Sent', description: 'Check your inbox for password reset instructions.' });
        setIsResetDialogOpen(false);
    } catch (error: any) {
        console.error("Error sending reset email:", error);
        toast({ title: 'Error', description: 'Could not send reset email. Please try again.', variant: 'destructive' });
    } finally {
        setIsSendingReset(false);
    }
  };
  

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await login(values.email, values.password);

    if (result === 'subscription_lapsed') {
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
      description: `Welcome back, ${result.name}! Redirecting...`,
    });
    
    if (result.role === 'admin' || result.role === 'staff' || result.role === 'cap_supervisor') {
        router.push('/admin/dashboard');
    } else if (result.role === 'cap_staff') {
        router.push('/admin/cap-suppliers/control-sheet');
    } else if (result.role === 'reseller') {
        router.push('/reseller/dashboard');
    } else if (result.role === 'supplier') {
        router.push('/supplier/dashboard');
    } else if (result.role === 'ai_accountant') {
        router.push('/dashboard/ai-accountant/clients');
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

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                    Enter your email address and we'll send you a link to reset your password.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleResetPassword} disabled={isSendingReset}>
                    {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
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
                <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Button
                        variant="link"
                        size="sm"
                        className="px-0 font-normal h-auto py-0"
                        type="button"
                        onClick={() => setIsResetDialogOpen(true)}
                    >
                        Forgot password?
                    </Button>
                </div>
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
    </>
  );
}
