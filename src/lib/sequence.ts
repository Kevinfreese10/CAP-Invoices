'use server';

import { getFirestore, doc, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

/**
 * Gets the next sequential order ID from a dedicated counter in Firestore.
 * @returns {Promise<string>} The next order ID as a string.
 */
export async function getNextOrderId(): Promise<string> {
  const counterRef = doc(db, 'sequences', 'orders');

  try {
    const newId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists()) {
        // If the counter doesn't exist, start at 9400.
        transaction.set(counterRef, { current: 9400 });
        return '9400';
      }

      const newCurrentValue = counterDoc.data().current + 1;
      transaction.update(counterRef, { current: newCurrentValue });
      return newCurrentValue.toString();
    });
    
    return newId;
  } catch (e) {
    console.error("Transaction failed: ", e);
    // Fallback to a timestamp-based ID in case of transaction failure
    // to ensure order creation doesn't completely fail.
    return `ERR-${Date.now()}`;
  }
}
