
'use server';
/**
 * @fileOverview An AI agent for extracting the date range from bank statements.
 *
 * - extractStatementPeriod - A function that takes a bank statement and returns its start and end date.
 * - ExtractStatementPeriodInput - The input type for the extractStatementPeriod function.
 * - ExtractStatementPeriodOutput - The return type for the extractStatementPeriod function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractStatementPeriodInputSchema = z.object({
  statementPdf: z.string().describe(
    "A document of a bank statement (image or PDF), as a data URI."
  ),
});
export type ExtractStatementPeriodInput = z.infer<typeof ExtractStatementPeriodInputSchema>;

const ExtractStatementPeriodOutputSchema = z.object({
  startDate: z.string().describe("The start date of the statement period in 'YYYY-MM-DD' format."),
  endDate: z.string().describe("The end date of the statement period in 'YYYY-MM-DD' format."),
});
export type ExtractStatementPeriodOutput = z.infer<typeof ExtractStatementPeriodOutputSchema>;

export async function extractStatementPeriod(
  input: ExtractStatementPeriodInput
): Promise<ExtractStatementPeriodOutput> {
  return extractStatementPeriodFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStatementPeriodPrompt',
  input: { schema: ExtractStatementPeriodInputSchema },
  output: { schema: ExtractStatementPeriodOutputSchema },
  prompt: `You are an OCR agent. Your only task is to find the start date and end date of the provided bank statement document.
  
  The start date is usually the first transaction date.
  The end date is usually the last transaction date.
  
  Format the dates as YYYY-MM-DD.

  Analyze the following document:
  {{media url=statementPdf}}
  `,
});

const extractStatementPeriodFlow = ai.defineFlow(
  {
    name: 'extractStatementPeriodFlow',
    inputSchema: ExtractStatementPeriodInputSchema,
    outputSchema: ExtractStatementPeriodOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
