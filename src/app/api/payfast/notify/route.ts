
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data: { [key: string]: any } = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    console.log('Received PayFast ITN:', data);
    
    const orderId = data.m_payment_id;
    
    if (data.payment_status === 'COMPLETE') {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'Processing',
      });
      console.log(`Order ${orderId} updated to Processing.`);
    } else {
      console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('PayFast ITN Error:', error);
    return new NextResponse('Error processing ITN', { status: 500 });
  }
}
