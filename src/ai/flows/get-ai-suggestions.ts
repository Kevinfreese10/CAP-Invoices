'use server';
/**
 * @fileOverview An AI flow for getting allocation suggestions for a batch of transactions.
 * 
 * - getAISuggestions - A function that returns AI-powered suggestions.
 * - GetAISuggestionsInput - The input type for the function.
 * - GetAISuggestionsOutput - The output type for the function (an array of suggestions).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { allocateTransaction } from './allocate-transaction';
import { VatType } from '@/lib/types';

const ImportedTransactionSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    bankAccountId: z.string(),
});

const GetAISuggestionsInputSchema = z.object({
  transactions: z.array(ImportedTransactionSchema).describe("An array of unallocated transactions to process."),
});
export type GetAISuggestionsInput = z.infer<typeof GetAISuggestionsInputSchema>;

const vatTypes: z.ZodType<VatType> = z.enum([
    'standard_rated_sales', 'zero_rated_sales', 'exempt_sales',
    'standard_rated_purchases', 'capital_goods_purchases', 'zero_rated_purchases', 'exempt_purchases', 'no_vat'
]);

// Redefine the schema here to avoid exporting it from a 'use server' file.
const SuggestionSchema = z.object({
    transactionId: z.string(),
    accountNumber: z.string().describe("The suggested account number from the Chart of Accounts."),
    reasoning: z.string().describe("A brief explanation for the suggested allocation."),
    vatType: vatTypes.describe("The suggested VAT type based on the transaction and account. Default to 'no_vat' if unsure or not applicable."),
});

const GetAISuggestionsOutputSchema = z.array(SuggestionSchema);
export type GetAISuggestionsOutput = z.infer<typeof GetAISuggestionsOutputSchema>;


export async function getAISuggestions(
  input: GetAISuggestionsInput
): Promise<GetAISuggestionsOutput> {
  return getAISuggestionsFlow(input);
}

const getAISuggestionsFlow = ai.defineFlow(
  {
    name: 'getAISuggestionsFlow',
    inputSchema: GetAISuggestionsInputSchema,
    outputSchema: GetAISuggestionsOutputSchema,
  },
  async (input) => {
    
    const suggestionPromises = input.transactions.map(async (tx) => {
        try {
            const result = await allocateTransaction({ description: tx.description });
            return {
                transactionId: tx.id,
                ...result,
            };
        } catch (error) {
            console.error(`AI suggestion failed for transaction ${tx.id}:`, error);
            return null; // Return null for failed suggestions
        }
    });

    const results = await Promise.all(suggestionPromises);
    return results.filter(Boolean) as GetAISuggestionsOutput;
  }
);
