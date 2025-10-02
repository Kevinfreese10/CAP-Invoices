
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
import { Separator } from '../ui/separator';
import { useRouter } from 'next/navigation';

const POPUP_STORAGE_KEY = 'my-accountant-visitor-popup-seen';

export default function NewVisitorPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // This code runs only on the client
    // const timer = setTimeout(() => {
    //     setIsOpen(true);
    // }, 500); // Shortened delay for immediate viewing
    // return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    localStorage.setItem(POPUP_STORAGE_KEY, 'true');
    setIsOpen(false);
  };
  
  const handleRedirect = () => {
    handleClose();
    router.push('/compliance');
  }

  if (!isOpen) return null;

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
            <p className="font-semibold">Put Our Services to the Test</p>
            <p className="text-sm text-muted-foreground">
                Join our newsletter for a free SARS & CIPC compliance assessment and 5% off your next order.
            </p>
        </div>
        <div className="space-y-4">
             <Button onClick={handleRedirect} className="w-full">Get My Free Assessment</Button>
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
