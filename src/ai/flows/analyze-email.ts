
'use server';
/**
 * @fileOverview An AI agent for analyzing and triaging emails.
 *
 * - analyzeEmail - A function that takes an email and returns a structured analysis.
 * - AnalyzeEmailInput - The input type for the analyzeEmail function.
 * - EmailAnalysisOutput - The return type for the analyzeEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define schema types for external use, but don't export the schema objects directly
const AnalyzeEmailInputSchema = z.object({
  subject: z.string().describe("The subject line of the email."),
  body: z.string().describe("The plain text or HTML body of the email."),
  attachments: z.array(z.object({
    dataUri: z.string().describe("The attachment content as a data URI."),
    mimeType: z.string().describe("The MIME type of the attachment, e.g., 'application/pdf' or 'image/jpeg'."),
  })).optional().describe("An array of attachments, each as a data URI."),
});
export type AnalyzeEmailInput = z.infer<typeof AnalyzeEmailInputSchema>;

const EmailAnalysisOutputSchema = z.object({
  summary: z.string().describe("A concise, one-paragraph summary of the entire email content, including key points from attachments."),
  category: z.enum(['Client Inquiry', 'SARS Document', 'Invoice Submission', 'Payment Notification', 'Legal/Compliance', 'Internal Communication', 'Spam/Marketing', 'Other']).describe("The best-fitting category for the email."),
  priority: z.enum(['High', 'Medium', 'Low']).describe("The urgency of the email. Use 'High' for keywords like 'Final Demand', 'Urgent', or legal threats."),
  sla: z.enum(['4-hour', '24-hour', '72-hour', 'None']).describe("The suggested Service Level Agreement for a response based on urgency and content."),
  senderName: z.string().optional().describe("The name of the client or sender, if identifiable."),
  detectedAttachments: z.array(z.string()).optional().describe("A list of detected important documents from the attachments (e.g., 'ID Document', 'CIPC Document', 'Bank Statement', 'SARS Tax Pin')."),
  nextStep: z.string().describe("The immediate next action to be taken, e.g., 'Forward to tax department' or 'Draft response requesting missing documents'."),
});
export type EmailAnalysisOutput = z.infer<typeof EmailAnalysisOutputSchema>;


export async function analyzeEmail(input: AnalyzeEmailInput): Promise<EmailAnalysisOutput> {
  const analyzeEmailFlow = ai.defineFlow(
    {
      name: 'analyzeEmailFlow',
      inputSchema: AnalyzeEmailInputSchema,
      outputSchema: EmailAnalysisOutputSchema,
    },
    async (input) => {
      const prompt = ai.definePrompt({
        name: 'analyzeEmailPrompt',
        input: { schema: AnalyzeEmailInputSchema },
        output: { schema: EmailAnalysisOutputSchema },
        prompt: `You are an expert inbox management AI for an accounting firm. Analyze the following email, including its subject, body, and any attachments, to perform triage and prioritization.

**Email Subject**: {{{subject}}}

**Email Body**:
{{{body}}}

**Attachments**:
{{#if attachments}}
  {{#each attachments}}
    - [Attachment with MIME type {{this.mimeType}}] {{media url=this.dataUri}}
  {{/each}}
{{else}}
  No attachments.
{{/if}}

**Your Task**:
Based on all the provided information, provide a structured analysis.

1.  **Summary**: Write a single, comprehensive paragraph that summarizes the email's purpose and key information. If there are attachments, incorporate their contents into the summary (e.g., "The email from John Doe includes a PDF bank statement for the month of June...").
2.  **Category**: Classify the email into one of the following categories: 'Client Inquiry', 'SARS Document', 'Invoice Submission', 'Payment Notification', 'Legal/Compliance', 'Internal Communication', 'Spam/Marketing', 'Other'.
3.  **Priority**: Assign a priority. Use 'High' for urgent matters like "Final Demand," legal notices, or clear client dissatisfaction. Use 'Medium' for standard client requests. Use 'Low' for newsletters or non-urgent updates.
4.  **SLA**: Suggest a response SLA: '4-hour' for High priority, '24-hour' for Medium, '72-hour' for Low, or 'None' for spam.
5.  **Sender Name**: Identify the name of the person or company sending the email.
6.  **Detected Attachments**: If attachments are present, identify the type of document (e.g., 'ID Document', 'CIPC Document', 'Bank Statement', 'SARS Tax Pin', 'Proof of Payment', 'Invoice').
7.  **Next Step**: Recommend the immediate next action. Be specific (e.g., "Draft a response to request the client's IRP5," or "Forward to the tax department for review.").
`,
      });

      const { output } = await prompt(input);
      return output!;
    }
  );

  return analyzeEmailFlow(input);
}
