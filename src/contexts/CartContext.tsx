'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Service, CartItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (service: Service) => void;
  removeFromCart: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (service: Service) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.service.id === service.id
      );
      if (existingItem) {
        // Services are unique, so we can't increase quantity.
        // We can show a toast message instead.
        toast({
            title: 'Already in cart',
            description: `${service.title} is already in your cart.`,
        });
        return prevItems;
      }
      toast({
        title: 'Added to cart',
        description: `${service.title} has been added to your cart.`,
      });
      return [...prevItems, { service, quantity: 1 }];
    });
  };

  const removeFromCart = (serviceId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.service.id !== serviceId)
    );
    toast({
        title: 'Removed from cart',
        variant: 'destructive',
    });
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.service.id === serviceId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      )
    );
  };
  
  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.service.price * item.quantity,
    0
  );

  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
