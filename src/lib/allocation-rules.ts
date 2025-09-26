
import { AllocationRule } from './types';

export const allocationRules: AllocationRule[] = [
    {
        id: 'rule-1',
        keyword: 'bank charges',
        accountId: '3200/000', // Bank Charges
        vatType: 'no_vat',
    },
    {
        id: 'rule-2',
        keyword: 'telkom',
        accountId: '4600/000', // Telephone & Fax
        vatType: 'standard_rated_purchases',
    },
    {
        id: 'rule-3',
        keyword: 'monthly fee',
        accountId: '3200/000', // Bank Charges
        vatType: 'no_vat',
    }
];
