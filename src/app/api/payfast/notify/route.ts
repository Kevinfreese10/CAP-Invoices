
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, query, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, Service, User, OrderNote, Task } from '@/lib/types';
import { services as allServices } from '@/lib/data';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import NewTaskEmail from '@/components/emails/NewTaskEmail';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}


function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    
    // Create parameter string
    for (const key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            const value = data[key];
            if (value !== '' && value !== null && value !== undefined) {
                pfOutput += `${key}=${rfc3986Encode(String(value).trim())}&`;
            }
        }
    }

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const data: { [key:string]: any } = Object.fromEntries(new URLSearchParams(body));

  console.log('Received PayFast ITN:', data);

  const receivedSignature = data.signature;
  const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);

  if (receivedSignature !== expectedSignature) {
      console.error('Signature mismatch on ITN');
      console.error('Received:', receivedSignature);
      console.error('Expected:', expectedSignature);
      // Even with mismatch, return 200 to prevent retries, but log the error.
      return new NextResponse('Signature mismatch', { status: 200 });
  }
  
  const orderId = data.m_payment_id;
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
      console.error(`Order ${orderId} not found in database.`);
      return new NextResponse('Order not found', { status: 200 }); // Return 200 to stop retries
  }
  
  if (data.payment_status === 'COMPLETE') {
    // Only update the status. The success page will handle the rest.
    await updateDoc(orderRef, {
      status: 'Processing',
    });
    console.log(`Order ${orderId} status updated to Processing via ITN.`);
  } else {
    console.log(`Payment for order ${orderId} not complete. Status: ${data.payment_status}`);
  }

  return new NextResponse('OK', { status: 200 });
}
