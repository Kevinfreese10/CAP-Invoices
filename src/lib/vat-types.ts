
import { VatType } from './types';

export const allVatTypes: { name: VatType, label: string, category: 'Output Tax' | 'Input Tax' | 'Other' }[] = [
    { name: 'standard_rated_sales', label: 'Standard-rated supplies (15%)', category: 'Output Tax' },
    { name: 'zero_rated_sales', label: 'Zero-rated supplies (0%)', category: 'Output Tax' },
    { name: 'exempt_sales', label: 'Exempt supplies', category: 'Output Tax' },
    { name: 'standard_rated_purchases', label: 'Standard-rated purchases (15%)', category: 'Input Tax' },
    { name: 'capital_goods_purchases', label: 'Capital goods (15%)', category: 'Input Tax' },
    { name: 'zero_rated_purchases', label: 'Zero-rated purchases (0%)', category: 'Input Tax' },
    { name: 'exempt_purchases', label: 'Exempt purchases', category: 'Input Tax' },
    { name: 'no_vat', label: 'No VAT', category: 'Other' },
];
