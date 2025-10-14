
// /src/app/api/numera/start-ai-allocation/route.ts
import { NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, arrayUnion, writeBatch, collection, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ImportedTransaction, AllocatedTransaction, User, VatType } from '@/lib/types';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';

const db = getFirestore(firebaseApp);

const calculateVat = (amount: number, vatType: VatType, isVatRegistered: boolean): number => {
    if (!isVatRegistered) return 0;
    if (vatType === 'standard_rated_purchases' || vatType === 'standard_rated_sales' || vatType === 'capital_goods_purchases') {
        return amount * (15 / 115);
    }
    return 0;
};

export async function POST(req: Request) {
    try {
        const { clientId, transactions } = await req.json();

        if (!clientId || !transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return NextResponse.json({ error: 'Client ID and transactions are required.' }, { status: 400 });
        }

        const jobRef = await addDoc(collection(db, 'aiAllocationJobs'), {
            clientId,
            status: 'running',
            total: transactions.length,
            processed: 0,
            createdAt: serverTimestamp(),
        });
        const jobId = jobRef.id;
        
        // Start the background job but don't wait for it
        processTransactionsInBackground(jobId, clientId, transactions);

        return NextResponse.json({ message: `AI allocation job started for ${transactions.length} transactions.`, jobId });

    } catch (error: any) {
        console.error('Error starting AI allocation:', error);
        return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
    }
}

async function processTransactionsInBackground(jobId: string, clientId: string, transactions: ImportedTransaction[]) {
    const jobRef = doc(db, 'aiAllocationJobs', jobId);

    try {
        const clientRef = doc(db, 'numeraClients', clientId);
        const clientSnap = await getDoc(clientRef);

        if (!clientSnap.exists()) {
            throw new Error(`Client with ID ${clientId} not found.`);
        }

        const clientData = clientSnap.data() as User;
        const chartOfAccountsStr = JSON.stringify(clientData.chartOfAccounts?.map(a => ({ id: a.id, accountNumber: a.accountNumber, description: a.description })));
        const isVatRegistered = clientData.isVatRegistered || false;
        
        let processedCount = 0;

        for (const tx of transactions) {
            const jobSnap = await getDoc(jobRef);
            if (jobSnap.exists() && jobSnap.data().status === 'stopped') {
                console.log(`Job ${jobId} was stopped by the user.`);
                return; // Exit the loop
            }

            try {
                const suggestion = await suggestTransactionAllocation({ description: tx.description, chartOfAccounts: chartOfAccountsStr });

                if (suggestion && suggestion.confidence > 50) {
                    const allocatedTx: AllocatedTransaction = {
                        ...tx,
                        allocatedTo: { value: suggestion.accountId, type: 'account' },
                        vatType: isVatRegistered ? suggestion.vatType : 'no_vat',
                        vatAmount: calculateVat(tx.amount, suggestion.vatType, isVatRegistered),
                        allocatedAt: new Date(),
                    };
                    
                    const batch = writeBatch(db);
                    const currentClientData = (await getDoc(clientRef)).data() as User;
                    const updatedImported = currentClientData.importedTransactions?.filter(impTx => impTx.id !== tx.id) || [];
                    
                    batch.update(clientRef, {
                        importedTransactions: updatedImported,
                        allocatedTransactions: arrayUnion(allocatedTx)
                    });
                    await batch.commit();
                }
            } catch (aiError) {
                console.error(`AI allocation failed for transaction ${tx.id}:`, aiError);
            }
            
            processedCount++;
            await updateDoc(jobRef, { processed: processedCount });
        }

        // Mark job as complete
        await updateDoc(jobRef, { status: 'completed', completedAt: serverTimestamp() });

        console.log(`AI Allocation job ${jobId} completed successfully.`);

    } catch (error) {
        console.error(`Error in background job ${jobId}:`, error);
        await updateDoc(jobRef, { status: 'failed', error: String(error) });
    }
}
