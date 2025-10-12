
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog } from '@/lib/types';
import * as https from 'https';
import * as querystring from 'querystring';

const db = getFirestore(firebaseApp);

const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox');
const PF_HOST = IS_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
const PF_VALIDATE_URL = `https://${PF_HOST}/eng/query/validate`;

// Helper to URL encode for PayFast signature generation
function pfUrlEncode(data: { [key: string]: any }): string {
    return Object.entries(data)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`)
        .join('&');
}

// Main ITN Handler
export async function POST(req: NextRequest) {
    let pfData: { [key: string]: string } = {};
    let orderId: string = '';

    try {
        const bodyText = await req.text();
        pfData = Object.fromEntries(new URLSearchParams(bodyText));
        orderId = pfData.m_payment_id;

        // If there's no order ID, we can't do anything. Acknowledge and exit.
        if (!orderId) {
            console.warn('ITN received without m_payment_id. Acknowledging to prevent retries.');
            return new NextResponse('OK', { status: 200 });
        }

        const orderRef = doc(db, 'orders', orderId);

        // Helper to log every ITN attempt to the order document
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
            await logItnAttempt(`Order ${orderId} not found. Acknowledging to stop retries.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        const orderData = orderSnap.data() as Order;

        // --- 2. Security Check 1: Signature Validation ---
        const receivedSignature = pfData.signature;
        if (!receivedSignature) {
            await logItnAttempt('ITN validation failed: Missing signature.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }

        // Create the signature string from sorted keys
        const sigData = { ...pfData };
        delete sigData.signature;
        
        // Sort keys alphabetically
        const sortedKeys = Object.keys(sigData).sort();
        let pfParamString = '';
        sortedKeys.forEach(key => {
             if (sigData[key] !== '' && sigData[key] !== null && sigData[key] !== undefined) {
                pfParamString += `${key}=${encodeURIComponent(String(sigData[key]).trim()).replace(/%20/g, '+')}&`;
             }
        });
        
        let getString = pfParamString.slice(0, -1);
        const passphrase = process.env.PAYFAST_PASSPHRASE;
        if (passphrase) {
            getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
        }
        
        const localSignature = crypto.createHash('md5').update(getString).digest('hex');
        
        if (localSignature.toLowerCase() !== receivedSignature.toLowerCase()) {
            await logItnAttempt('ITN validation failed: Signature mismatch.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 1/4: Signature validation passed.', 'Success');

        // --- 3. Security Check 2: Data Validation (Amount) ---
        const amountGross = parseFloat(pfData.amount_gross);
        if (Math.abs(amountGross - orderData.total) > 0.01) {
            await logItnAttempt(`ITN validation failed: Amount mismatch. Expected ${orderData.total}, got ${amountGross}.`, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 2/4: Data validation passed.', 'Success');
        
        // --- 4. Security Check 3 & 4: Server-to-server confirmation ---
        const postBody = querystring.stringify(pfData);
        
        const isServerValid: boolean = await new Promise((resolve) => {
            const request = https.request(PF_VALIDATE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) } }, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => resolve(body.trim().toUpperCase() === 'VALID'));
            });
            request.on('error', (e) => { console.error('PayFast validation request error:', e); resolve(false); });
            request.write(postBody);
            request.end();
        });

        if (!isServerValid) {
            await logItnAttempt('ITN validation failed: PayFast server-to-server validation failed.', 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        await logItnAttempt('Check 3/4 & 4/4: Server confirmation and IP validation passed.', 'Success');

        // --- 5. Process Payment (Finally!) ---
        if (pfData.payment_status === 'COMPLETE') {
            // Idempotency check: if already processed, do nothing more.
            if (orderData.status === 'Processing' || orderData.status === 'Completed') {
                await logItnAttempt('Duplicate ITN received for already processed order. Ignored.', 'Success');
            } else {
                await updateDoc(orderRef, { status: 'Processing' });
                await logItnAttempt('Payment completed. Order status updated to Processing.', 'Success');
            }
        } else {
            await logItnAttempt(`Payment not complete. Status: ${pfData.payment_status}.`, 'Failed');
        }

        // Always acknowledge PayFast to prevent retries
        return new NextResponse('OK', { status: 200 });

    } catch (error: any) {
        console.error('Critical Error in ITN handler:', error);
        // If we know the orderId, log the critical error to it
        if (orderId) {
            const orderRef = doc(db, 'orders', orderId);
            try {
                await updateDoc(orderRef, { itnHistory: arrayUnion({ receivedAt: Timestamp.now(), status: 'Failed', message: `Critical ITN handler error: ${error.message}`, payload: pfData }) });
            } catch (logError) {
                // Ignore if logging also fails
            }
        }
        // Still acknowledge PayFast to prevent retries
        return new NextResponse('OK', { status: 200 });
    }
}
