
'use server';
/**
 * @fileOverview An AI agent for suggesting income transaction allocations to customer accounts.
 * 
 * - suggestIncomeAllocation - A function that suggests a customer account for an income transaction.
 * - SuggestIncomeAllocationInput - The input type for the suggestIncomeAllocation function.
 * - SuggestIncomeAllocationOutput - The return type for the suggestIncomeAllocation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const SuggestIncomeAllocationInputSchema = z.object({
  description: z.string().describe('The bank transaction description (e.g., "Payment from John Doe INV9001").'),
  customers: z.string().describe('A JSON string of customers with their names, IDs, and invoice numbers. e.g., `[{"id":"cust_123","name":"John Doe","invoiceNumbers":["INV9001", "INV9002"]}]`'),
});
export type SuggestIncomeAllocationInput = z.infer<typeof SuggestIncomeAllocationInputSchema>;

const SuggestIncomeAllocationOutputSchema = z.object({
  customerId: z.string().optional().describe("The ID of the suggested customer from the provided list. This must exactly match an ID from the list."),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the allocation. A higher score means more confidence. Base confidence on how clearly the description matches a customer name or invoice number.'),
});
export type SuggestIncomeAllocationOutput = z.infer<typeof SuggestIncomeAllocationOutputSchema>;

export async function suggestIncomeAllocation(
  input: SuggestIncomeAllocationInput
): Promise<SuggestIncomeAllocationOutput> {
  return suggestIncomeAllocationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestIncomeAllocationPrompt',
  input: { schema: SuggestIncomeAllocationInputSchema },
  output: { schema: SuggestIncomeAllocationOutputSchema },
  prompt: `You are an expert accountant. Your task is to analyze a bank transaction description and identify which customer made the payment.

Analyze the transaction description and choose the most appropriate customer from the provided list. You should look for either the customer's name or a specific invoice number in the transaction description.

**Transaction Description**: {{{description}}}

**List of Customers and their Invoices**:
\`\`\`json
{{{customers}}}
\`\`\`

Based on the description, provide the customer ID. Your confidence score should reflect how specific the description is. 
- If you find an exact invoice number or a full name match, confidence should be high (90-100).
- If you find a partial name match, confidence should be medium (60-80).
- If the description is too generic (e.g., "INTERNET TRANSFER") or doesn't match anyone, confidence should be very low (0-20), and you should not return a customerId.
  `,
});

const suggestIncomeAllocationFlow = ai.defineFlow(
  {
    name: 'suggestIncomeAllocationFlow',
    inputSchema: SuggestIncomeAllocationInputSchema,
    outputSchema: SuggestIncomeAllocationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
