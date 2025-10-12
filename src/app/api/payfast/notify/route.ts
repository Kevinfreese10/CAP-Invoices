
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
  // Create parameter string
  let pfOutput = '';
  for (const key in data) {
    if (data.hasOwnProperty(key) && key !== 'signature') {
      pfOutput += `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}&`;
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);
  if (passphrase) {
    getString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(getString).digest('hex');
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data: { [key:string]: any } = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    console.log('Received PayFast ITN:', data);

    const receivedSignature = data.signature;
    const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);

    if (receivedSignature !== expectedSignature) {
        console.error('Signature mismatch on ITN');
        return new NextResponse('Signature mismatch', { status: 400 });
    }
    
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
