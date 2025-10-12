
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog, Service, User, Task } from '@/lib/types';
import { allServices } from '@/lib/data';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import * as https from 'https';
import * as querystring from 'querystring';

const db = getFirestore(firebaseApp);
const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox');
const PF_HOST = IS_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

// Helper to generate signature for validation
function generateSignature(data: { [key: string]: string }, passphrase?: string): string {
    // Create parameter string
    let pfOutput = '';
    for (let key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
        }
    }

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}


// Server-to-server validation function
async function pfValidServerConfirmation(pfData: { [key: string]: string }): Promise<boolean> {
  const postBody = querystring.stringify(pfData);
  const url = `https://${PF_HOST}/eng/query/validate`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve(body.trim().toUpperCase() === 'VALID');
      });
    });

    req.on('error', (e) => {
      console.error('PayFast validation request error:', e);
      reject(e);
    });

    req.write(postBody);
    req.end();
  });
}


// Main handler for the ITN POST request
export async function POST(req: NextRequest) {
    let pfData: { [key: string]: string } = {};
    let orderId: string = '';

    try {
        const bodyText = await req.text();
        pfData = Object.fromEntries(new URLSearchParams(bodyText));
        orderId = pfData.m_payment_id;

        if (!orderId) {
            console.warn('ITN received without m_payment_id.');
            return new NextResponse('OK', { status: 200 }); // Acknowledge to prevent retries
        }

        const orderRef = doc(db, 'orders', orderId);
        
        const logItnAttempt = async (message: string, status: ItnLog['status']) => {
            const logEntry: ItnLog = {
                receivedAt: Timestamp.now(),
                status: status,
                message: message,
                payload: pfData,
            };
            try {
                await updateDoc(orderRef, { itnHistory: arrayUnion(logEntry) });
            } catch (logError) {
                console.error(`Failed to log ITN attempt for order ${orderId}:`, logError);
            }
        };

        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            await logItnAttempt(`Order ${orderId} not found.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        const orderData = orderSnap.data() as Order;

        // 1. Signature validation
        const receivedSignature = pfData.signature;
        if (!receivedSignature) {
            await logItnAttempt('ITN missing signature.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        
        const localSignature = generateSignature(pfData, process.env.PAYFAST_PASSPHRASE);
        if (localSignature.toLowerCase() !== receivedSignature.toLowerCase()) {
            await logItnAttempt(`Signature mismatch.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        // 2. Data validation
        const amountGross = parseFloat(pfData.amount_gross);
        if (Math.abs(amountGross - orderData.total) > 0.01) {
            await logItnAttempt(`Amount mismatch. Expected ${orderData.total}, got ${amountGross}.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        // 3. Server-to-server confirmation
        const isDataValid = await pfValidServerConfirmation(pfData);
        if (!isDataValid) {
            await logItnAttempt('PayFast server-to-server validation failed.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        // 4. Check payment status
        if (pfData.payment_status === 'COMPLETE') {
            // Idempotency check: if already processed, do nothing but log success.
            if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                await logItnAttempt('Duplicate ITN received for already processed order. Ignored.', 'Success');
                return new NextResponse('OK', { status: 200 });
            }

            await updateDoc(orderRef, { status: 'Processing' });
            await logItnAttempt('Payment completed successfully. Order status updated to Processing.', 'Success');
            // Post-payment actions can be triggered here or by a Firestore trigger
        } else {
            await logItnAttempt(`Payment not complete. Status: ${pfData.payment_status}.`, 'Failed');
        }

        return new NextResponse('OK', { status: 200 });

    } catch (error: any) {
        console.error('Critical Error in ITN handler:', error);
        if (orderId) {
             const orderRef = doc(db, 'orders', orderId);
             await updateDoc(orderRef, { itnHistory: arrayUnion({ receivedAt: Timestamp.now(), status: 'Failed', message: `Critical ITN handler error: ${error.message}`, payload: pfData }) });
        }
        return new NextResponse('OK', { status: 200 });
    }
}
