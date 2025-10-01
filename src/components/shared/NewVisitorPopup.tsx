
'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';
import { Separator } from '../ui/separator';

const POPUP_STORAGE_KEY = 'my-accountant-visitor-popup-seen';

export default function NewVisitorPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // This code runs only on the client
    const timer = setTimeout(() => {
        setIsOpen(true);
    }, 500); // Shortened delay for immediate viewing
    return () => clearTimeout(timer);
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
          <AlertDialogTitle className="text-2xl">Welcome to My Accountant</AlertDialogTitle>
           <AlertDialogDescription>
            Did you know that My Accountant is the preferred financial management partner for Carte Blanche?
            <br/><br/>
            Carte Blanche is South Africa’s most respected investigative journalism programme, trusted for over 30 years by millions of viewers. Their reputation is built on credibility, professionalism, and integrity — values that align perfectly with how we do business.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Separator />

        <div className="space-y-2 text-center">
            <p className="font-semibold">Subscribe for 10% OFF</p>
            <p className="text-sm text-muted-foreground">
                As a new visitor, subscribe to our newsletter and get 10% OFF your first service order.
            </p>
        </div>
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
