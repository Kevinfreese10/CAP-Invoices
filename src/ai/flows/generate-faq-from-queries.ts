// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview An AI agent to generate FAQ content from common client queries.
 *
 * - generateFaqFromQueries - A function that takes a list of client queries and generates FAQ content.
 * - GenerateFaqFromQueriesInput - The input type for the generateFaqFromQueries function.
 * - GenerateFaqFromQueriesOutput - The return type for the generateFaqFromQueries function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFaqFromQueriesInputSchema = z.object({
  queries: z
    .string()
    .array()
    .describe('A list of common client queries to generate FAQ content from.'),
});
export type GenerateFaqFromQueriesInput = z.infer<typeof GenerateFaqFromQueriesInputSchema>;

const GenerateFaqFromQueriesOutputSchema = z.object({
  faqContent: z.string().describe('The generated FAQ content.'),
});
export type GenerateFaqFromQueriesOutput = z.infer<typeof GenerateFaqFromQueriesOutputSchema>;

export async function generateFaqFromQueries(
  input: GenerateFaqFromQueriesInput
): Promise<GenerateFaqFromQueriesOutput> {
  return generateFaqFromQueriesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFaqFromQueriesPrompt',
  input: {schema: GenerateFaqFromQueriesInputSchema},
  output: {schema: GenerateFaqFromQueriesOutputSchema},
  prompt: `You are an AI-powered tool that generates FAQ content from a list of common client queries.

  Analyze the following client queries and generate comprehensive FAQ content that addresses the questions and concerns raised in the queries.

  Queries:
  {{#each queries}}- {{{this}}}\n{{/each}}
  `,
});

const generateFaqFromQueriesFlow = ai.defineFlow(
  {
    name: 'generateFaqFromQueriesFlow',
    inputSchema: GenerateFaqFromQueriesInputSchema,
    outputSchema: GenerateFaqFromQueriesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    