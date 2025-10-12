

'use client';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { DiscountCode } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function CheckoutPage() {
  const { cartItems, cartTotal, isCartLoaded } = useCart();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleApplyDiscount = async () => {
    if (!discountCode) return;
    setIsVerifying(true);
    try {
        const discountRef = doc(db, 'discounts', discountCode);
        const discountSnap = await getDoc(discountRef);
        if (discountSnap.exists() && discountSnap.data().status === 'active') {
            const discountData = discountSnap.data() as DiscountCode;
            const discountAmount = cartTotal * (discountData.percentage / 100);
            setAppliedDiscount({ code: discountCode, amount: discountAmount });
            toast({ title: 'Discount Applied', description: `You've received a ${discountData.percentage}% discount.` });
        } else {
            toast({ title: 'Invalid Code', description: 'This discount code is invalid or has been used.', variant: 'destructive' });
            setAppliedDiscount(null);
        }
    } catch (error) {
        toast({ title: 'Error', description: 'Could not verify discount code.', variant: 'destructive' });
    } finally {
        setIsVerifying(false);
    }
  };

  const discountedTotal = appliedDiscount ? cartTotal - appliedDiscount.amount : cartTotal;

  if (!isCartLoaded) {
    return (
      <div className="flex h-[calc(100vh-20rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isCartLoaded && cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-muted-foreground">You can't proceed to checkout without any services.</p>
          <Button asChild className="mt-6">
            <Link href="/services">Browse Services</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <CheckoutForm />
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Your Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.service.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{item.service.title}</p>
                      <p className="text-sm text-muted-foreground">Quantity: 1</p>
                    </div>
                    <p>{formatPrice(item.service.price)}</p>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                {appliedDiscount && (
                    <div className="flex justify-between text-green-600">
                        <span>Discount ({appliedDiscount.code})</span>
                        <span>- {formatPrice(appliedDiscount.amount)}</span>
                    </div>
                )}
                 <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(discountedTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
