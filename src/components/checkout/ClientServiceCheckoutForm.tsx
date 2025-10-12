

'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/types';
import { Button } from '../ui/button';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ClientServiceCheckoutForm({ service }: { service: Service }) {
  const { addToCart, cartItems } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    const itemInCart = cartItems.some(item => item.service.id === service.id);
    setIsAdded(itemInCart);
  }, [cartItems, service.id]);

  const handleAddToCart = () => {
    addToCart(service);
    setIsAdded(true);
  };

  return (
    <div className="sticky top-24 space-y-4">
        <Button 
            onClick={handleAddToCart} 
            disabled={isAdded}
            className="w-full"
            size="lg"
        >
            {isAdded ? (
                <>
                    <Check className="mr-2 h-5 w-5" />
                    Added to Cart
                </>
            ) : (
                <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add to Cart
                </>
            )}
        </Button>
        {isAdded && (
            <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/cart">
                    Proceed to Checkout <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
            </Button>
        )}
    </div>
  );
}
