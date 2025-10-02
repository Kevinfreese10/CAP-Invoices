
'use server';
/**
 * @fileOverview An AI agent for extracting data from invoices.
 *
 * - extractInvoiceData - A function that takes an invoice document and returns structured data.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceImage: z.string().describe(
    "A document of an invoice (image or PDF), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const LineItemSchema = z.object({
    description: z.string().describe("The full description of the line item."),
    exclusiveAmount: z.number().describe("The price of the item excluding VAT."),
    vatAmount: z.number().describe("The VAT amount for the line item."),
});

const ExtractInvoiceDataOutputSchema = z.object({
  supplier: z.string().describe('The name of the supplier or vendor from the invoice.'),
  date: z.string().describe("The invoice date in 'DD/MM/YYYY' format."),
  lineItems: z.array(LineItemSchema).describe("An array of all line items from the invoice."),
  invoiceTotal: z.number().describe("The final, total amount of the invoice including all taxes."),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: { schema: ExtractInvoiceDataInputSchema },
  output: { schema: ExtractInvoiceDataOutputSchema },
  prompt: `You are an expert OCR and data extraction agent specializing in South African supplier invoices.

Your task is to analyze the provided invoice document and extract the following information with perfect accuracy:
1.  **Supplier Name**: The name of the company that issued the invoice.
2.  **Invoice Date**: The date the invoice was issued, formatted as DD/MM/YYYY.
3.  **Line Items**: For each distinct item or service on the invoice, extract:
    *   The full line item description.
    *   The amount excluding VAT (exclusiveAmount).
    *   The VAT amount for that specific line item.
4.  **Invoice Total**: The final, grand total amount due on the invoice.

If the invoice does not explicitly separate exclusive and VAT amounts per line, calculate them assuming a standard South African VAT rate of 15% on the items that include VAT.

Analyze the following invoice:
{{media url=invoiceImage}}
  `,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
