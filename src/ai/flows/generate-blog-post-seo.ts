'use server';
/**
 * @fileOverview An AI agent for generating blog post SEO content.
 * 
 * - generateBlogPostSeo - A function that creates SEO content for a blog post based on its title.
 * - GenerateBlogPostSeoInput - The input type for the generateBlogPostSeo function.
 * - GenerateBlogPostSeoOutput - The return type for the generateBlogPostSeo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBlogPostSeoInputSchema = z.object({
  title: z.string().describe('The title of the blog post.'),
});
export type GenerateBlogPostSeoInput = z.infer<typeof GenerateBlogPostSeoInputSchema>;

const GenerateBlogPostSeoOutputSchema = z.object({
  metaTitle: z.string().describe('An SEO-optimized meta title, under 60 characters. It should be compelling, include the main keyword (post title), and end with the brand name "| My Accountant".'),
  metaDescription: z.string().describe('An SEO-optimized meta description, between 140-160 characters. It should be a compelling, actionable summary that encourages clicks.'),
  metaKeywords: z.array(z.string()).describe('A list of 3-5 relevant SEO keywords or keyphrases.'),
});
export type GenerateBlogPostSeoOutput = z.infer<typeof GenerateBlogPostSeoOutputSchema>;

export async function generateBlogPostSeo(
  input: GenerateBlogPostSeoInput
): Promise<GenerateBlogPostSeoOutput> {
  return generateBlogPostSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBlogPostSeoPrompt',
  input: {schema: GenerateBlogPostSeoInputSchema},
  output: {schema: GenerateBlogPostSeoOutputSchema},
  prompt: `You are an expert copywriter and SEO specialist for "My Accountant", a financial services company in South Africa.

  Your task is to generate compelling SEO content for a blog post based on its title. The content must be tailored to a South African audience and follow modern SEO best practices for Google Search Console indexing.

  Blog Post Title: {{{title}}}

  Please generate the following content based on these strict guidelines:
  
  **SEO Information (Strict Guidelines):**

  - **Meta Title (Title Tag)**:
    - **Purpose**: The main clickable headline shown in search results.
    - **Rules**:
      - Must be between 50–60 characters.
      - Place the primary keyword (from the post title) near the start.
      - End with the brand name: " | My Accountant".
      - Must be unique and written in natural language.
    - **Example**: Tax Tips for Freelancers in SA | My Accountant

  - **Meta Description**:
    - **Purpose**: The snippet below the title in search results.
    - **Rules**:
      - Must be between 140–160 characters long.
      - Include primary and secondary keywords naturally.
      - Make it actionable and compelling.
      - Must accurately match the blog post content.
    - **Example**: Master your finances as a South African freelancer with these 5 essential tax tips. Learn how to stay compliant and save money.

  - **Meta Keywords**:
    - **Purpose**: For internal reference or other search engines (less impact on Google).
    - **Rules**:
      - Provide a list of 3–5 relevant keywords or keyphrases.
    - **Example**: freelance tax south africa, provisional tax, sars tips, independent contractor
  `,
});

const generateBlogPostSeoFlow = ai.defineFlow(
  {
    name: 'generateBlogPostSeoFlow',
    inputSchema: GenerateBlogPostSeoInputSchema,
    outputSchema: GenerateBlogPostSeoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
