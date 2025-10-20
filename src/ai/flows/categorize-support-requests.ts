
'use server';

/**
 * @fileOverview An AI agent for categorizing support requests and creating tasks.
 * 
 * - categorizeSupportRequest - A function that categorizes support requests.
 * - CategorizeSupportRequestInput - The input type for the categorizeSupportRequest function.
 * - CategorizeSupportRequestOutput - The return type for the categorizeSupportRequest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { generateEmailReply } from './generate-email-reply';

const AttachmentSchema = z.object({
  filename: z.string().nullable(),
  contentType: z.string().nullable(),
  dataUrl: z.string().nullable(),
  size: z.number().nullable(),
});

const CategorizeSupportRequestInputSchema = z.object({
  request: z.string().describe('The subject and body of the support request from the user.'),
  clientName: z.string().describe('The name of the client making the request.'),
  attachments: z.array(AttachmentSchema).optional().describe('An array of attachments included in the email.'),
});
export type CategorizeSupportRequestInput = z.infer<typeof CategorizeSupportRequestInputSchema>;

const CategorizeSupportRequestOutputSchema = z.object({
  summary: z.string().describe("A concise, one-sentence summary of the user's request based on the email content and any attachments."),
  category: z
    .enum(['Account issues', 'Tax preparation', 'Service inquiry', 'Document upload', 'Spam/Promo', 'Other'])
    .describe(
      'The category of the support request.'
    ),
  priority: z
    .enum(['High', 'Medium', 'Low'])
    .describe(
      'The priority of the support request. Use "High" for keywords like "urgent," "final demand," "deadline," or legal notices. Use "Low" for newsletters or promotional content.'
    ),
    sla: z.number().describe("The suggested SLA in hours (24, 48, or 72) based on the priority and keywords. High priority should be 24, Medium 48, Low 72.").optional(),
    task: z.object({
      shouldCreate: z.boolean().describe("Determine if a task should be created based on the email content. Set to true if the email contains a clear, actionable request from the client."),
      title: z.string().optional().describe("If a task should be created, provide a concise and clear title for the task. E.g., 'File VAT201 for ABC (Pty) Ltd' or 'Prepare ITR12 for John Doe'."),
      description: z.string().optional().describe("A brief description of the task based on the email content."),
    }).optional().describe("Task creation details. Only populate if the email contains a clear, actionable request."),
    suggestedAction: z
    .enum(['create_task', 'draft_reply', 'archive', 'none'])
    .describe("Based on the content, suggest the most logical next action. 'create_task' for actionable requests, 'draft_reply' for queries, and 'archive' for spam/promo."),
    draftReply: z.string().optional().describe("If the suggested action is 'draft_reply', provide a professionally written draft reply. It should be helpful, concise, and maintain a friendly but professional tone, addressing the sender's query directly."),
});
export type CategorizeSupportRequestOutput = z.infer<typeof CategorizeSupportRequestOutputSchema>;

export async function categorizeSupportRequest(
  input: CategorizeSupportRequestInput
): Promise<CategorizeSupportRequestOutput> {
  return categorizeSupportRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeSupportRequestPrompt',
  input: {schema: CategorizeSupportRequestInputSchema},
  output: {schema: CategorizeSupportRequestOutputSchema},
  prompt: `You are an expert support agent and task manager for an accounting firm.

  Your task is to analyze the user's request, which includes an email body and potentially one or more file attachments, and then perform several actions:
  1. Create a one-sentence summary of the email's content, including a brief mention of any relevant information found in the attachments.
  2. Triage the email by determining the category, priority, and an appropriate SLA.
  3. Determine if an actionable task can be created from the email and suggest the best next action.
  4. If the best action is to 'draft_reply', you MUST generate a professional, helpful, and concise email draft.

  **Triage Guidelines:**
  - Categories: 'Account issues', 'Tax preparation', 'Service inquiry', 'Document upload', 'Spam/Promo', 'Other'.
  - Priorities: Use 'High' for "urgent", "final demand", "deadline", "legal notice". Use 'Low' for newsletters or spam.
  - SLA: High priority = 24 hours, Medium = 48 hours, Low = 72 hours.

  **Task, Action, & Reply Guidelines:**
  - If the email contains a clear instruction for work (e.g., "Please file my VAT"), set 'suggestedAction' to 'create_task' and 'task.shouldCreate' to true. The task title must be specific and include the client's name. Do NOT generate a draft reply.
  - If the email is a general inquiry or question, set 'suggestedAction' to 'draft_reply'. Do NOT create a task. You MUST generate a draft reply. Address the client by name, be helpful and professional, and sign off as 'Khai, My Accountant'.
  - If the email is marketing, a newsletter, or spam, categorize it as 'Spam/Promo', set priority to 'Low', and set 'suggestedAction' to 'archive'.
  - If no clear action is needed, set 'suggestedAction' to 'none'.
  
  **Client Name**: {{{clientName}}}
  **User request**: {{{request}}}

  {{#if attachments}}
  **Attachments:**
  {{#each attachments}}
  ---
  File: {{this.filename}}
  Content: {{media url=this.dataUrl}}
  ---
  {{/each}}
  {{/if}}
  `,
});

const categorizeSupportRequestFlow = ai.defineFlow(
  {
    name: 'categorizeSupportRequestFlow',
    inputSchema: CategorizeSupportRequestInputSchema,
    outputSchema: CategorizeSupportRequestOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if(output && output.suggestedAction === 'draft_reply' && !output.draftReply) {
        const draftResult = await generateEmailReply({
            subject: 'Re: Support Request',
            body: input.request,
            sender: input.clientName,
        });
        output.draftReply = draftResult.draft;
    }
    return output!;
  }
);
    
