
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const db = getFirestore(firebaseApp);

export default function OrderConfirmationRedirectPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (orderId) {
            const fetchOrder = async () => {
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);
                if (orderSnap.exists()) {
                    setOrder(orderSnap.data() as Order);
                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId]);
    
    useEffect(() => {
        if (order) {
            // The form is submitted via JavaScript as soon as the component mounts with the order data
            const payfastForm = document.getElementById('payfast-form');
            if (payfastForm) {
                payfastForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }
    }, [order]);


    if (isLoading || !order) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Loading your order...</h1>
                <p className="text-muted-foreground">Please wait while we prepare your payment details.</p>
            </div>
        );
    }
    
    const PAYFAST_URL = process.env.NEXT_PUBLIC_PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';
    const MERCHANT_ID = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '10042278';
    const MERCHANT_KEY = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || 'qqci9vis4sszy';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    
    const data = {
        merchant_id: MERCHANT_ID,
        merchant_key: MERCHANT_KEY,
        return_url: `${APP_URL}/payment-success`,
        cancel_url: `${APP_URL}/payment-cancelled`,
        notify_url: `${APP_URL}/api/payfast/notify`,
        name_first: order.customerName.split(' ')[0],
        name_last: order.customerName.split(' ').slice(1).join(' '),
        email_address: order.customerEmail,
        m_payment_id: order.id,
        amount: order.total.toFixed(2),
        item_name: `Order #${order.id}`,
    };
    
    // In a real application, the signature should be generated on the server-side
    // For this example, we'll redirect without a signature, which PayFast might reject.
    // The correct implementation requires an API route to generate the signature.

  return (
    <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Redirecting to PayFast...</h1>
        <p className="text-muted-foreground">Please wait while we securely redirect you to complete your payment.</p>
        
        <form id="payfast-form" action={PAYFAST_URL} method="post" className="hidden">
            {Object.entries(data).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
            ))}
        </form>
    </div>
  );
}
