
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog } from '@/lib/types';

const db = getFirestore(firebaseApp);

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    // Exclude the 'signature' field from the data to be hashed
    const { signature, ...restOfData } = data;
    
    // Create the parameter string by concatenating key-value pairs
    let pfParamString = '';
    for (const key in restOfData) {
        if (restOfData.hasOwnProperty(key)) {
            pfParamString += `${key}=${encodeURIComponent(String(restOfData[key]).trim()).replace(/%20/g, '+')}&`;
        }
    }

    // Remove the last ampersand
    pfParamString = pfParamString.slice(0, -1);

    if (passphrase) {
        pfParamString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }
    
    return crypto.createHash('md5').update(pfParamString).digest('hex');
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data: { [key:string]: any } = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    console.log('Received PayFast ITN:', data);
    
    const orderId = data.m_payment_id;
    if (!orderId) {
        return new NextResponse('Order ID (m_payment_id) missing', { status: 400 });
    }
    const orderRef = doc(db, 'orders', orderId);

    const logItnAttempt = async (status: ItnLog['status'], message: string) => {
        const logEntry: ItnLog = {
            receivedAt: Timestamp.now(),
            status: status,
            message: message,
            payload: data,
        };
        try {
            await updateDoc(orderRef, {
                itnHistory: arrayUnion(logEntry)
            });
        } catch (error) {
            console.error(`Failed to log ITN attempt for order ${orderId}:`, error);
        }
    };
    
    const receivedSignature = data.signature;
    const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);
    
    if (receivedSignature !== expectedSignature) {
        const errorMessage = `Signature mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}`;
        console.error(errorMessage);
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Signature mismatch', { status: 400 });
    }
    
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
        const errorMessage = `Order ${orderId} not found in database.`;
        console.error(errorMessage);
        // Cannot log to order if it doesn't exist, but we should still respond.
        return new NextResponse('Order not found', { status: 404 });
    }
    
    if (data.payment_status === 'COMPLETE') {
      await updateDoc(orderRef, {
        status: 'Processing',
      });
      console.log(`Order ${orderId} updated to Processing.`);
      await logItnAttempt('Success', `Payment complete. Order status updated to Processing.`);

    } else {
      const message = `Payment for order ${orderId} not complete. Status: ${data.payment_status}`;
      console.log(message);
      await logItnAttempt('Failed', message);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('PayFast ITN Error:', error);
    return new NextResponse('Error processing ITN', { status: 500 });
  }
}
