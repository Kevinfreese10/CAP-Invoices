
import { AllocationRule } from './types';

// This file now serves as a fallback or initial seed.
// The main application logic will fetch rules from Firestore.
export const allocationRules: AllocationRule[] = [
    {
        id: 'rule-1',
        type: 'hard',
        keywords: ['bank charges', 'monthly fee', 'bank fee', 'fee'],
        description: 'Catches various bank service fees.',
        accountId: '3200/000', // Bank Charges
        vatType: 'no_vat',
    },
    {
        id: 'rule-2',
        type: 'hard',
        keywords: ['telkom'],
        description: 'For Telkom landline and internet services.',
        accountId: '4600/000', // Telephone & Fax
        vatType: 'standard_rated_purchases',
    },
    {
        id: 'rule-3',
        type: 'soft',
        keywords: [],
        description: 'All fast food purchases must be allocated to Entertainment.',
        accountId: '3700/000', // Entertainment Expenses
        vatType: 'no_vat',
    },
    {
        id: 'rule-diamatrix',
        type: 'hard',
        keywords: ['diamatrix'],
        description: 'Diamatrix software should be computer expenses.',
        accountId: '3300/000', // Computer Expenses
        vatType: 'standard_rated_purchases',
    }
];
