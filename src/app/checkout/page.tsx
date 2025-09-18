
'use client';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutPage() {
  const { cartItems, cartTotal, isCartLoaded } = useCart();

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
