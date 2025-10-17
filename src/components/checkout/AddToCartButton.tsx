
'use client';

import { useCart } from '@/contexts/CartContext';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

type AddToCartButtonProps = {
  service: Service;
};

export default function AddToCartButton({ service }: AddToCartButtonProps) {
  const { addToCart } = useCart();

  return (
    <Button onClick={() => addToCart(service)}>
      <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
    </Button>
  );
}
