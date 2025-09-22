
'use server';
/**
 * @fileOverview An AI agent for answering questions based on website content.
 * 
 * - websiteQAndA - A function that answers questions using website data as a knowledge base.
 * - WebsiteQAndAInput - The input type for the websiteQAndA function.
 * - WebsiteQAndAOutput - The return type for the websiteQAndA function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';
import { faqs } from '@/lib/data';
import { knowledgeBaseItems } from '@/lib/knowledge-base';

const WebsiteQAndAInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
});
export type WebsiteQAndAInput = z.infer<typeof WebsiteQAndAInputSchema>;

const WebsiteQAndAOutputSchema = z.object({
  answer: z.string().describe('A concise and helpful answer to the user\'s question, based *only* on the provided context. If the answer is not in the context, state that you cannot answer.'),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the answer based on the provided context. If the answer is directly stated in the context, confidence should be high (90-100). If it is inferred, it should be medium (60-80). If you cannot answer, it should be very low (0-10).'),
});
export type WebsiteQAndAOutput = z.infer<typeof WebsiteQAndAOutputSchema>;

// Serialize the website content to pass to the prompt
const websiteContent = `
  SERVICES:
  ${services.map(s => `Title: ${s.title}, Description: ${s.longDescription}, Price: ZAR ${s.price}`).join('\n\n')}

  BLOG POSTS:
  ${blogPosts.map(p => `Title: ${p.title}, Excerpt: ${p.excerpt}`).join('\n\n')}

  FREQUENTLY ASKED QUESTIONS:
  ${faqs.map(f => `Question: ${f.question}, Answer: ${f.answer}`).join('\n\n')}

  KNOWLEDGE BASE:
  ${knowledgeBaseItems.map(item => `Question: ${item.question}, Answer: ${item.answer}`).join('\n\n')}
`;


export async function websiteQAndA(
  input: WebsiteQAndAInput
): Promise<WebsiteQAndAOutput> {
  return websiteQAndAFlow(input);
}

const prompt = ai.definePrompt({
  name: 'websiteQAndAPrompt',
  input: {schema: WebsiteQAndAInputSchema},
  output: {schema: WebsiteQAndAOutputSchema},
  prompt: `You are an expert AI assistant for a company called "My Accountant". Your name is 'Accy'.
  
  Your personality is friendly, professional, and very helpful. Start your responses with a warm, welcoming tone.
  
  Your task is to answer user questions based *only* on the information provided in the context below. The Knowledge Base section is the highest source of truth.
  
  If the answer is not found in the context, you MUST state that you do not have that information and suggest they contact support. For example, say "That's an excellent question! I don't have that specific information right now, but our expert team would be happy to help. You can reach them through our support page."
  
  Do not make up answers.

  After providing the answer, you must also provide a confidence score (from 0 to 100) based on how directly the information was found in the context.
  - If the answer is explicitly stated, confidence should be 90-100.
  - If the answer is inferred from multiple pieces of information, confidence should be 60-80.
  - If you cannot answer the question at all, confidence should be 0-10.

  CONTEXT:
  ---
  ${websiteContent}
  ---

  User Question: {{{question}}}
  `,
});

const websiteQAndAFlow = ai.defineFlow(
  {
    name: 'websiteQAndAFlow',
    inputSchema: WebsiteQAndAInputSchema,
    outputSchema: WebsiteQAndAOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
