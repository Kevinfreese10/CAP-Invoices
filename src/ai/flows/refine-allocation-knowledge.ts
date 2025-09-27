
'use server';
/**
 * @fileOverview An AI agent for refining transaction allocation knowledge.
 * 
 * - refineAllocationKnowledge - A function that takes feedback and generates a refined rule.
 * - RefineAllocationKnowledgeInput - The input type for the refineAllocationKnowledge function.
 * - RefineAllocationKnowledgeOutput - The return type for the refineAllocationKnowledge function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore, addDoc, collection } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { AllocationRule } from '@/lib/types';

const db = getFirestore(firebaseApp);

const RefineAllocationKnowledgeInputSchema = z.object({
  transactionDescription: z.string().describe("The original bank transaction description."),
  incorrectAllocation: z.string().describe("The AI's incorrect allocation suggestion."),
  correctAllocation: z.string().describe("The user-provided correct allocation."),
  userProvidedRule: z.string().optional().describe("An optional rule provided by the user to explain the logic."),
});
export type RefineAllocationKnowledgeInput = z.infer<typeof RefineAllocationKnowledgeInputSchema>;

const RefineAllocationKnowledgeOutputSchema = z.object({
  refinedRule: z.string().describe("A concise, generalized rule that the AI can use for future allocations based on the provided feedback."),
});
export type RefineAllocationKnowledgeOutput = z.infer<typeof RefineAllocationKnowledgeOutputSchema>;

export async function refineAllocationKnowledge(
  input: RefineAllocationKnowledgeInput
): Promise<RefineAllocationKnowledgeOutput> {
  return refineAllocationKnowledgeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refineAllocationKnowledgePrompt',
  input: {schema: RefineAllocationKnowledgeInputSchema},
  output: {schema: RefineAllocationKnowledgeOutputSchema},
  prompt: `You are an AI accountant learning to better categorize transactions. You have made a mistake and a human is providing you with feedback. Your task is to convert this feedback into a new, generalized rule that you can apply in the future.

**Feedback Details:**

*   **Transaction:** "{{transactionDescription}}"
*   **Your Incorrect Suggestion:** {{incorrectAllocation}}
*   **Correct Allocation:** {{correctAllocation}}
{{#if userProvidedRule}}
*   **User's Rule:** "{{userProvidedRule}}"
{{/if}}

**Task:**

Based on the information above, create a single, concise, and generalized rule. This rule should help you correctly allocate similar transactions in the future. Focus on identifying keywords or patterns in the transaction description.

**Example:**
If the transaction is "Monthly Subscription for Office 365" and the user corrects your allocation to "Computer Expenses", a good refined rule would be: "Transactions containing 'Office 365' or 'Subscription' for software should be allocated to Computer Expenses."
  `,
});

const refineAllocationKnowledgeFlow = ai.defineFlow(
  {
    name: 'refineAllocationKnowledgeFlow',
    inputSchema: RefineAllocationKnowledgeInputSchema,
    outputSchema: RefineAllocationKnowledgeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    
    // Save the refined rule to Firestore
    if (output?.refinedRule) {
      try {
        const newRule: Omit<AllocationRule, 'id'> = {
          type: 'soft', // New rules from feedback are conceptual 'soft' rules
          description: output.refinedRule,
          keywords: [], // Soft rules don't use keywords
          accountId: input.correctAllocation.split(' ')[0], // Best guess for accountId
          vatType: 'no_vat' // Default VAT type, user can adjust later
        };
        await addDoc(collection(db, "allocationRules"), newRule);
        console.log("New AI Rule Learned and saved to Firestore:", output.refinedRule);
      } catch (error) {
        console.error("Error saving new AI rule to Firestore:", error);
      }
    }
    
    return output!;
  }
);
