
'use server';
/**
 * @fileOverview An AI agent for finding a story name from a knowledge base based on a commission number.
 *
 * - findStoryName - A function that takes a commission number and knowledge base text, and returns the corresponding story name.
 */

import { ai } from '@/ai/genkit';
import { FindStoryNameInput, FindStoryNameInputSchema, FindStoryNameOutput, FindStoryNameOutputSchema } from '@/lib/types';


export async function findStoryName(
  input: FindStoryNameInput
): Promise<FindStoryNameOutput> {
  return findStoryNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findStoryNamePrompt',
  input: { schema: FindStoryNameInputSchema },
  output: { schema: FindStoryNameOutputSchema },
  prompt: `You are a data lookup assistant. Your task is to find the corresponding "Story Name" for a given "Commission Number" from the provided knowledge base text.

The knowledge base contains lines where the first column is the commission number and the second column is the story name, often separated by a tab or multiple spaces.

Find the story name associated with the commission number: {{{commissionNumber}}}

Knowledge Base:
---
{{{knowledgeBase}}}
---

Only return the story name if you find an exact match for the commission number. If no match is found, return nothing.`,
});


const findStoryNameFlow = ai.defineFlow(
  {
    name: 'findStoryNameFlow',
    inputSchema: FindStoryNameInputSchema,
    outputSchema: FindStoryNameOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
