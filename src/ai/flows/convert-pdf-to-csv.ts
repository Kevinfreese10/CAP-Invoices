
'use server';
/**
 * @fileOverview An AI agent for converting PDF documents to CSV format.
 *
 * - convertPdfToCsv - A function that takes a PDF document and returns CSV data.
 * - ConvertPdfToCsvInput - The input type for the convertPdfToCsv function.
 * - ConvertPdfToCsvOutput - The return type for the convertPdfToCsv function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const ConvertPdfToCsvInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
});
export type ConvertPdfToCsvInput = z.infer<typeof ConvertPdfToCsvInputSchema>;

const ConvertPdfToCsvOutputSchema = z.object({
  csv: z.string().describe('The extracted data in CSV format.'),
});
export type ConvertPdfToCsvOutput = z.infer<typeof ConvertPdfToCsvOutputSchema>;

export async function convertPdfToCsv(
  input: ConvertPdfToCsvInput
): Promise<ConvertPdfToCsvOutput> {
  return convertPdfToCsvFlow(input);
}

const prompt = ai.definePrompt({
  name: 'convertPdfToCsvPrompt',
  input: { schema: ConvertPdfToCsvInputSchema },
  output: { schema: ConvertPdfToCsvOutputSchema },
  prompt: `You are an expert data extraction agent. Your task is to analyze the provided PDF bank statement and convert its transaction table into a standard CSV format.

  The CSV should have the following columns: "Date", "Description", "Amount".

  **Crucially, all dates in the "Date" column MUST be in the DD/MM/YYYY format (e.g., 28/10/2025).**

  Analyze the following PDF document and extract the transaction data:
  {{media url=pdfDataUri}}
  `,
});

const convertPdfToCsvFlow = ai.defineFlow(
  {
    name: 'convertPdfToCsvFlow',
    inputSchema: ConvertPdfToCsvInputSchema,
    outputSchema: ConvertPdfToCsvOutputSchema,
    model: googleAI('gemini-1.5-flash-latest'),
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
