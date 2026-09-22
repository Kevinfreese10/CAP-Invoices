import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account-new.json', 'utf8'));

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

async function checkQueues() {
    const statuses = ['pending_review', 'approved', 'pending_account_review', 'pending_third_review', 'approved_for_payment', 'batched_for_payment'];
    for (const status of statuses) {
        const snap = await db.collection('extractedInvoices').where('status', '==', status).get();
        console.log(`\n=== STATUS: ${status} (${snap.docs.length} invoices) ===`);
        snap.docs.forEach(doc => {
            const d = doc.data();
            console.log(` - ID: ${doc.id} | Supplier: ${d.supplier} | Inv#: ${d.invoiceNumber} | Total: ${d.invoiceTotal} | Batch: ${d.paymentBatch} | Comm#: ${d.commissionNumber}`);
        });
    }
}

checkQueues().catch(console.error);
