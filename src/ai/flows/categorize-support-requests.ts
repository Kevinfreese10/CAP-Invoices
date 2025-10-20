
'use server';

/**
 * @fileOverview An AI agent for categorizing support requests.
 * 
 * - categorizeSupportRequest - A function that categorizes support requests.
 * - CategorizeSupportRequestInput - The input type for the categorizeSupportRequest function.
 * - CategorizeSupportRequestOutput - The return type for the categorizeSupportRequest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeSupportRequestInputSchema = z.object({
  request: z.string().describe('The subject and body of the support request from the user.'),
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
  prompt: `You are a support agent tasked with triaging incoming support requests for an accounting firm.

  Based on the user's request, determine the category, priority, and an appropriate SLA.

  Categories:
  - Account issues: Password resets, login problems, profile updates.
  - Tax preparation: Questions about ITR12, VAT201, Provisional Tax, SARS deadlines.
  - Service inquiry: Questions about specific services offered, pricing, or turnaround times.
  - Document upload: Issues or notifications related to document submissions.
  - Spam/Promo: Newsletters, marketing emails, or irrelevant content.
  - Other: Any other type of support request.

  Priorities:
  - High: Urgent issues needing immediate attention. Keywords: "urgent", "final demand", "deadline", "legal notice", "summons".
  - Medium: Important but not critical issues.
  - Low: Non-urgent issues or general inquiries. Newsletters and spam are always "Low".

  SLA (Service Level Agreement):
  - High Priority: 24 hours
  - Medium Priority: 48 hours
  - Low Priority: 72 hours

  User request: {{{request}}}
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

    