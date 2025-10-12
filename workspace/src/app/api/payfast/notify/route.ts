
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';

const db = getFirestore(firebaseApp);

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}


function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfOutput = '';
    
    const orderedKeys = [
        'm_payment_id', 'pf_payment_id', 'payment_status', 'item_name', 'item_description',
        'amount_gross', 'amount_fee', 'amount_net', 'custom_str1', 'custom_str2',
        'custom_str3', 'custom_str4', 'custom_str5', 'custom_int1', 'custom_int2',
        'custom_int3', 'custom_int4', 'custom_int5', 'name_first', 'name_last',
        'email_address', 'merchant_id'
    ];

    orderedKeys.forEach(key => {
        if (data.hasOwnProperty(key) && data[key] !== '' && data[key] !== null && data[key] !== undefined) {
             pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    });

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
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
        console.error('Received:', receivedSignature);
        console.error('Expected:', expectedSignature);
        return new NextResponse('Signature mismatch', { status: 400 });
    }
    
    const orderId = data.m_payment_id;
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
        console.error(`Order ${orderId} not found in database.`);
        return new NextResponse('Order not found', { status: 404 });
    }
    
    if (data.payment_status === 'COMPLETE') {
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
