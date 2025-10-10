
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
  answer: z.string().describe('A concise and helpful answer to the user\'s question, based *only* on the provided context. If the answer is not in the context, state that you cannot answer.'),
  confidence: z.number().min(0).max(100).describe('A confidence score (0-100) of how certain you are about the answer based on the provided context. If the answer is directly stated in the context, confidence should be high (90-100). If it is inferred, it should be medium (60-80). If you cannot answer, it should be very low (0-10).'),
  serviceUrl: z.string().optional().describe("If the user's question is about a specific service, provide the URL for that service page. The URL should be in the format '/services/service-id'."),
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
    ${services.map(s => `Title: ${s.title}, URL: /services/${s.id}, Description: ${s.longDescription}, Price: ZAR ${s.price}`).join('\n\n')}

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
    
    Your task is to answer user questions based *only* on the information provided in the context below. The Knowledge Base section is the highest source of truth.

    If the user's question is about a specific service mentioned in the context, you must provide the 'serviceUrl' for that service in your response.
    
    If the answer is not found in the context, you MUST state that you do not have that information and suggest they contact support. For example, say "That's an excellent question! I don't have that specific information right now, but our expert team would be happy to help. You can reach them through our support page."
    
    Do not make up answers.

    After providing the answer, you must also provide a confidence score (from 0 to 100) based on how directly the information was found in the context.
    - If the answer is explicitly stated, confidence should be 90-100.
    - If the answer is inferred from multiple pieces of information, confidence should be 60-80.
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
