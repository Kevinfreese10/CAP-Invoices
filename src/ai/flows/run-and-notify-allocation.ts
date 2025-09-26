'use server';
/**
 * @fileOverview A background flow for running AI transaction allocation and sending an email notification.
 * 
 * - runAndNotifyAllocation - A function that orchestrates the AI allocation and email notification.
 * - RunAndNotifyAllocationInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { allocateTransaction } from './allocate-transaction';
import { sendEmail } from '@/lib/email';
import { getFirestore, writeBatch, doc, collection, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

const ImportedTransactionSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    bankAccountId: z.string(),
});

export const RunAndNotifyAllocationInputSchema = z.object({
  clientName: z.string().describe("The name of the client for whom the allocation is being run."),
  transactions: z.array(ImportedTransactionSchema).describe("An array of unallocated transactions to process."),
});
export type RunAndNotifyAllocationInput = z.infer<typeof RunAndNotifyAllocationInputSchema>;

export async function runAndNotifyAllocation(
  input: RunAndNotifyAllocationInput
): Promise<void> {
  await runAndNotifyAllocationFlow(input);
}

const runAndNotifyAllocationFlow = ai.defineFlow(
  {
    name: 'runAndNotifyAllocationFlow',
    inputSchema: RunAndNotifyAllocationInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    
    const allocationPromises = input.transactions.map(async (tx) => {
        try {
            const result = await allocateTransaction({ description: tx.description });
            return {
                originalTx: tx,
                ...result,
            };
        } catch (error) {
            console.error(`AI allocation failed for transaction ${tx.id}:`, error);
            return null; // Return null for failed allocations
        }
    });

    const results = await Promise.all(allocationPromises);
    const successfulAllocations = results.filter(Boolean);

    // BATCH-WRITE to Firestore
    if (successfulAllocations.length > 0) {
        const batch = writeBatch(db);
        
        successfulAllocations.forEach(alloc => {
            if (!alloc) return;

            const { originalTx, accountNumber, vatType } = alloc;
            const { id, ...restOfTx } = originalTx;

            const newAllocatedTransaction = {
                ...restOfTx,
                allocatedTo: { value: accountNumber, type: 'account' as const },
                vatType: vatType,
                vatAmount: 0, // Placeholder
                allocatedAt: new Date(),
            };

            const newDocRef = doc(collection(db, 'allocatedTransactions'));
            batch.set(newDocRef, newAllocatedTransaction);

            const oldDocRef = doc(db, 'unallocatedTransactions', id);
            batch.delete(oldDocRef);
        });

        await batch.commit();
    }
    
    // SEND NOTIFICATION EMAIL
    const emailSubject = `AI Allocation Complete for ${input.clientName}`;
    const emailHtml = `
      <h1>AI Allocation Process Finished</h1>
      <p>The automated AI transaction allocation process for <strong>${input.clientName}</strong> has completed.</p>
      <p><strong>${successfulAllocations.length} out of ${input.transactions.length}</strong> selected transactions were successfully allocated.</p>
      <p>You can now review the allocated transactions in the Numera dashboard.</p>
    `;

    await sendEmail({
      to: 'kev@thinkestry.co.za',
      subject: emailSubject,
      html: emailHtml,
    });
  }
);
