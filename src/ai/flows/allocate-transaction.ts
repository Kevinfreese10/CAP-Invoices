'use server';
/**
 * @fileOverview An AI agent for allocating bank transactions.
 * 
 * - allocateTransaction - A function that suggests a GL account for a transaction.
 * - AllocateTransactionInput - The input type for the allocateTransaction function.
 * - AllocateTransactionOutput - The return type for the allocateTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { chartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules } from '@/lib/allocation-rules';
import { VatType } from '@/lib/types';

const AllocateTransactionInputSchema = z.object({
  description: z.string().describe('The transaction description from the bank statement.'),
});
export type AllocateTransactionInput = z.infer<typeof AllocateTransactionInputSchema>;

const vatTypes: z.ZodType<VatType> = z.enum([
    'standard_rated_sales', 'zero_rated_sales', 'exempt_sales',
    'standard_rated_purchases', 'capital_goods_purchases', 'zero_rated_purchases', 'exempt_purchases', 'no_vat'
]);

export const AllocateTransactionOutputSchema = z.object({
  accountNumber: z.string().describe("The suggested account number from the Chart of Accounts."),
  reasoning: z.string().describe("A brief explanation for the suggested allocation."),
  vatType: vatTypes.describe("The suggested VAT type based on the transaction and account. Default to 'no_vat' if unsure or not applicable."),
});
export type AllocateTransactionOutput = z.infer<typeof AllocateTransactionOutputSchema>;

export async function allocateTransaction(
  input: AllocateTransactionInput
): Promise<AllocateTransactionOutput> {
  return allocateTransactionFlow(input);
}

const serializedChartOfAccounts = chartOfAccounts
    .map(acc => `${acc.accountNumber} - ${acc.description}`)
    .join('\n');

const hardRules = allocationRules.filter(r => r.type === 'hard');
const softRules = allocationRules.filter(r => r.type === 'soft');

const serializedHardRules = hardRules
    .map(rule => `If description contains ANY of these keywords: '${rule.keywords.join(', ')}', you MUST use account ${rule.accountId} (${chartOfAccounts.find(a => a.accountNumber === rule.accountId)?.description}) with VAT type '${rule.vatType}'.`)
    .join('\n');

const serializedSoftRules = softRules
    .map(rule => `- ${rule.description} (Use Account: ${rule.accountId}, VAT Type: ${rule.vatType})`)
    .join('\n');


const prompt = ai.definePrompt({
  name: 'allocateTransactionPrompt',
  input: {schema: AllocateTransactionInputSchema},
  output: {schema: AllocateTransactionOutputSchema},
  prompt: `You are an expert South African chartered accountant. Your task is to analyze a bank transaction and suggest the most appropriate General Ledger account and VAT treatment.

Transaction Description:
"{{{description}}}"

**Prioritization Order:**
1.  **Hard Rules (Highest Priority):** These are absolute. If the transaction description contains any of the keywords from the list below, you MUST use the specified account and VAT type. The match does not need to be exact; if the keyword is contained in the description, the rule applies.
2.  **Soft Rules (Conceptual Guidance):** If no hard rule matches, evaluate if the transaction's concept fits any of these broader rules. Use your judgment.
3.  **Chart of Accounts (General Knowledge):** If no specific rule matches, use your expertise to choose the best account from the general chart of accounts.
4.  **VAT Rules:** Apply the correct VAT treatment based on your account selection and the general VAT rules.

---
**1. Hard Rules (Strict Keyword Matching)**
${serializedHardRules}
---
**2. Soft Rules (Conceptual Matching)**
${serializedSoftRules}
---
**3. Chart of Accounts (Use if no rule matches)**
${serializedChartOfAccounts}
---
**4. South African VAT Rules (Apply after selecting an account)**
**Output Tax (VAT on Income)**
- **standard_rated_sales**: Sales of goods/services (15% VAT). Most income falls here.
- **zero_rated_sales**: Exports, certain basic foodstuffs.
- **exempt_sales**: Interest, dividends, residential rent, certain financial services.

**Input Tax (VAT on Expenses)**
- **standard_rated_purchases**: Most operational expenses (stationery, advertising, professional fees, repairs, etc.). Bank merchant fees. Software and computer expenses.
- **capital_goods_purchases**: On fixed assets like machinery, computers, furniture.
- **zero_rated_purchases**: e.g., Diesel.
- **exempt_purchases**: Insurance premiums, interest paid.
- **no_vat**: Not subject to VAT (e.g., salaries, SARS payments, bank account fees, fines, donations, entertainment).

**Key Expense Categories & VAT Treatment**
- **VAT Claimable (standard_rated_purchases)**: Stationery, office supplies, telephone, internet, advertising, consulting, legal fees, repairs & maintenance (excluding passenger cars). Bank merchant fees. Software like 'Diamatrix'.
- **NO VAT (no_vat or exempt_purchases)**: Salaries, wages, PAYE/UIF/SDL, interest paid, insurance premiums, bank account fees (not merchant fees), fines, donations, entertainment expenses.
- **Passenger Vehicles**: Input VAT is NOT claimable. Use 'no_vat'.
---

**Your Task:**
1.  **Allocate Account**: Following the prioritization order, choose the single most appropriate account number.
2.  **Determine VAT Type**: Based on the allocated account and the VAT rules, select the correct 'vatType'.
3.  **Provide Reasoning**: Give a very brief justification for your choices.
  `,
});

const allocateTransactionFlow = ai.defineFlow(
  {
    name: 'allocateTransactionFlow',
    inputSchema: AllocateTransactionInputSchema,
    outputSchema: AllocateTransactionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
