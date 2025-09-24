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

const AllocateTransactionInputSchema = z.object({
  description: z.string().describe('The transaction description from the bank statement.'),
});
export type AllocateTransactionInput = z.infer<typeof AllocateTransactionInputSchema>;

const AllocateTransactionOutputSchema = z.object({
  accountNumber: z.string().describe("The suggested account number from the Chart of Accounts."),
  reasoning: z.string().describe("A brief explanation for the suggested allocation."),
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

const prompt = ai.definePrompt({
  name: 'allocateTransactionPrompt',
  input: {schema: AllocateTransactionInputSchema},
  output: {schema: AllocateTransactionOutputSchema},
  prompt: `You are an expert chartered accountant with over 50 years of experience in South African finance. Your task is to analyze a bank transaction description and allocate it to the most appropriate account from the provided Chart of Accounts.

You should use your vast knowledge to understand the nature of the transaction based on common South African merchant names, service providers, and transaction types. If the description is ambiguous, make the most logical inference.

Transaction Description:
"{{{description}}}"

Here is the Chart of Accounts you must choose from:
---
${serializedChartOfAccounts}
---

Based on the description, provide the single most appropriate account number and a brief justification for your choice.
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
