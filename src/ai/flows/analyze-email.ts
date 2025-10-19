
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
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

const db = getFirestore(firebaseApp);

const AnalyzeEmailInputSchema = z.object({
    subject: z.string().describe("The subject line of the email."),
    body: z.string().describe("The plain text or HTML body of the email."),
    attachments: z.array(z.object({
      dataUri: z.string().describe("The attachment content as a data URI."),
      mimeType: z.string().describe("The MIME type of the attachment, e.g., 'application/pdf' or 'image/jpeg'."),
    })).optional().describe("An array of attachments, each as a data URI."),
  });

const EmailAnalysisOutputSchema = z.object({
    summary: z.string().describe("A concise, one-paragraph summary of the entire email content, including key points from attachments."),
    category: z.enum(['Client Inquiry', 'SARS Document', 'Invoice Submission', 'Payment Notification', 'Legal/Compliance', 'Internal Communication', 'Spam/Marketing', 'Other']).describe("The best-fitting category for the email."),
    priority: z.enum(['High', 'Medium', 'Low']).describe("The urgency of the email. Use 'High' for keywords like 'Final Demand', 'Urgent', or legal threats."),
    sla: z.enum(['4-hour', '24-hour', '72-hour', 'None']).describe("The suggested Service Level Agreement for a response based on urgency and content."),
    senderName: z.string().optional().describe("The name of the client or sender, if identifiable."),
    detectedAttachments: z.array(z.string()).optional().describe("A list of detected important documents from the attachments (e.g., 'ID Document', 'CIPC Document', 'Bank Statement', 'SARS Tax Pin')."),
    nextStep: z.string().describe("The immediate next action to be taken, e.g., 'Forward to tax department' or 'Draft response requesting missing documents'."),
    draftReply: z.object({
        subject: z.string().optional().describe("A suggested subject line for the reply. Should start with 'Re: ' followed by the original subject."),
        body: z.string().optional().describe("A drafted email response. Use a friendly yet professional tone. Address the sender by name. **MUST** be well-structured with proper paragraphs separated by double line breaks ('\\n\\n') for readability. If you use information about a service, provide the price and turnaround time."),
    }).optional().describe("A drafted response to the email if a reply is appropriate. If no reply is needed, this can be omitted."),
    suggestedTask: z.object({
        title: z.string().optional().describe("A concise title for a task that should be created from this email (e.g., 'File VAT201 for ABC Corp')."),
        description: z.string().optional().describe("A brief description of the task, including any relevant details from the email."),
    }).optional().describe("A suggested task to be created in a project management tool if the email requires action. If no task is needed, this can be omitted."),
  });


export async function analyzeEmail(input: AnalyzeEmailInput): Promise<EmailAnalysisOutput> {

  // Fetch live data from Firestore to provide context to the AI
  const servicesSnapshot = await getDocs(query(collection(db, 'services'), orderBy('title')));
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

  const blogPostsSnapshot = await getDocs(query(collection(db, 'blogPosts'), orderBy('date', 'desc')));
  const blogPosts = blogPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));

  // Serialize the website content to pass to the prompt
  const websiteContent = `
    SERVICES:
    ${services.map(s => `Title: ${s.title}, URL: /services/${s.id}, Description: ${s.longDescription}, Price: ZAR ${s.price}, Turnaround Time: ${s.turnaroundTime}, Prerequisites: ${s.clientRequirements.join(', ')}`).join('\n\n')}

    BLOG POSTS:
    ${blogPosts.map(p => `Title: ${p.title}, Excerpt: ${p.excerpt}`).join('\n\n')}
  `;


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
        prompt: `You are an expert inbox management AI for an accounting firm. Analyze the following email, including its subject, body, and any attachments, to perform triage and recommend actions.

You have access to the company's service and blog post information which you should use to answer any questions and draft replies.

CONTEXT:
---
${websiteContent}
---

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
8.  **Draft Reply**: If a reply is appropriate, draft a concise, professional, and friendly response. Address the sender by name. If the request is for documents, list them clearly. If it's about a service, include its price and turnaround time from the CONTEXT. **CRITICAL: The email body must be perfectly formatted with proper paragraphs. Use double line breaks ('\\n\\n') between paragraphs for readability.**
9.  **Suggested Task**: If the email implies a clear action is needed (e.g., "Please file my VAT return"), suggest a task with a clear title and a brief description. Otherwise, omit this field.
`,
      });

      const { output } = await prompt(input);
      return output!;
    }
  );

  return analyzeEmailFlow(input);
}

export type AnalyzeEmailInput = z.infer<typeof AnalyzeEmailInputSchema>;
export type EmailAnalysisOutput = z.infer<typeof EmailAnalysisOutputSchema>;

    