
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

const db = getFirestore(firebaseApp);

export default function ServiceCheckoutForm({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleDirectCheckout() {
    if (!user) {
      router.push('/login');
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

  return (
    <div className="sticky top-24 space-y-4">
      <Button 
        onClick={handleDirectCheckout}
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? 'Processing...' : 'Buy Now'}
      </Button>
    </div>
  );
}
