
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Service, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getNextOrderId } from '@/lib/sequence';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

const db = getFirestore(firebaseApp);

export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrerequisites, setHasPrerequisites] = useState(false);
  const [agreedToRefundPolicy, setAgreedToRefundPolicy] = useState(false);


  async function handleDirectCheckout() {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!hasPrerequisites || !agreedToRefundPolicy) {
      toast({
        title: 'Confirmation Required',
        description: 'Please confirm you have the prerequisites and agree to the refund policy.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    toast({
      title: 'Placing Your Order...',
      description: 'Please wait while we create your order.',
    });

    try {
      const orderId = await getNextOrderId();
      const orderData: Order = {
        id: orderId,
        userId: user.uid,
        customerName: user.name,
        customerEmail: user.email,
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

  if (!user) {
    return (
        <Button asChild className="w-full" size="lg">
            <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login to Purchase
            </Link>
        </Button>
    )
  }

  const canPurchase = hasPrerequisites && agreedToRefundPolicy;

  return (
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
        onClick={handleDirectCheckout}
        disabled={isLoading || !canPurchase}
        className="w-full"
        size="lg"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Processing...' : 'Buy Now'}
      </Button>
    </div>
  );
}
