
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { generatePayFastSignature } from '@/app/actions/payfast';
import { Order } from '@/lib/types';

interface PayFastCheckoutProps {
  order: Partial<Order>;
  isDisabled: boolean;
  onPaymentStart: () => void;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
}

export default function PayFastCheckout({ order, isDisabled, onPaymentStart, onPaymentSuccess, onPaymentError }: PayFastCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});

  const preparePayment = async () => {
    if (!order.id || !order.total || !order.customerEmail) {
      onPaymentError("Missing order details to proceed with payment.");
      return;
    }
    setIsProcessing(true);
    onPaymentStart();
    
    const dataForSignature = {
        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success/${order.id}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
        email_address: order.customerEmail,
        m_payment_id: order.id,
        amount: order.total.toFixed(2),
        item_name: `Order #${order.id}`,
    };
    
    try {
        const signature = await generatePayFastSignature(dataForSignature);
        setFormData({ ...dataForSignature, signature });
        // The form will be submitted via the useEffect hook when formData is set.
    } catch(e) {
        console.error(e);
        onPaymentError("Could not generate a secure payment signature.");
        setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (formData.signature) {
      const form = document.getElementById('payfast-form') as HTMLFormElement;
      if (form) {
        form.submit();
        onPaymentSuccess();
      }
    }
  }, [formData, onPaymentSuccess]);

  return (
    <>
      <Button
        onClick={preparePayment}
        disabled={isDisabled || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isProcessing ? 'Redirecting...' : `Pay ${order.total ? 'R ' + order.total.toFixed(2) : ''} with PayFast`}
      </Button>
      {formData.signature && (
         <form id="payfast-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" style={{ display: 'none' }}>
           {Object.entries(formData).map(([key, value]) => (
             <input key={key} type="hidden" name={key} value={value} />
           ))}
         </form>
      )}
    </>
  );
}
