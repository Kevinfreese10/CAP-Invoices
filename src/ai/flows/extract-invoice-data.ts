
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
import { resolveGeminiKey, describeGeminiKeyProblem } from '@/ai/gemini-key';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceImage: z.string().describe(
    "A document of an invoice (image or PDF), provided as a data URI or HTTP/HTTPS URL."
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


const systemInstructionText = `You are an expert OCR and data extraction agent specializing in South African supplier invoices.

Your task is to analyze the provided invoice document and extract the following information with perfect accuracy:
1. Supplier Name: The name of the company that issued the invoice.
   * CRITICAL: The supplier is NEVER "Combined Artistic Productions (Pty) Ltd" or "CAP". That is the buyer/recipient. You must find the company that is billing Combined Artistic Productions.
2. Invoice Number: The unique invoice number, reference number, or document ID.
3. Commission Number: The commission number, if it is present on the invoice.
4. Invoice Date: The date the invoice was issued, formatted strictly as DD/MM/YYYY.
5. Line Items: For each distinct item or service on the invoice, extract:
   * description: The full line item description.
   * exclusiveAmount: The price of the item excluding VAT.
   * vatAmount: The VAT amount for that specific line item.
6. Invoice Total: The final, grand total amount due on the invoice.
7. Supplier VAT Number: The supplier's 10-digit VAT registration number, if present.
8. Document Type: The type of document identified (Tax Invoice, Proforma Invoice, Quote, Credit Note, Statement, Receipt, Other).

### Critical Extraction Instructions:
- Multi-Page Invoices: If the invoice spans multiple pages, you MUST analyze all pages and extract all line items across the entire document without omission.
- Ambiguous Dates: Normalize the date format strictly to 'DD/MM/YYYY'. If a date like '02/03/2026' is ambiguous, look at the rest of the invoice or nearby dates to determine whether it means 2 March 2026 or 3 February 2026.
- Illegible Text: If a description, number, or word is blurry or illegible, do not guess or hallucinate. Keep the fields clean and omit or label them 'ILLEGIBLE'.

### Critical VAT Extraction Rules:
- Do not invent VAT: If the invoice does not explicitly charge VAT, or if it explicitly states "No VAT" or "VAT Exempt", then the VAT amount is exactly 0 for all line items.
- A valid South African VAT invoice usually contains a 10-digit VAT registration number (starting with '4'). However, even if they have a VAT number, if the total VAT charged on the invoice is 0, DO NOT extract VAT on the line items.
- If the supplier is NOT a VAT vendor (no VAT registration number is listed, or no VAT is charged):
  * You MUST extract vatAmount as 0 for all line items.
  * Set exclusiveAmount to the full amount of the line item (so exclusiveAmount matches the total line item cost).
- Only if VAT is explicitly charged on the invoice:
  * Check if the line items are inclusive or exclusive of VAT.
  * If the invoice does not explicitly separate exclusive and VAT amounts per line, but a VAT total is shown at the bottom, calculate the VAT portion for each line item as Line Total * (15 / 115) and the exclusive portion as Line Total * (100 / 115) assuming a standard South African VAT rate of 15%.
  * If a specific line item is zero-rated or exempt from VAT, set its vatAmount to 0 and exclusiveAmount to the full line item cost.`;

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    supplier: { type: "STRING" },
    invoiceNumber: { type: "STRING" },
    commissionNumber: { type: "STRING" },
    date: { type: "STRING" },
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          exclusiveAmount: { type: "NUMBER" },
          vatAmount: { type: "NUMBER" }
        },
        required: ["description", "exclusiveAmount", "vatAmount"]
      }
    },
    invoiceTotal: { type: "NUMBER" },
    supplierVatNumber: { type: "STRING" },
    documentType: {
      type: "STRING",
      enum: ["Tax Invoice", "Proforma Invoice", "Quote", "Credit Note", "Statement", "Receipt", "Other"]
    }
  },
  required: ["supplier", "invoiceNumber", "date", "lineItems", "invoiceTotal"]
};

