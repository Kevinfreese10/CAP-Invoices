
import { AllocationRule } from './types';

export const allocationRules: AllocationRule[] = [
    {
        id: 'rule-1',
        keywords: ['bank charges', 'monthly fee', 'bank fee'],
        accountId: '3200/000', // Bank Charges
        vatType: 'no_vat',
    },
    {
        id: 'rule-2',
        keywords: ['telkom'],
        accountId: '4600/000', // Telephone & Fax
        vatType: 'standard_rated_purchases',
    }
];
