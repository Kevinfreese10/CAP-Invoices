'use server';
/**
 * @fileOverview An AI agent for generating service details and SEO content.
 * 
 * - generateServiceDetails - A function that creates content for a service based on its title.
 * - GenerateServiceDetailsInput - The input type for the generateServiceDetails function.
 * - GenerateServiceDetailsOutput - The return type for the generateServiceDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateServiceDetailsInputSchema = z.object({
  title: z.string().describe('The title of the service.'),
});
export type GenerateServiceDetailsInput = z.infer<typeof GenerateServiceDetailsInputSchema>;

const GenerateServiceDetailsOutputSchema = z.object({
  shortDescription: z.string().describe('A concise, one-sentence description of the service.'),
  longDescription: z.string().describe('A detailed, paragraph-long description of the service, highlighting its benefits and features.'),
  turnaroundTime: z.string().describe('A typical turnaround time for this service (e.g., "5-7 working days").'),
  metaTitle: z.string().describe('An SEO-optimized meta title, under 60 characters. It should be compelling and include the main keyword (service title) and brand name "My Accountant".'),
  metaDescription: z.string().describe('An SEO-optimized meta description, under 160 characters. It should be a compelling summary that encourages clicks.'),
  metaKeywords: z.array(z.string()).describe('A list of 3-5 relevant SEO keywords or keyphrases.'),
});
export type GenerateServiceDetailsOutput = z.infer<typeof GenerateServiceDetailsOutputSchema>;

export async function generateServiceDetails(
  input: GenerateServiceDetailsInput
): Promise<GenerateServiceDetailsOutput> {
  return generateServiceDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateServiceDetailsPrompt',
  input: {schema: GenerateServiceDetailsInputSchema},
  output: {schema: GenerateServiceDetailsOutputSchema},
  prompt: `You are an expert copywriter and SEO specialist for "My Accountant", a financial services company in South Africa.

  Your task is to generate compelling and accurate content for a specific service based on its title. The content must be tailored to a South African audience and follow SEO best practices for Google Search Console indexing.

  Service Title: {{{title}}}

  Please generate the following content:
  - A short, one-sentence description.
  - A detailed long description (one paragraph) explaining what the service is, who it's for, and its benefits.
  - A typical turnaround time for this service.
  - An SEO-optimized meta title (under 60 chars) that includes the service title and "My Accountant".
  - An SEO-optimized meta description (under 160 chars) that summarizes the service and includes a call-to-action.
  - A list of 3-5 relevant SEO keywords.
  `,
});

const generateServiceDetailsFlow = ai.defineFlow(
  {
    name: 'generateServiceDetailsFlow',
    inputSchema: GenerateServiceDetailsInputSchema,
    outputSchema: GenerateServiceDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
