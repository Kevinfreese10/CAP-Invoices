
'use server';
/**
 * @fileOverview An AI agent for suggesting transaction allocations.
 * 
 * - suggestTransactionAllocation - A function that suggests a GL account and VAT type for a transaction.
 * - SuggestTransactionAllocationInput - The input type for the suggestTransactionAllocation function.
 * - SuggestTransactionAllocationOutput - The return type for the suggestTransactionAllocation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { allVatTypes } from '@/lib/vat-types';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestTransactionAllocationInputSchema = z.object({
  description: z.string().describe('The bank transaction description (e.g., "PICK N PAY RETAILERS").'),
  chartOfAccounts: z.string().describe('A JSON string of the chart of accounts, with "id", "accountNumber", and "description" fields.'),
});
export type SuggestTransactionAllocationInput = z.infer<typeof SuggestTransactionAllocationInputSchema>;

const SuggestTransactionAllocationOutputSchema = z.object({
  accountId: z.string().describe("The ID of the suggested account from the chart of accounts (e.g., '3800/000'). This must exactly match an ID from the provided chart of accounts."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]).describe("The suggested VAT type for this transaction."),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the allocation. A higher score means more confidence. Base confidence on how clear the description is (e.g., "PICK N PAY" is high, "DEBIT ORDER" is low).'),
});
export type SuggestTransactionAllocationOutput = z.infer<typeof SuggestTransactionAllocationOutputSchema>;

export async function suggestTransactionAllocation(
  input: SuggestTransactionAllocationInput
): Promise<SuggestTransactionAllocationOutput> {
  return suggestTransactionAllocationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTransactionAllocationPrompt',
  input: { schema: SuggestTransactionAllocationInputSchema },
  output: { schema: SuggestTransactionAllocationOutputSchema },
  prompt: `You are an expert South African accountant. Your task is to suggest the correct general ledger account and VAT type for a bank transaction based on its description.

Analyze the transaction description and choose the most appropriate account from the provided chart of accounts. Also, determine the correct VAT treatment.

**Transaction Description**: {{{description}}}

**Chart of Accounts**:
\`\`\`json
{{{chartOfAccounts}}}
\`\`\`

Based on the description, provide the account ID and VAT type. Your confidence should reflect how specific the description is. For example, a transaction for "PICK N PAY" is clearly for 'General Expenses', so confidence should be high (e.g., 95). A generic "DEBIT ORDER" is ambiguous, so confidence should be very low (e.g., 10).
  `,
});

const suggestTransactionAllocationFlow = ai.defineFlow(
  {
    name: 'suggestTransactionAllocationFlow',
    inputSchema: SuggestTransactionAllocationInputSchema,
    outputSchema: SuggestTransactionAllocationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-pro' });
    return output!;
  }
);
