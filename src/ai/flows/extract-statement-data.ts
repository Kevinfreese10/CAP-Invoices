
'use server';
/**
 * @fileOverview An AI agent for extracting transaction data from bank statements.
 *
 * - extractStatementData - A function that takes a bank statement and returns structured transaction data.
 * - ExtractStatementDataInput - The input type for the extractStatementData function.
 * - ExtractStatementDataOutput - The return type for the extractStatementData function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const ExtractStatementDataInputSchema = z.object({
  statementPdf: z.string().describe(
    "A PDF document of a bank statement, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
});
export type ExtractStatementDataInput = z.infer<typeof ExtractStatementDataInputSchema>;

const TransactionLineSchema = z.object({
    date: z.string().describe("The transaction date in 'YYYY-MM-DD' format."),
    description: z.string().describe("The full transaction description."),
    amount: z.number().describe("The transaction amount. Use negative numbers for debits/payments and positive numbers for credits/receipts."),
});

const ExtractStatementDataOutputSchema = z.object({
  transactions: z.array(TransactionLineSchema).describe("An array of all transactions from the statement."),
});
export type ExtractStatementDataOutput = z.infer<typeof ExtractStatementDataOutputSchema>;

export async function extractStatementData(
  input: ExtractStatementDataInput
): Promise<ExtractStatementDataOutput> {
  return extractStatementDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStatementDataPrompt',
  input: { schema: ExtractStatementDataInputSchema },
  output: { schema: ExtractStatementDataOutputSchema },
  prompt: `You are an expert OCR and data extraction agent specializing in South African bank statements.

Your task is to analyze the provided bank statement PDF and extract the following information for every single transaction:
1.  **Date**: The date the transaction occurred, formatted as YYYY-MM-DD.
2.  **Description**: The full, untruncated description of the transaction as it appears on the statement.
3.  **Amount**: The transaction amount. It is CRITICAL to use negative numbers for any debits, payments, or withdrawals, and positive numbers for any credits, deposits, or receipts.

Analyze the following bank statement:
{{media url=statementPdf}}
  `,
});

const extractStatementDataFlow = ai.defineFlow(
  {
    name: 'extractStatementDataFlow',
    inputSchema: ExtractStatementDataInputSchema,
    outputSchema: ExtractStatementDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-pro' });
    return output!;
  }
);
