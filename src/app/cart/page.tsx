'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, ShoppingCart } from 'lucide-react';

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

export default function CartPage() {
  const { cartItems, removeFromCart, cartTotal, itemCount } = useCart();

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Your Cart</h1>
      {itemCount > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map(item => (
              <Card key={item.service.id} className="flex items-center p-4">
                <div className="relative h-24 w-24 flex-shrink-0">
                  <Image
                    src={item.service.imageUrl}
                    alt={item.service.title}
                    fill
                    className="rounded-md object-cover"
                    data-ai-hint={item.service.imageHint}
                  />
                </div>
                <div className="ml-4 flex-grow">
                  <h3 className="font-semibold">{item.service.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.service.category}</p>
                </div>
                <div className="flex items-center gap-4">
                    <p className="font-semibold">{formatPrice(item.service.price)}</p>
                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.service.id)}>
                        <Trash2 className="h-5 w-5 text-destructive" />
                        <span className="sr-only">Remove item</span>
                    </Button>
                </div>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" size="lg">
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-muted-foreground">Looks like you haven't added any services yet.</p>
            <Button asChild className="mt-6">
                <Link href="/services">Browse Services</Link>
            </Button>
        </div>
      )}
    </div>
  );
}
