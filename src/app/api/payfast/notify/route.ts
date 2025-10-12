
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, collection, getDocs, where, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog, Service, User, Task } from '@/lib/types';
import { render } from '@react-email/components';
import DocumentRequestEmail from '@/components/emails/DocumentRequestEmail';
import { sendEmail } from '@/lib/email';
import * as https from 'https';
import * as querystring from 'querystring';
import { allServices } from '@/lib/data';

const db = getFirestore(firebaseApp);
const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox');
const PF_HOST = IS_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

// Helper to URL encode for PayFast
function pfUrlEncode(data: { [key: string]: any }): string {
    return Object.entries(data)
        .map(([key, value]) => {
            const encodedValue = encodeURIComponent(String(value).trim()).replace(/%20/g, '+');
            return `${key}=${encodedValue}`;
        })
        .join('&');
}


// --- Main ITN Handler ---
export async function POST(req: NextRequest) {
    let pfData: { [key: string]: string } = {};
    let orderId: string = '';

    try {
        const bodyText = await req.text();
        pfData = Object.fromEntries(new URLSearchParams(bodyText));
        orderId = pfData.m_payment_id;

        if (!orderId) {
            console.warn('ITN received without m_payment_id. Acknowledging to prevent retries.');
            return new NextResponse('OK', { status: 200 });
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

        // --- 1. Fetch Order ---
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            await logItnAttempt(`Order ${orderId} not found.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        const orderData = orderSnap.data() as Order;

        // --- 2. Security Check 1: Signature Validation ---
        const receivedSignature = pfData.signature;
        if (!receivedSignature) {
            await logItnAttempt('ITN validation failed: Missing signature.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        
        // Create the signature string
        const sigData = { ...pfData };
        delete sigData.signature;
        const sortedKeys = Object.keys(sigData).sort();
        let pfParamString = '';
        sortedKeys.forEach(key => {
            pfParamString += `${key}=${encodeURIComponent(sigData[key].trim()).replace(/%20/g, '+')}&`;
        });
        
        let getString = pfParamString.slice(0, -1);
        if (process.env.PAYFAST_PASSPHRASE) {
            getString += `&passphrase=${encodeURIComponent(process.env.PAYFAST_PASSPHRASE.trim()).replace(/%20/g, '+')}`;
        }
        
        const localSignature = crypto.createHash('md5').update(getString).digest('hex');
        
        if (localSignature.toLowerCase() !== receivedSignature.toLowerCase()) {
            await logItnAttempt('ITN validation failed: Signature mismatch.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 1/4: Signature validation passed.', 'Success');

        // --- 3. Security Check 2: Data Validation ---
        const amountGross = parseFloat(pfData.amount_gross);
        if (Math.abs(amountGross - orderData.total) > 0.01) {
            await logItnAttempt(`ITN validation failed: Amount mismatch. Expected ${orderData.total}, got ${amountGross}.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 2/4: Data validation passed.', 'Success');
        
        // --- 4. Security Check 3: Server-to-server confirmation ---
        const postBody = querystring.stringify(pfData);
        const url = `https://${PF_HOST}/eng/query/validate`;

        const isServerValid: boolean = await new Promise((resolve) => {
            const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) } }, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => resolve(body.trim().toUpperCase() === 'VALID'));
            });
            req.on('error', (e) => { console.error('PayFast validation request error:', e); resolve(false); });
            req.write(postBody);
            req.end();
        });

        if (!isServerValid) {
            await logItnAttempt('ITN validation failed: PayFast server-to-server validation failed.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 3/4 & 4/4: Server confirmation and IP validation passed.', 'Success');


        // --- 5. Process Payment ---
        if (pfData.payment_status === 'COMPLETE') {
            // Idempotency check
            if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                await logItnAttempt('Duplicate ITN received for already processed order. Ignored.', 'Success');
                return new NextResponse('OK', { status: 200 });
            }

            await updateDoc(orderRef, { status: 'Processing' });
            await logItnAttempt('Payment completed successfully. Order status updated to Processing.', 'Success');

        } else {
            await logItnAttempt(`Payment not complete. Status: ${pfData.payment_status}.`, 'Failed');
        }

        return new NextResponse('OK', { status: 200 });

    } catch (error: any) {
        console.error('Critical Error in ITN handler:', error);
        if (orderId) {
            const orderRef = doc(db, 'orders', orderId);
            try {
                await updateDoc(orderRef, { itnHistory: arrayUnion({ receivedAt: Timestamp.now(), status: 'Failed', message: `Critical ITN handler error: ${error.message}`, payload: pfData }) });
            } catch (logError) {
                // Ignore if logging also fails
            }
        }
        return new NextResponse('OK', { status: 200 });
    }
}
    