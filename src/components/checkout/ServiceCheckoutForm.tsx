
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Service, Order, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getNextOrderId } from '@/lib/sequence';
import { Checkbox } from '../ui/checkbox';
import { nanoid } from 'nanoid';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '../emails/OrderConfirmationEmail';
import { sendEmail } from '@/lib/email';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';


const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);


const guestFormSchema = z.object({
  name_first: z.string().min(1, 'First name is required.'),
  name_last: z.string().min(1, 'Last name is required.'),
  email_address: z.string().email('Invalid email address.'),
  cell_number: z.string().min(10, 'A valid phone number is required.'),
});

export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrerequisites, setHasPrerequisites] = useState(false);
  const [agreedToRefundPolicy, setAgreedToRefundPolicy] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const form = useForm<z.infer<typeof guestFormSchema>>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      name_first: '',
      name_last: '',
      email_address: '',
      cell_number: '',
    },
  });

  const canPurchase = hasPrerequisites && agreedToRefundPolicy;
  
  const handleGuestCheckout = async (values: z.infer<typeof guestFormSchema>) => {
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we create your order.',
    });

    try {
      let userId: string;
      let isNewUser = false;
      let generatedPassword: string | null = null;
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', values.email_address));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        isNewUser = true;
        generatedPassword = nanoid(8);
        const userCredential = await createUserWithEmailAndPassword(auth, values.email_address, generatedPassword);
        userId = userCredential.user.uid;
        
        const newUser: Partial<User> = {
            uid: userId,
            id: userId,
            name: `${values.name_first} ${values.name_last}`,
            email: values.email_address,
            contactNumber: values.cell_number,
            role: 'client',
            createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', userId), newUser);
      } else {
        userId = querySnapshot.docs[0].id;
      }
      
      await createOrder(userId, `${values.name_first} ${values.name_last}`, values.email_address, isNewUser, generatedPassword);
      
    } catch (error: any) {
        console.error("Error in guest checkout: ", error);
        let description = 'There was a problem placing your order. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email already exists. Please log in to complete your purchase.';
        }
        toast({ title: 'Order Failed', description, variant: 'destructive' });
        setIsLoading(false);
    }
  };


  async function handleLoggedInCheckout() {
    if (!user) return;
    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we create your order.',
    });

    try {
      await createOrder(user.uid, user.name, user.email, false, null);
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

  async function createOrder(userId: string, customerName: string, customerEmail: string, isNewUser: boolean, generatedPassword: string | null) {
      const orderId = await getNextOrderId();
      const orderData: Order = {
        id: orderId,
        userId: userId,
        customerName: customerName,
        customerEmail: customerEmail,
        items: [{ id: service.id, title: service.title, price: service.price, quantity: 1 }],
        total: service.price,
        discountCode: null,
        discountAmount: null,
        paymentMethod: 'EFT',
        status: 'Pending Payment',
        date: Timestamp.now(),
        department: service.department || null,
        source: 'Client',
      };

      await setDoc(doc(db, 'orders', orderId), orderData);
      
      const emailHtml = render(<OrderConfirmationEmail order={orderData} isNewUser={isNewUser} generatedPassword={generatedPassword} />);
      await sendEmail({
          to: orderData.customerEmail,
          subject: `Order Confirmation #${orderId}`,
          html: emailHtml,
      });

      router.push(`/order-confirmation/${orderId}`);
  }
  
  const handleMainButtonClick = () => {
      if (!canPurchase) {
          toast({
              title: 'Confirmation Required',
              description: 'Please confirm you have the prerequisites and agree to the refund policy.',
              variant: 'destructive',
          });
          return;
      }
      
      if(user) {
          handleLoggedInCheckout();
      } else {
          setIsGuestModalOpen(true);
      }
  }


  return (
    <>
    <Dialog open={isGuestModalOpen} onOpenChange={setIsGuestModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guest Checkout</DialogTitle>
          <DialogDescription>Please provide your details to complete the order. An account will be created for you to track your progress.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleGuestCheckout)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="name_first" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="name_last" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="email_address" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="cell_number" render={({ field }) => ( <FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input placeholder="082 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsGuestModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Place Order
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <div className="sticky top-24 space-y-4">
        <div className="space-y-4">
            <div className="flex items-start space-x-2">
                <Checkbox id="prerequisites" checked={hasPrerequisites} onCheckedChange={(checked) => setHasPrerequisites(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                    <label
                    htmlFor="prerequisites"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                    I confirm I have all the prerequisites for this service.
                    </label>
                </div>
            </div>
             <div className="flex items-start space-x-2">
                <Checkbox id="refund_policy" checked={agreedToRefundPolicy} onCheckedChange={(checked) => setAgreedToRefundPolicy(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                    <label
                    htmlFor="refund_policy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                    I have read and agree to the <Link href="/refund-policy" className="text-primary underline" target="_blank">refund policy</Link>.
                    </label>
                </div>
            </div>
        </div>
      <Button 
        onClick={handleMainButtonClick}
        disabled={isLoading || !canPurchase}
        className="w-full"
        size="lg"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Processing...' : user ? 'Buy Now' : 'Proceed to Checkout'}
      </Button>
       {!user && (
        <p className="text-xs text-center text-muted-foreground">You can <Link href="/login" className="text-primary underline">log in</Link> for a faster checkout.</p>
      )}
    </div>
    </>
  );
}
