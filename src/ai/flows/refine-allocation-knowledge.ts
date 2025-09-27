
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
import { AllocationRule, VatType } from '@/lib/types';

const db = getFirestore(firebaseApp);

const RefineAllocationKnowledgeInputSchema = z.object({
  transactionDescription: z.string().describe("The original bank transaction description."),
  incorrectAllocation: z.string().describe("The AI's incorrect allocation suggestion."),
  correctAccountId: z.string().describe("The user-provided correct account ID."),
  correctVatType: z.custom<VatType>().describe("The user-provided correct VAT type."),
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
  prompt: `You are an AI accountant learning to better categorize transactions. You have made a mistake and a human is providing you with feedback. Your task is to convert this feedback into a new, generalized 'soft' rule description that you can apply in the future.

**Feedback Details:**

*   **Transaction:** "{{transactionDescription}}"
*   **Your Incorrect Suggestion:** {{incorrectAllocation}}
*   **Correct Allocation:** Account {{correctAccountId}} (VAT: {{correctVatType}})
{{#if userProvidedRule}}
*   **User's Rule:** "{{userProvidedRule}}"
{{/if}}

**Task:**

Based on the information above, create a single, concise, and generalized rule description. This rule should help you correctly allocate similar transactions in the future. Focus on identifying the core concept or pattern in the transaction description. Do not mention account numbers.

**Example:**
If the transaction is "Monthly Subscription for Office 365" and the user corrects your allocation to "Computer Expenses", a good refined rule description would be: "Software subscriptions like 'Office 365' are allocated to Computer Expenses."
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
          accountId: input.correctAccountId,
          vatType: input.correctVatType,
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
