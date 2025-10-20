
'use server';
/**
 * @fileOverview An AI agent for drafting email replies.
 * 
 * - generateEmailReply - A function that drafts a reply to an email.
 * - GenerateEmailReplyInput - The input type for the generateEmailReply function.
 * - GenerateEmailReplyOutput - The return type for the generateEmailReply function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateEmailReplyInputSchema = z.object({
  subject: z.string().describe('The subject of the original email.'),
  body: z.string().describe('The body of the original email.'),
  sender: z.string().describe('The name and/or email of the original sender.'),
});
export type GenerateEmailReplyInput = z.infer<typeof GenerateEmailReplyInputSchema>;

const GenerateEmailReplyOutputSchema = z.object({
  draft: z.string().describe("A professionally written draft reply. It should be helpful, concise, and maintain a friendly but professional tone. It should address the sender's query or comment directly."),
});
export type GenerateEmailReplyOutput = z.infer<typeof GenerateEmailReplyOutputSchema>;

export async function generateEmailReply(
  input: GenerateEmailReplyInput
): Promise<GenerateEmailReplyOutput> {
  return generateEmailReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEmailReplyPrompt',
  input: { schema: GenerateEmailReplyInputSchema },
  output: { schema: GenerateEmailReplyOutputSchema },
  prompt: `You are an expert administrative assistant for an accounting firm called "My Accountant". Your name is Khai.

Your task is to draft a professional and helpful reply to the following email.

- Your tone should be friendly, professional, and reassuring.
- Address the sender by their name if it's available.
- Directly address the main point of their email.
- If they are asking a question, try to answer it. If they are sending documents, acknowledge receipt.
- Keep the reply concise.
- End with a friendly closing (e.g., "Regards," or "Kind regards,") followed by your name, "Khai", and the company name, "My Accountant".

**Original Email:**
**From:** {{{sender}}}
**Subject:** {{{subject}}}

**Body:**
{{{body}}}
---
`,
});

const generateEmailReplyFlow = ai.defineFlow(
  {
    name: 'generateEmailReplyFlow',
    inputSchema: GenerateEmailReplyInputSchema,
    outputSchema: GenerateEmailReplyOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
