
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

  // Static content from the website
  const aboutPageContent = `
    About My Accountant: Your dynamic partner in conquering the financial world. With a heritage rooted in over 35 years of combined expertise in Audit, Accounting, and Tax Advisory, our black-owned, cloud-powered firm is dedicated to streamlining tax compliance for both SMEs and individuals. Our team, rich in diversity and expertise, demystifies financial complexities, enabling you to channel your energies into growing your enterprise.
    Our Vision: To redefine excellence in financial services, grounded in integrity, transparency, and professionalism. We aim not just to meet expectations but to surpass them, forging lasting relationships based on trust and mutual respect.
    Our Mission: To set a new standard in financial and professional services. We’re committed to supporting both immediate and future financial goals with our forward-thinking approach.
    Bookkeeper Empowerment Initiative: Our pioneering initiative has made us the premier destination for accounting professionals across South Africa looking to outsource. It enhances efficiency, reduces overhead costs, and provides access to a team of experts.
  `;

  const compliancePageContent = `
    Free Compliance Check: We offer a free, no-obligation compliance assessment for CIPC and SARS.
    SARS Compliance Services: Tax Clearance Pins, Income Tax Registration, VAT Registration, PAYE/UIF/SDL Registration, Tax Returns (Income Tax, VAT, PAYE, Provisional), Compliance Reviews, and negotiation for remission of fines and penalties.
    CIPC Compliance Services: New Company Registration, Amendments (director details, name, address), Beneficial Ownership Declaration, Annual Returns, Reinstatements, and Securities Register.
  `;

  const becomeAPartnerPageContent = `
    Bookkeeper Empowerment Initiative (BEI): Empowers small and growing bookkeepers in South Africa. Joining is free. Partners get a 10% discount on all services.
    How it works: Apply online, access your reseller dashboard, outsource or accept work, and access mentorship and training. All client communication goes through your email (white-label model).
    Who can join: Freelance Bookkeepers, Startup Accounting Firms, Tax Practitioners, Business Consultants, Payroll Administrators. No need to be a registered accountant to offer services, but to receive outsourced work from My Accountant, you must belong to a recognized professional body (SAICA, SAIT, CIBA, or SAIPA).
  `;

  const refundPolicyContent = `
    Refund Policy: All services are non-refundable once work has begun. Refunds may be considered if the service has not started, with a 10% processing fee deducted. Refund requests must be made within 48 hours of purchase.
  `;

  const popiaPolicyContent = `
    POPIA Compliance: My Accountant is committed to safeguarding personal information in line with POPIA. We process information lawfully and for legitimate business purposes. We do not sell personal information. Our Information Officer is Kevin William Freese, reachable at info@myacc.co.za.
  `;

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
    
    ABOUT US:
    ${aboutPageContent}

    COMPLIANCE SERVICES:
    ${compliancePageContent}

    BECOME A PARTNER / RESELLER PROGRAM:
    ${becomeAPartnerPageContent}

    REFUND POLICY:
    ${refundPolicyContent}

    PRIVACY (POPIA) POLICY:
    ${popiaPolicyContent}
  `;

  const prompt = ai.definePrompt({
    name: 'websiteQAndAPrompt',
    input: {schema: WebsiteQAndAInputSchema},
    output: {schema: WebsiteQAndAOutputSchema},
    prompt: `You are an expert AI assistant for a company called "My Accountant". Your name is 'Khai'.
    
    Your personality is friendly, professional, and very helpful. Start your responses with a warm, welcoming tone.
    
    Your task is to answer user questions. You should ALWAYS prioritize using the information provided in the 'CONTEXT' section below to answer questions about the company's services, pricing, and policies. The Knowledge Base section is the highest source of truth.

    If the user's question is about a specific service mentioned in the context, you MUST provide the 'serviceUrl' for that service in your response. The service URL must exactly match the URL provided in the context for that service.
    
    CRITICAL INSTRUCTION: When answering a question about a service using the provided context, you MUST ALWAYS format the key details as a clear, easy-to-read bullet-point list using markdown. The list must include the Price, Turnaround Time, and a summary of the Prerequisites (client requirements). For example:
    "Hello! I can certainly help with VAT Registration. Here are the details:
- **Price:** ZAR 1400
- **Turnaround:** 7-10 working days
- **Requirements:** Certified ID copy, proof of address, company documents, proof of bank account, and turnover details."
    
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
