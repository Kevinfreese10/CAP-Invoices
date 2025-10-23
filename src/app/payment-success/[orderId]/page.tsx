
'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

export default function PaymentSuccessRedirectPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const router = useRouter();

    useEffect(() => {
        if (orderId) {
            router.replace(`/order-confirmation/${orderId}`);
        } else {
            router.replace('/');
        }
    }, [orderId, router]);

    return null; 
}