export async function extractInvoiceData(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataOutput> {
  // Fail fast with an actionable message rather than letting the API reject us later.
  const { key: GEMINI_API_KEY, status: keyStatus } = resolveGeminiKey();
  const keyProblem = describeGeminiKeyProblem(keyStatus);
  if (keyProblem) {
    console.error('[extractInvoiceData] Gemini key problem:', keyProblem);
    throw new Error(keyProblem);
  }

  let base64Data = '';
  let mimeType = 'application/pdf';

  if (input.invoiceImage.startsWith('http://') || input.invoiceImage.startsWith('https://')) {
    const res = await fetch(input.invoiceImage);
    if (!res.ok) {
      throw new Error(`Failed to download invoice file from storage (HTTP ${res.status} ${res.statusText}). Check the Storage download URL and CORS/rules.`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    mimeType = res.headers.get('content-type') || 'application/pdf';
    base64Data = buffer.toString('base64');
  } else if (input.invoiceImage.startsWith('data:')) {
    const match = input.invoiceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    } else {
      base64Data = input.invoiceImage.split(',')[1] || input.invoiceImage;
    }
  } else {
    base64Data = input.invoiceImage;
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: "Extract all structured invoice fields from this document according to the output schema:" },
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    generationConfig: {
      temperature: 0.0,
      responseMimeType: "application/json",
      responseSchema: geminiResponseSchema
    }
  };

  // Send the key in the x-goog-api-key header, NOT as a ?key= query parameter.
  // AI Studio now issues "Authentication Keys" (AQ....) rather than legacy "AIza"
  // traffic keys, and the query-parameter form fails for them with API_KEY_INVALID /
  // ACCESS_TOKEN_TYPE_UNSUPPORTED. The header works for both key formats.
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini API error [${response.status}]:`, errText);
    let detail = errText.slice(0, 400);
    try {
      const parsed = JSON.parse(errText);
      detail = `${parsed?.error?.status || response.status}: ${parsed?.error?.message || detail}`;
    } catch {
      /* keep raw text */
    }
    throw new Error(
      `Gemini API rejected the request (HTTP ${response.status}). ${detail} ` +
      `[key source: ${keyStatus.source}, kind: ${keyStatus.kind}, auth: x-goog-api-key header]`
    );
  }

  const jsonResult = await response.json();
  const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error("Gemini returned empty content");
  }

  let parsed: ExtractInvoiceDataOutput;
  try {
    parsed = JSON.parse(textOutput) as ExtractInvoiceDataOutput;
  } catch (err: any) {
    console.error('[extractInvoiceData] Gemini returned non-JSON output:', textOutput?.slice(0, 500));
    throw new Error(`Gemini returned output that is not valid JSON: ${err?.message || 'parse error'}`);
  }
  return parsed;
}

export type ExtractInvoiceDataResult =
  | { ok: true; data: ExtractInvoiceDataOutput }
  | { ok: false; error: string };

/**
 * Server-action-safe wrapper.
 *
 * Next.js masks any error thrown inside a Server Action in a production build with
 * "An error occurred in the Server Components render...". That hides the real cause
 * from the browser. This variant returns the failure as data instead, so the caller
 * can throw it client-side and show the true reason in the toast.
 */
export async function extractInvoiceDataSafe(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataResult> {
  try {
    const data = await extractInvoiceData(input);
    return { ok: true, data };
  } catch (err: any) {
    const error = err?.message ? String(err.message) : 'Unknown extraction error';
    console.error('[extractInvoiceDataSafe] extraction failed:', error);
    return { ok: false, error };
  }
}

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
    supplierVatNumber: result.supplierVatNumber || null,
    documentType: result.documentType || null,
    reanalyzedAt: new Date().toISOString(),
  });
  
  return result;
}
