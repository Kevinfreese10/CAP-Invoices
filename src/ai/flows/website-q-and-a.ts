
'use server';
/**
 * @fileOverview An AI agent for answering questions based on website content and general knowledge.
 * 
 * - websiteQAndA - A function that answers questions using website data as a knowledge base.
 * - WebsiteQAndAInput - The input type for the websiteQAndA function.
 * - WebsiteQAndAOutput - The return type for the websiteQAndA function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { faqs } from '@/lib/data';
import { knowledgeBaseItems } from '@/lib/knowledge-base';
import { getFirestore, collection, addDoc, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

const db = getFirestore(firebaseApp);

const WebsiteQAndAInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
  history: z.array(z.object({
    role: z.enum(['user', 'bot']),
    content: z.string(),
  })).optional().describe('The conversation history.'),
});
export type WebsiteQAndAInput = z.infer<typeof WebsiteQAndAInputSchema>;

const WebsiteQAndAOutputSchema = z.object({
  answer: z.string().describe('A concise and helpful answer to the user\'s question. Prioritize information from the provided context, but use general knowledge if the answer is not available there. If you cannot answer, state that.'),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the answer. If the answer is directly stated in the context, confidence should be high (90-100). If it is inferred from the context, it should be medium (60-80). If using general knowledge, confidence should be lower (40-60). If you cannot answer, it should be very low (0-10).'),
  serviceUrl: z.string().optional().describe("If the user's question is about a specific service, provide the URL for that service page. The URL should be in the format '/services/service-slug'."),
});
export type WebsiteQAndAOutput = z.infer<typeof WebsiteQAndAOutputSchema>;

export async function websiteQAndA(
  input: WebsiteQAndAInput
): Promise<WebsiteQAndAOutput> {
  // Fetch live data from Firestore
  const servicesSnapshot = await getDocs(query(collection(db, 'services'), orderBy('title')));
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

  const blogPostsSnapshot = await getDocs(query(collection(db, 'blogPosts'), orderBy('date', 'desc')));
  const blogPosts = blogPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));

  // Serialize the website content to pass to the prompt
  const websiteContent = `
    SERVICES:
    ${services.map(s => `Title: ${s.title}, URL: /services/${s.slug}, Description: ${s.longDescription}, Price: ZAR ${s.price}, Turnaround Time: ${s.turnaroundTime}, Prerequisites: ${s.clientRequirements.join(', ')}`).join('\n\n')}

    BLOG POSTS:
    ${blogPosts.map(p => `Title: ${p.title}, Excerpt: ${p.excerpt}`).join('\n\n')}

    FREQUENTLY ASKED QUESTIONS:
    ${faqs.map(f => `Question: ${f.question}, Answer: ${f.answer}`).join('\n\n')}

    KNOWLEDGE BASE:
    ${knowledgeBaseItems.map(item => `Question: ${item.question}, Answer: ${item.answer}`).join('\n\n')}
  `;

  const prompt = ai.definePrompt({
    name: 'websiteQAndAPrompt',
    input: {schema: WebsiteQAndAInputSchema},
    output: {schema: WebsiteQAndAOutputSchema},
    prompt: `You are an expert AI assistant for a company called "My Accountant". Your name is 'Khai'.
    
    Your personality is friendly, professional, and very helpful. Start your responses with a warm, welcoming tone.
    
    Your task is to answer user questions. You should ALWAYS prioritize using the information provided in the 'CONTEXT' section below to answer questions about the company's services, pricing, and policies. The Knowledge Base section is the highest source of truth.

    If the user's question is about a specific service mentioned in the context, you MUST provide the 'serviceUrl' for that service in your response. The service URL must exactly match the URL provided in the context for that service.
    
    CRITICAL INSTRUCTION: When answering a question about a service using the provided context, you MUST ALWAYS include the following details in your answer:
    1.  The price.
    2.  The completion time (turnaround time).
    3.  A summary of the prerequisites (client requirements).

    If the answer cannot be found in the provided context, you may use your general knowledge to answer the question.
    
    If you are completely unable to answer, you MUST state that you do not have that information and suggest they contact support. For example, say "That's an excellent question! I don't have that specific information right now, but our expert team would be happy to help. You can call us on 010 109 1625 during office hours or email us at info@myacc.co.za for assistance."
    
    Do not make up answers that are not in the context or your general knowledge.

    After providing the answer, you must also provide a confidence score (from 0 to 100) based on how you answered:
    - If the answer is explicitly stated in the context, confidence should be 90-100.
    - If the answer is inferred from multiple pieces of information in the context, confidence should be 60-80.
    - If you use your general knowledge from the internet, confidence should be 40-60.
    - If you cannot answer the question at all, confidence should be 0-10.
    
    Use the conversation history to understand the context of the question.

    CONTEXT:
    ---
    ${websiteContent}
    ---

    CONVERSATION HISTORY:
    {{#each history}}
      {{role}}: {{{content}}}
    {{/each}}

    User Question: {{{question}}}
    `,
  });

  const {output} = await prompt(input);
      
  if (output && output.confidence < 15) {
      try {
          await addDoc(collection(db, 'unansweredQuestions'), {
              question: input.question,
              timestamp: Timestamp.now(),
          });
      } catch (error) {
          console.error("Error logging unanswered question:", error);
      }
  }
  
  return output!;
}
