'use server';
/**
 * @fileOverview An AI agent for generating full blog post content.
 * 
 * - generateBlogPost - A function that creates content for a blog post based on its title.
 * - GenerateBlogPostInput - The input type for the generateBlogPost function.
 * - GenerateBlogPostOutput - The return type for the generateBlogPost function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBlogPostInputSchema = z.object({
  title: z.string().describe('The title of the blog post.'),
});
export type GenerateBlogPostInput = z.infer<typeof GenerateBlogPostInputSchema>;

const GenerateBlogPostOutputSchema = z.object({
  excerpt: z.string().describe('A short, one-paragraph excerpt or summary of the blog post.'),
  content: z.string().describe('The full blog post content, formatted in HTML. It should be well-structured with <p>, <h3>, and <ul> or <ol> tags where appropriate. The tone should be professional yet engaging for a South African audience.'),
});
export type GenerateBlogPostOutput = z.infer<typeof GenerateBlogPostOutputSchema>;

export async function generateBlogPost(
  input: GenerateBlogPostInput
): Promise<GenerateBlogPostOutput> {
  return generateBlogPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBlogPostPrompt',
  input: {schema: GenerateBlogPostInputSchema},
  output: {schema: GenerateBlogPostOutputSchema},
  prompt: `You are an expert copywriter and SEO specialist for "My Accountant", a financial services company in South Africa.

  Your task is to write a complete, engaging, and informative blog post based on the provided title. The content must be tailored to a South African audience.

  Blog Post Title: {{{title}}}

  Please generate the following content:

  - **Excerpt**: A short, compelling one-paragraph summary of the article.
  - **Content**: The full blog post, formatted in clean HTML.
    - Structure the article logically with clear headings (use <h3> tags).
    - Use paragraphs (<p> tags) for the body text.
    - If lists are appropriate, use <ul> or <ol> tags.
    - The tone should be professional, helpful, and easy to understand for someone who is not a financial expert.
    - Ensure the content is relevant and provides real value to the reader.
  `,
});

const generateBlogPostFlow = ai.defineFlow(
  {
    name: 'generateBlogPostFlow',
    inputSchema: GenerateBlogPostInputSchema,
    outputSchema: GenerateBlogPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
