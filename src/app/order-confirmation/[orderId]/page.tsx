
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import crypto from 'crypto-js';

const db = getFirestore(firebaseApp);

type PayfastData = {
    [key: string]: string;
};

export default function OrderConfirmationRedirectPage() {
    const params = useParams();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [payfastData, setPayfastData] = useState<PayfastData | null>(null);
    const orderId = params.orderId as string;
    
    useEffect(() => {
        if (orderId) {
            const fetchOrder = async () => {
                setIsLoading(true);
                const orderRef = doc(db, 'orders', orderId);
                const orderSnap = await getDoc(orderRef);
                if (orderSnap.exists()) {
                    const orderData = { ...orderSnap.data(), id: orderSnap.id } as Order;
                    setOrder(orderData);
                    
                    const nameParts = orderData.customerName.split(' ');
                    const name_first = nameParts[0];
                    const name_last = nameParts.slice(1).join(' ');

                    const itemName = orderData.items.length === 1 ? orderData.items[0].title : `My Accountant - Order #${orderId}`;
                    const itemDescription = orderData.items.map(item => `${item.title} (x${item.quantity})`).join(', ');

                    // The order of these properties is critical for signature generation.
                    const dataForSignature: { [key: string]: any } = {
                        merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
                        merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
                        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`,
                        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-cancelled`,
                        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
                        name_first: name_first,
                        name_last: name_last,
                        email_address: orderData.customerEmail,
                        m_payment_id: orderId,
                        amount: orderData.total.toFixed(2),
                        item_name: itemName,
                        item_description: itemDescription,
                    };
                    
                    try {
                        const response = await fetch('/api/payfast/signature', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ data: dataForSignature }),
                        });
                        const { signature } = await response.json();
                        
                        setPayfastData({ ...dataForSignature, signature });
                    } catch (error) {
                        console.error("Error fetching signature", error);
                    }

                }
                setIsLoading(false);
            };
            fetchOrder();
        }
    }, [orderId]);
    
    useEffect(() => {
        if (payfastData) {
            // The form is submitted via JavaScript as soon as the component mounts with the order data
            const payfastForm = document.getElementById('payfast-form') as HTMLFormElement;
            if (payfastForm) {
                payfastForm.submit();
            }
        }
    }, [payfastData]);


    if (isLoading || !payfastData) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-2xl font-semibold">Loading your order...</h1>
                <p className="text-muted-foreground">Please wait while we prepare your payment details.</p>
            </div>
        );
    }
    
  return (
    <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Redirecting to PayFast...</h1>
        <p className="text-muted-foreground">Please wait while we securely redirect you to complete your payment.</p>
        
        <form id="payfast-form" action={process.env.NEXT_PUBLIC_PAYFAST_URL} method="post" className="hidden">
            {payfastData && Object.entries(payfastData).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
            ))}
        </form>
    </div>
  );
}
