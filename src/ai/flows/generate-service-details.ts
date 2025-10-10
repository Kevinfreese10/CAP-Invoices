
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
import { googleAI } from '@genkit-ai/google-genai';

const GenerateServiceDetailsInputSchema = z.object({
  title: z.string().describe('The title of the service.'),
});
export type GenerateServiceDetailsInput = z.infer<typeof GenerateServiceDetailsInputSchema>;

const GenerateServiceDetailsOutputSchema = z.object({
  correctedTitle: z.string().describe('The corrected and polished version of the service title.'),
  shortDescription: z.string().describe('A concise, one-sentence description of the service.'),
  longDescription: z.string().describe('A detailed, paragraph-long description of the service, highlighting its benefits and features.'),
  turnaroundTime: z.string().describe('A typical turnaround time for this service (e.g., "5-7 working days").'),
  whatsIncluded: z.array(z.string()).describe("A bulleted list of what is included in the service package."),
  clientRequirements: z.array(z.string()).describe("A bulleted list of documents or information required from the client before work can begin."),
  metaTitle: z.string().describe('An SEO-optimized meta title, under 60 characters. It should be compelling, include the main keyword (service title), and end with the brand name "| My Accountant".'),
  metaDescription: z.string().describe('An SEO-optimized meta description, between 140-160 characters. It should be a compelling, actionable summary that encourages clicks.'),
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

  Your task is to generate compelling and accurate content for a specific service based on its title. The content must be tailored to a South African audience and follow modern SEO best practices for Google Search Console indexing.

  First, review the following service title for any spelling or grammatical errors and provide a corrected, polished version in the 'correctedTitle' field.

  Service Title: {{{title}}}

  Then, please generate the following content based on these strict guidelines:

  - **Short Description**: A concise, one-sentence description of the service.
  - **Long Description**: A detailed long description (one paragraph) explaining what the service is, who it's for, and its benefits.
  - **Turnaround Time**: A typical turnaround time for this service (e.g., "5-7 working days").
  - **What's Included**: A list of 3-5 key deliverables or components that the client receives as part of this service.
  - **Client Requirements**: A list of 3-5 essential documents or pieces of information the client *must* provide before work can begin.
  
  ---
  
  **SEO Information (Strict Guidelines):**

  - **Meta Title (Title Tag)**:
    - **Purpose**: The main clickable headline shown in search results.
    - **Rules**:
      - Must be between 50–60 characters.
      - Place the primary keyword (from the service title) near the start.
      - End with the brand name: " | My Accountant".
      - Must be unique and written in natural language.
    - **Example**: Tax Clearance Certificate | My Accountant

  - **Meta Description**:
    - **Purpose**: The snippet below the title in search results.
    - **Rules**:
      - Must be between 140–160 characters long.
      - Include primary and secondary keywords naturally.
      - Make it actionable and compelling (use verbs like "get", "order", "ensure").
      - Must accurately match the service content.
    - **Example**: Get your Tax Clearance Certificate fast and hassle-free. Order online and receive it within 24 hours from My Accountant.

  - **Meta Keywords**:
    - **Purpose**: For internal reference or other search engines (less impact on Google).
    - **Rules**:
      - Provide a list of 3–5 relevant keywords or keyphrases.
    - **Example**: tax clearance, SARS, compliance certificate, My Accountant
  `,
});

const generateServiceDetailsFlow = ai.defineFlow(
  {
    name: 'generateServiceDetailsFlow',
    inputSchema: GenerateServiceDetailsInputSchema,
    outputSchema: GenerateServiceDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, { model: 'gemini-pro' });
    return output!;
  }
);
