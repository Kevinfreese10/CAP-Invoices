
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import crypto from 'crypto';
import { Order, ItnLog } from '@/lib/types';
import dns from 'dns';
import { promisify } from 'util';

const db = getFirestore(firebaseApp);
const lookup = promisify(dns.lookup);

// --- PayFast Utility Functions ---

/**
 * Generates a PayFast signature from a data object.
 * @param data The data object to sign.
 * @param passphrase The merchant's passphrase.
 * @returns The MD5 signature hash.
 */
function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    // Create the parameter string by concatenating key-value pairs from the data object
    let pfParamString = '';
    for (const key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            pfParamString += `${key}=${encodeURIComponent(String(data[key]).trim()).replace(/%20/g, '+')}&`;
        }
    }

    // Remove the last ampersand
    pfParamString = pfParamString.slice(0, -1);

    if (passphrase) {
        pfParamString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(pfParamString).digest('hex');
}

/**
 * Validates if the request IP is from a valid PayFast host.
 * @param request The incoming NextRequest.
 * @returns A promise that resolves to a boolean.
 */
async function isValidPayFastIP(request: NextRequest): Promise<boolean> {
    // For local development and testing via the simulator, bypass the IP check
    if (process.env.NODE_ENV === 'development' || request.headers.get('X-PayFast-Simulation') === 'true') {
        return true;
    }

    const validHosts = [
        'www.payfast.co.za',
        'sandbox.payfast.co.za',
        'w1w.payfast.co.za',
        'w2w.payfast.co.za',
    ];

    const requestIp = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!requestIp) {
        return false;
    }

    try {
        const resolvedIps = await Promise.all(
            validHosts.map(host => lookup(host).then(res => res.address).catch(() => null))
        );
        const validIps = resolvedIps.filter((ip): ip is string => ip !== null);
        return validIps.includes(requestIp);
    } catch (error) {
        console.error("IP lookup failed:", error);
        return false;
    }
}

/**
 * Performs server-to-server confirmation of the transaction with PayFast.
 * @param data The ITN payload.
 * @returns A promise that resolves to a boolean.
 */
async function validateWithPayFastServer(data: { [key: string]: any }): Promise<boolean> {
    const pfHost = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox') 
        ? 'sandbox.payfast.co.za' 
        : 'www.payfast.co.za';
        
    const url = `https://${pfHost}/eng/query/validate`;
    
    const body = new URLSearchParams(data).toString();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
        });
        
        if (!response.ok) {
            console.error(`PayFast validation request failed with status: ${response.status}`);
            return false;
        }

        const textResponse = await response.text();
        return textResponse.trim().toUpperCase() === 'VALID';
    } catch (error) {
        console.error("Error during server-to-server validation:", error);
        return false;
    }
}


// --- Main ITN Handler ---

export async function POST(req: NextRequest) {
  let data: { [key:string]: any } = {};
  try {
    const formData = await req.formData();
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
    
    // Security Check 1: Signature Verification
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    const receivedSignature = data.signature;
    // To validate, we generate a signature from the data *excluding* the 'signature' field itself.
    const { signature, ...dataForSigning } = data;
    const expectedSignature = generateSignature(dataForSigning, passphrase);
    
    if (receivedSignature !== expectedSignature) {
        const errorMessage = `Security Check 1 FAILED: Signature mismatch.`;
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Signature mismatch', { status: 400 });
    }
    await logItnAttempt('Success', `Security Check 1 PASSED: Signature validation successful.`);

    // Security Check 2: IP Address Verification
    const isIpValid = await isValidPayFastIP(req);
    if (!isIpValid) {
        const errorMessage = `Security Check 2 FAILED: Request did not originate from a valid PayFast IP.`;
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Invalid source IP', { status: 400 });
    }
    await logItnAttempt('Success', `Security Check 2 PASSED: IP address is valid.`);
    
    // Fetch Order Data
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
        const errorMessage = `Order ${orderId} not found in database.`;
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Order not found', { status: 404 });
    }
    const order = orderSnap.data() as Order;

    // Security Check 3: Payment Data Comparison
    const grossAmount = parseFloat(data.amount_gross);
    const orderTotal = order.total;
    if (Math.abs(grossAmount - orderTotal) > 0.01) {
        const errorMessage = `Security Check 3 FAILED: Amount mismatch. Expected ${orderTotal}, received ${grossAmount}.`;
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Amount mismatch', { status: 400 });
    }
    await logItnAttempt('Success', `Security Check 3 PASSED: Payment amount matches order total.`);

    // Security Check 4: Server-to-Server Confirmation
    const isServerValid = await validateWithPayFastServer(data);
    if (!isServerValid) {
        const errorMessage = `Security Check 4 FAILED: PayFast server validation failed.`;
        await logItnAttempt('Failed', errorMessage);
        return new NextResponse('Server validation failed', { status: 400 });
    }
    await logItnAttempt('Success', `Security Check 4 PASSED: Server-to-server confirmation successful.`);


    // All checks passed, update order status
    if (data.payment_status === 'COMPLETE') {
      await updateDoc(orderRef, {
        status: 'Processing',
      });
      await logItnAttempt('Success', `Payment complete. Order status updated to 'Processing'.`);
    } else {
      await logItnAttempt('Failed', `Payment status was '${data.payment_status}', not 'COMPLETE'.`);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('PayFast ITN Global Error:', error);
    // Cannot log to a specific order if we don't have an orderId, but can return a generic error.
    return new NextResponse('Error processing ITN', { status: 500 });
  }
}
