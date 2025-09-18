// This file is machine-generated - edit at your own risk.

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
  request: z.string().describe('The support request from the user.'),
});
export type CategorizeSupportRequestInput = z.infer<typeof CategorizeSupportRequestInputSchema>;

const CategorizeSupportRequestOutputSchema = z.object({
  category: z
    .string()
    .describe(
      'The category of the support request. Possible values include: Account issues, Tax preparation, Service inquiry, Document upload, Other.'
    ),
  priority: z
    .string()
    .describe(
      'The priority of the support request. Possible values include: High, Medium, Low.'
    ),
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
  prompt: `You are a support agent tasked with categorizing incoming support requests.

  Based on the user's request, determine the category and priority of the request.

  Here are the possible categories:
  - Account issues: Issues related to user accounts, such as password resets, account creation, or account termination.
  - Tax preparation: Questions or issues related to tax preparation services.
  - Service inquiry: Inquiries about the services offered by the company.
  - Document upload: Issues related to uploading documents.
  - Other: Any other type of support request.

  Here are the possible priorities:
  - High: Urgent issues that need immediate attention, such as account lockouts or critical errors.
  - Medium: Important issues that need to be addressed in a timely manner.
  - Low: Non-urgent issues that can be addressed as time allows.

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
