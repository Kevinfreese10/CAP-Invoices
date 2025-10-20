
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

const CategorizeSupportRequestInputSchema = z.object({
  request: z.string().describe('The subject and body of the support request from the user.'),
  clientName: z.string().describe('The name of the client making the request.'),
});
export type CategorizeSupportRequestInput = z.infer<typeof CategorizeSupportRequestInputSchema>;

const CategorizeSupportRequestOutputSchema = z.object({
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

  Based on the user's request, you must perform two actions:
  1. Triage the email by determining the category, priority, and an appropriate SLA.
  2. Determine if an actionable task can be created from the email. If so, provide a clear task title and description.

  **Triage Guidelines:**
  - Categories: 'Account issues', 'Tax preparation', 'Service inquiry', 'Document upload', 'Spam/Promo', 'Other'.
  - Priorities: Use 'High' for "urgent", "final demand", "deadline", "legal notice". Use 'Low' for newsletters or spam.
  - SLA: High priority = 24 hours, Medium = 48 hours, Low = 72 hours.

  **Task Creation Guidelines:**
  - Set 'shouldCreate' to true ONLY if the email contains a clear instruction or request for work (e.g., "Please file my VAT", "Can you register my company?", "Help me with my tax return").
  - If 'shouldCreate' is true, the task title must be specific and include the client's name. Examples: "File VAT201 for {{{clientName}}}", "Assist {{{clientName}}} with ITR12 submission".
  - The task description should be a summary of the client's request.
  - Do NOT create tasks for general inquiries, questions, or follow-ups.
  
  **Client Name**: {{{clientName}}}
  **User request**: {{{request}}}
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
    return output!;
  }
);
    
