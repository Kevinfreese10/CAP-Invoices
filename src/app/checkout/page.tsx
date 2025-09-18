'use client';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const { cartItems, cartTotal } = useCart();
  const router = useRouter();

  useEffect(() => {
    // If the cart is empty, redirect to the services page.
    // This check should happen for all users.
    if (cartItems.length === 0) {
      router.push('/services');
    }
  }, [cartItems, router]);
  
  // Render nothing or a loading state while redirecting
  if (cartItems.length === 0) {
    return null;
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
                    <p>R {item.service.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <hr className="my-4" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R {cartTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                You will be redirected to PayFast to complete your payment securely.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
