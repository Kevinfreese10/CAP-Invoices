
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
  invoiceNumber: z.string().describe("The unique invoice number or identifier from the invoice."),
  commissionNumber: z.string().optional().describe("The commission number from the invoice, if present."),
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
2.  **Invoice Number**: The unique invoice number, reference number, or document ID.
3.  **Commission Number**: The commission number, if it is present on the invoice.
4.  **Invoice Date**: The date the invoice was issued, formatted as DD/MM/YYYY.
5.  **Line Items**: For each distinct item or service on the invoice, extract:
    *   The full line item description.
    *   The amount excluding VAT (exclusiveAmount).
    *   The VAT amount for that specific line item.
6.  **Invoice Total**: The final, grand total amount due on the invoice.

### Critical VAT Extraction Rules:
- First, check if the invoice is a valid VAT invoice. A South African VAT invoice must contain a 10-digit VAT registration number (usually starting with '4') and charge VAT.
- If the supplier is not a VAT vendor (e.g., no VAT registration number is listed, or the document is just a plain invoice/receipt without tax charges, or explicitly states VAT is 0%/exempt/no VAT), then NO VAT is being charged.
  * In this case, you MUST extract \`vatAmount\` as \`0\` for all line items, and set \`exclusiveAmount\` to the full amount of the line item (so exclusiveAmount matches the total line item cost).
- If the supplier IS a VAT vendor and VAT is charged on the invoice:
  * Check if the line items are inclusive or exclusive of VAT.
  * If the invoice does not explicitly separate exclusive and VAT amounts per line, but a VAT total is shown at the bottom, calculate the VAT portion for each line item as \`Line Total * (15 / 115)\` and the exclusive portion as \`Line Total * (100 / 115)\` assuming a standard South African VAT rate of 15%.
  * If a line item is zero-rated or exempt from VAT, set its \`vatAmount\` to \`0\` and \`exclusiveAmount\` to the full line item cost.

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
