
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion, Timestamp, setDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import crypto from 'crypto';
import { Order, ItnLog, User, SubscriptionData } from '@/lib/types';
import dns from 'dns';
import { promisify } from 'util';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import WelcomeDiscountEmail from '@/components/emails/WelcomeDiscountEmail';
import { add } from 'date-fns';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const lookup = promisify(dns.lookup);

// --- PayFast Utility Functions ---
function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    let pfParamString = '';
    for (const key in data) {
        if (data.hasOwnProperty(key) && key !== 'signature') {
            pfParamString += `${key}=${encodeURIComponent(String(data[key]).trim()).replace(/%20/g, '+')}&`;
        }
    }
    pfParamString = pfParamString.slice(0, -1);
    if (passphrase) {
        pfParamString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }
    return crypto.createHash('md5').update(pfParamString).digest('hex');
}

async function isValidPayFastIP(request: NextRequest): Promise<boolean> {
    if (process.env.NODE_ENV === 'development' || request.headers.get('X-PayFast-Simulation') === 'true') {
        return true;
    }
    const validHosts = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];
    const requestIp = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!requestIp) return false;
    try {
        const resolvedIps = await Promise.all(validHosts.map(host => lookup(host).then(res => res.address).catch(() => null)));
        return resolvedIps.filter(Boolean).includes(requestIp);
    } catch (error) {
        console.error("IP lookup failed:", error);
        return false;
    }
}

async function validateWithPayFastServer(data: { [key: string]: any }, isSimulation: boolean): Promise<boolean> {
    if (isSimulation) return true;
    const pfHost = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox') ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
    const url = `https://${pfHost}/eng/query/validate`;
    const body = new URLSearchParams(data).toString();
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!response.ok) return false;
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
        formData.forEach((value, key) => { data[key] = value; });
        console.log('Received PayFast ITN:', data);
        
        const orderId = data.m_payment_id;
        if (!orderId) return new NextResponse('Order ID (m_payment_id) missing', { status: 400 });
        
        const isSimulation = req.headers.get('X-PayFast-Simulation') === 'true';
        const orderRef = doc(db, 'orders', orderId);

        const logItnAttempt = async (status: ItnLog['status'], message: string) => {
            const logEntry: ItnLog = { receivedAt: Timestamp.now(), status, message, payload: data };
            try { await updateDoc(orderRef, { itnHistory: arrayUnion(logEntry) }); } 
            catch (error) { console.error(`Failed to log ITN attempt for order ${orderId}:`, error); }
        };

        const passphrase = process.env.PAYFAST_PASSPHRASE;
        const receivedSignature = data.signature;
        const { signature, ...dataForSigning } = data;
        const expectedSignature = generateSignature(dataForSigning, passphrase);
        if (receivedSignature !== expectedSignature) {
            await logItnAttempt('Failed', 'Security Check 1 FAILED: Signature mismatch.');
            return new NextResponse('Signature mismatch', { status: 400 });
        }
        await logItnAttempt('Success', 'Security Check 1 PASSED: Signature validation successful.');

        const isIpValid = await isValidPayFastIP(req);
        if (!isIpValid) {
            await logItnAttempt('Failed', 'Security Check 2 FAILED: Request did not originate from a valid PayFast IP.');
            return new NextResponse('Invalid source IP', { status: 400 });
        }
        await logItnAttempt('Success', 'Security Check 2 PASSED: IP address is valid.');
        
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found in database.`);
            return new NextResponse('Order not found', { status: 404 });
        }
        const order = orderSnap.data() as Order;

        const grossAmount = parseFloat(data.amount_gross);
        if (Math.abs(grossAmount - order.total) > 0.01) {
            await logItnAttempt('Failed', `Security Check 3 FAILED: Amount mismatch. Expected ${order.total}, received ${grossAmount}.`);
            return new NextResponse('Amount mismatch', { status: 400 });
        }
        await logItnAttempt('Success', 'Security Check 3 PASSED: Payment amount matches order total.');

        const isServerValid = await validateWithPayFastServer(data, isSimulation);
        if (!isServerValid) {
            await logItnAttempt('Failed', 'Security Check 4 FAILED: PayFast server validation failed.');
            return new NextResponse('Server validation failed', { status: 400 });
        }
        await logItnAttempt('Success', 'Security Check 4 PASSED: Server-to-server confirmation successful.');

        if (data.payment_status === 'COMPLETE') {
            // Handle different order sources
            if (order.source === 'AI Accountant Signup') {
                const signupData = (order as any).signupData;
                if (signupData) { // This is a NEW signup with once-off fees
                    const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
                    const newFirebaseUser = userCredential.user;
                    const authUid = newFirebaseUser.uid;
                    const newUserDocRef = doc(db, "aiAccountantClients", authUid);
                    
                    const rulesQuery = query(collection(db, 'allocationRules'), orderBy('description'));
                    const rulesSnapshot = await getDocs(rulesQuery);
                    const globalRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

                    const subscriptionEndDate = add(new Date(), { days: 30 });

                    await setDoc(newUserDocRef, {
                        ...signupData,
                        name: `${signupData.name} ${signupData.surname}`,
                        companyName: `${signupData.name} ${signupData.surname}`,
                        id: authUid, uid: authUid, role: 'client', source: 'AI Accountant', hasNumeraProfile: true,
                        chartOfAccounts: initialChartOfAccounts, allocationRules: globalRules,
                        createdAt: serverTimestamp(),
                        subscription: {
                            ...signupData,
                            monthlyTotal: order.total,
                            catchUpFee: order.items.find(i => i.id === 'catch-up-fee')?.price || 0,
                            payrollSetupFee: order.items.find(i => i.id === 'payroll-setup')?.price || 0,
                            subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
                            subscriptionStatus: 'active',
                        }
                    });

                    try {
                        const emailHtml = render(<WelcomeDiscountEmail name={signupData.name} discountCode={"SIGNUP-WELCOME"} />);
                        await sendEmail({
                            to: signupData.email,
                            subject: `Welcome to My Accountant!`,
                            html: emailHtml,
                            bcc: 'kev@thinkestry.co.za',
                        });
                    } catch (emailError) {
                        console.error("Failed to send welcome email after payment:", emailError);
                    }
                     await updateDoc(orderRef, { status: 'Completed' }); // Complete the signup order
                } else if (order.renewalForClientId) { // This is a RENEWAL payment
                     const clientRef = doc(db, 'aiAccountantClients', order.renewalForClientId);
                     const clientSnap = await getDoc(clientRef);
                     if (clientSnap.exists()) {
                         const clientData = clientSnap.data() as User;
                         const currentSub = clientData.subscription || {};
                         const newEndDate = add(new Date(), { days: 30 });

                         await updateDoc(clientRef, {
                             'subscription.subscriptionStatus': 'active',
                             'subscription.subscriptionEndDate': Timestamp.fromDate(newEndDate),
                         });
                         await updateDoc(orderRef, { status: 'Completed' });
                     }
                }
            } else {
                 // Handle a standard product/service order
                await updateDoc(orderRef, { status: 'Processing' });
            }

            await logItnAttempt('Success', `Payment complete. Order status updated.`);
        } else {
            await logItnAttempt('Failed', `Payment status was '${data.payment_status}', not 'COMPLETE'.`);
        }

        return new NextResponse('OK', { status: 200 });

    } catch (error) {
        console.error('PayFast ITN Global Error:', error);
        return new NextResponse('Error processing ITN', { status: 500 });
    }
}
