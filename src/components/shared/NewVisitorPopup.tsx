'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';

const POPUP_STORAGE_KEY = 'my-accountant-visitor-popup-seen';

export default function NewVisitorPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // This code runs only on the client
    const hasSeenPopup = localStorage.getItem(POPUP_STORAGE_KEY);
    if (!hasSeenPopup) {
      // Show the popup after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(POPUP_STORAGE_KEY, 'true');
    setIsOpen(false);
  };
  
  const handleSubscribe = () => {
    // In a real app, you would handle the subscription here.
    // For now, we'll just close the dialog.
    handleClose();
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">Welcome to My Accountant!</AlertDialogTitle>
          <AlertDialogDescription>
            As a new visitor, subscribe to our newsletter and get <span className="font-bold text-primary">10% OFF</span> your first service order.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="Enter your email address" className="pl-10" />
            </div>
             <Button onClick={handleSubscribe} className="w-full">Subscribe & Get Discount</Button>
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            No, thanks
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}