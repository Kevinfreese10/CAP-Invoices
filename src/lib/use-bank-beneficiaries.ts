import { useState, useEffect } from 'react';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { DEFAULT_BENEFICIARY_MAP, getBankBeneficiary } from './bank-beneficiaries';

const db = getFirestore(firebaseApp);

let globalOverrides: Record<string, string> = {};
const listeners = new Set<(overrides: Record<string, string>) => void>();
let isSubscribed = false;

function subscribeToBankBeneficiaries() {
  if (isSubscribed || typeof window === 'undefined') return;
  isSubscribed = true;

  try {
    onSnapshot(collection(db, 'bankBeneficiaries'), (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.docs.forEach((doc) => {
        const d = doc.data();
        if (d.supplierName && d.beneficiaryName) {
          map[d.supplierName] = d.beneficiaryName;
        }
      });
      globalOverrides = map;
      listeners.forEach((listener) => listener(globalOverrides));
    }, (error) => {
      console.error('Error listening to bankBeneficiaries:', error);
    });
  } catch (err) {
    console.error('Error subscribing to bankBeneficiaries:', err);
  }
}

export function useBankBeneficiaries() {
  const [overrides, setOverrides] = useState<Record<string, string>>(globalOverrides);

  useEffect(() => {
    subscribeToBankBeneficiaries();

    const handleUpdate = (newOverrides: Record<string, string>) => {
      setOverrides({ ...newOverrides });
    };

    listeners.add(handleUpdate);
    // Sync current state
    if (Object.keys(globalOverrides).length > 0) {
      setOverrides({ ...globalOverrides });
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const getBeneficiary = (supplierName: string): string | null => {
    return getBankBeneficiary(supplierName, overrides);
  };

  return {
    overrides,
    getBeneficiary,
  };
}
