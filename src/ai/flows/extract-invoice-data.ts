
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
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

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
  supplierVatNumber: z.string().optional().describe("The 10-digit VAT registration number of the supplier, if present."),
  documentType: z.enum(["Tax Invoice", "Proforma Invoice", "Quote", "Credit Note", "Statement", "Receipt", "Other"]).optional().describe("The type of document identified."),
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
7.  **Supplier VAT Number**: The supplier's 10-digit VAT registration number, if present.
8.  **Document Type**: The type of document identified (e.g. Tax Invoice, Proforma Invoice, Quote, Credit Note, Statement, Receipt, Other).

### Critical Extraction Instructions:
- **Multi-Page Invoices**: If the invoice spans multiple pages, you MUST analyze all pages and extract all line items across the entire document without omission.
- **Ambiguous Dates**: Normalize the date format strictly to 'DD/MM/YYYY'. If a date like '02/03/2026' is ambiguous, look at the rest of the invoice or nearby dates to determine whether it means 2 March 2026 or 3 February 2026.
- **Illegible Text**: If a description, number, or word is blurry or illegible, do not guess or hallucinate. Keep the fields clean and omit or label them 'ILLEGIBLE'.

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
    const { output } = await prompt(input, { config: { temperature: 0.0 } });
    return output!;
  }
);

export async function reanalyzeInvoice(invoiceId: string): Promise<ExtractInvoiceDataOutput> {
  const db = getFirestore(firebaseApp);
  const docRef = doc(db, 'extractedInvoices', invoiceId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Invoice not found');
  }
  
  const data = docSnap.data();
  const fileUrl = data.fileUrl;
  if (!fileUrl) {
    throw new Error('Invoice does not have a file URL');
  }
  
  // Download the file from fileUrl
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'application/pdf';
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:${contentType};base64,${base64Data}`;
  
  // Run extraction
  const result = await extractInvoiceData({ invoiceImage: dataUrl });
  
  // Update Firestore doc
  await updateDoc(docRef, {
    supplier: result.supplier,
    invoiceNumber: result.invoiceNumber,
    commissionNumber: data.commissionNumber || result.commissionNumber || null,
    date: result.date,
    lineItems: result.lineItems,
    invoiceTotal: result.invoiceTotal,
    reanalyzedAt: new Date().toISOString(),
  });
  
  return result;
}
