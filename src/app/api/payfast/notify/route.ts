
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog } from '@/lib/types';

const db = getFirestore(firebaseApp);

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    const sigData = { ...data };
    delete sigData.signature;

    // The PayFast ITN signature is calculated on the URL-encoded, alphabetically sorted key-value pairs
    const sortedKeys = Object.keys(sigData).sort();

    let pfOutput = '';
    sortedKeys.forEach(key => {
        if (sigData[key] !== '' && sigData[key] !== null && sigData[key] !== undefined) {
            pfOutput += `${key}=${rfc3986Encode(String(sigData[key]).trim())}&`;
        }
    });

    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    return crypto.createHash('md5').update(getString).digest('hex');
}


export async function POST(req: NextRequest) {
    let data: { [key: string]: string } = {};
    let logMessage = '';
    let logStatus: ItnLog['status'] = 'Failed';
    let orderId = '';
    
    try {
        const bodyText = await req.text();
        data = Object.fromEntries(new URLSearchParams(bodyText));
        orderId = data.m_payment_id;

        const orderRef = orderId ? doc(db, 'orders', orderId) : null;

        const logItnAttempt = async (message: string, status: ItnLog['status']) => {
            if (orderRef) {
                const logEntry: ItnLog = {
                    receivedAt: Timestamp.now(),
                    status: status,
                    message: message,
                    payload: data,
                };
                await updateDoc(orderRef, { itnHistory: arrayUnion(logEntry) });
            }
        };

        // --- 1. SIGNATURE VALIDATION ---
        const receivedSignature = data.signature;
        if (!receivedSignature) {
            logMessage = 'ITN received without signature.';
            console.error(logMessage, { orderId });
            await logItnAttempt(logMessage, 'Failed');
            return new NextResponse('OK', { status: 200 }); // Acknowledge to prevent retries
        }
        
        // Note: The ITN signature calculation is different from the payment signature.
        // It's based on the received POST data, not the initial payment data.
        const expectedSignature = generateSignature(data, process.env.PAYFAST_PASSPHRASE);

        if (receivedSignature.toLowerCase() !== expectedSignature.toLowerCase()) {
            logMessage = `Signature mismatch. Received: ${receivedSignature}, Expected: ${expectedSignature}`;
            console.error(logMessage, { orderId });
            await logItnAttempt(logMessage, 'Failed');
            return new NextResponse('OK', { status: 200 }); // Respond 200 but do not process
        }

        // --- 2. RETRIEVE ORDER & VALIDATE AMOUNT ---
        if (!orderRef) {
             logMessage = 'No m_payment_id in ITN payload.';
             console.error(logMessage);
             return new NextResponse('OK', { status: 200 });
        }
        
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            logMessage = `Order ${orderId} not found in database.`;
            console.error(logMessage);
            return new NextResponse('OK', { status: 200 });
        }
        const orderData = orderSnap.data() as Order;

        const amountGross = parseFloat(data.amount_gross);
        const orderTotal = orderData.total;

        if (Math.abs(amountGross - orderTotal) > 0.01) {
            logMessage = `Amount mismatch for order ${orderId}. Expected ${orderTotal}, but PayFast reported ${amountGross}.`;
            console.error(logMessage);
            await logItnAttempt(logMessage, 'Failed');
            return new NextResponse('OK', { status: 200 });
        }
        
        // --- 4. PROCESS PAYMENT STATUS ---
        if (data.payment_status === 'COMPLETE') {
            if (orderData.status !== 'Processing') {
                await updateDoc(orderRef, { status: 'Processing' });
                logMessage = 'Payment completed successfully. Order status updated to Processing.';
                logStatus = 'Success';
            } else {
                logMessage = 'Duplicate ITN received for already processed order. Ignored.';
                logStatus = 'Success';
            }
        } else {
            logMessage = `Payment not complete. Status: ${data.payment_status}.`;
            logStatus = 'Failed';
        }

        await logItnAttempt(logMessage, logStatus);
        return new NextResponse('OK', { status: 200 });
        
    } catch (error: any) {
        console.error('Critical Error in ITN handler:', error);
        logMessage = `An internal server error occurred: ${error.message}`;
        if(orderId) {
             const orderRef = doc(db, 'orders', orderId);
             try {
                await updateDoc(orderRef, { itnHistory: arrayUnion({
                    receivedAt: Timestamp.now(),
                    status: 'Failed',
                    message: logMessage,
                    payload: data,
                 }) });
             } catch (logError) {
                 console.error("Failed to even log the error to Firestore:", logError);
             }
        }
        // Always respond 200 OK to prevent PayFast from retrying a failing request.
        return new NextResponse('OK', { status: 200 });
    }
}
