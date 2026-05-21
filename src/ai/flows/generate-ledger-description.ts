'use server';
/**
 * @fileOverview An AI agent for generating professional ledger descriptions for production expenses.
 * 
 * - generateLedgerDescription - A function that creates a formatted ledger description.
 * - GenerateLedgerDescriptionInput - The input type for the generateLedgerDescription function.
 * - GenerateLedgerDescriptionOutput - The return type for the generateLedgerDescription function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateLedgerDescriptionInputSchema = z.object({
  lineDescription: z.string().describe('The original line item description from the invoice.'),
  commissionNumber: z.string().optional().describe('The project commission number (e.g., 6893).'),
  storyName: z.string().optional().describe('The name of the story or segment (e.g., Last Right).'),
  accountDescription: z.string().optional().describe('The description of the GL account the expense is allocated to.'),
  examples: z.array(z.string()).optional().describe('A list of existing ledger descriptions to use for style guidance.'),
});
export type GenerateLedgerDescriptionInput = z.infer<typeof GenerateLedgerDescriptionInputSchema>;

const GenerateLedgerDescriptionOutputSchema = z.object({
  ledgerDescription: z.string().describe('The final, formatted ledger description.'),
});
export type GenerateLedgerDescriptionOutput = z.infer<typeof GenerateLedgerDescriptionOutputSchema>;

export async function generateLedgerDescription(
  input: GenerateLedgerDescriptionInput
): Promise<GenerateLedgerDescriptionOutput> {
  return generateLedgerDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLedgerDescriptionPrompt',
  input: { schema: GenerateLedgerDescriptionInputSchema },
  output: { schema: GenerateLedgerDescriptionOutputSchema },
  prompt: `You are an expert production accountant for a media firm. Your task is to generate a professional, standardized ledger description for an invoice line item.

**STRICT FORMATTING RULES:**
1. Every description MUST start with the prefix "IS{{#if commissionNumber}}{{commissionNumber}}{{else}}????{{/if}} - {{#if storyName}}{{storyName}}{{else}}No Story{{/if}}".
2. After the prefix, add a hyphen and then a concise, highly detailed summary of the actual expense details extracted from the original description.
3. Include specific names (if mentioned), dates (if mentioned), quantities, or locations.
4. Use the provided "Style Examples" for tone and technical level guidance.

**STYLE EXAMPLES FOR GUIDANCE:**
{{#each examples}}
- {{{this}}}
{{/each}}

**CURRENT TRANSACTION DATA:**
- Original Description: "{{{lineDescription}}}"
- Allocated GL Account: "{{{accountDescription}}}"
- Commission #: {{#if commissionNumber}}{{commissionNumber}}{{else}}N/A{{/if}}
- Story Name: {{#if storyName}}{{storyName}}{{else}}N/A{{/if}}

Generate the final ledger description now:`,
});

const generateLedgerDescriptionFlow = ai.defineFlow(
  {
    name: 'generateLedgerDescriptionFlow',
    inputSchema: GenerateLedgerDescriptionInputSchema,
    outputSchema: GenerateLedgerDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
