'use server';

/**
 * @fileOverview An AI agent to respond to FAQ questions.
 *
 * - faqAIResponder - A function that takes a question and returns an answer from an AI-powered FAQ.
 * - FAQAIResponderInput - The input type for the faqAIResponder function.
 * - FAQAIResponderOutput - The return type for the faqAIResponder function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FAQAIResponderInputSchema = z.object({
  question: z.string().describe('The question to be answered.'),
});
export type FAQAIResponderInput = z.infer<typeof FAQAIResponderInputSchema>;

const FAQAIResponderOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
});
export type FAQAIResponderOutput = z.infer<typeof FAQAIResponderOutputSchema>;

export async function faqAIResponder(input: FAQAIResponderInput): Promise<FAQAIResponderOutput> {
  return faqAIResponderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'faqAIResponderPrompt',
  input: {schema: FAQAIResponderInputSchema},
  output: {schema: FAQAIResponderOutputSchema},
  prompt: `You are an AI-powered FAQ section. Answer the following question:

Question: {{{question}}}`,
});

const faqAIResponderFlow = ai.defineFlow(
  {
    name: 'faqAIResponderFlow',
    inputSchema: FAQAIResponderInputSchema,
    outputSchema: FAQAIResponderOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    