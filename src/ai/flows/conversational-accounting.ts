'use server';
/**
 * @fileOverview A conversational AI agent for bookkeeping tasks.
 *
 * - conversationalAccountingFlow - A function that interprets user instructions to perform bookkeeping.
 * - ConversationalAccountingInput - The input type for the function.
 * - ConversationalAccountingOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { ImportedTransaction } from '@/lib/types';
import { refineAllocationKnowledge } from './refine-allocation-knowledge';

export type ConversationalAccountingInput = {
    userInstruction: string;
    unallocatedTransactions: ImportedTransaction[];
};

const ConversationalAccountingOutputSchema = z.object({
  response: z.string().describe("A conversational response to the user, explaining what was done or asking for clarification."),
  knowledgeToSave: z.string().optional().describe("If the AI learned a new, general rule, this field contains that rule as a string. e.g., 'Transactions with 'Uber' should be allocated to Travel'"),
});

export type ConversationalAccountingOutput = z.infer<typeof ConversationalAccountingOutputSchema>;


export async function conversationalAccounting(
  input: ConversationalAccountingInput
): Promise<ConversationalAccountingOutput> {
  const prompt = ai.definePrompt(
    {
      name: 'conversationalAccountingPrompt',
      input: {
        schema: z.object({
          userInstruction: z.string(),
          unallocatedTransactions: z.array(
            z.object({
              id: z.string(),
              description: z.string(),
              amount: z.number(),
              date: z.string(),
            })
          ),
        }),
      },
      output: { schema: ConversationalAccountingOutputSchema },
      prompt: `You are an expert AI bookkeeper. Your goal is to help the user allocate their bank transactions by following their instructions.

**Your Persona:** Friendly, helpful, and slightly formal. You are an assistant, not a human.

**Core Task:**
1.  **Analyze Instruction:** Understand what the user wants to do.
2.  **Find Transactions:** Use the \`findTransactions\` tool to find relevant transactions from the list provided.
3.  **Clarify and Confirm:** ALWAYS confirm with the user before making changes. State what you found and what you plan to do. For example: "I found 3 transactions with 'Telkom'. Should I allocate them all to 'Telephone & Fax'?"
4.  **Generate Output:**
    *   **response**: Your conversational reply to the user. This is mandatory.
    *   **knowledgeToSave**: If the user's instruction results in a new, general rule, populate this field. This is for corrective feedback. For example, if the user says "Pastel should be Computer Expenses", you should generate a knowledge item that says "Transactions containing 'Pastel' should be allocated to Computer Expenses (3300/000)".

**Current Unallocated Transactions:**
{{#each unallocatedTransactions}}
- {{description}} ({{amount}})
{{/each}}

**User Instruction:**
"{{{userInstruction}}}"
`,
    },
    async (input) => {
      const findTransactionsToolWithContext = ai.defineTool(
        {
          name: 'findTransactions',
          description: 'Finds transactions based on a search query from the list of unallocated transactions.',
          input: { schema: z.string() },
          output: {
            schema: z.array(
              z.object({
                id: z.string(),
                description: z.string(),
                amount: z.number(),
                date: z.string(),
              })
            ),
          },
        },
        async (query) => {
          return input.unallocatedTransactions.filter((tx) =>
            tx.description.toLowerCase().includes(query.toLowerCase())
          );
        }
      );

      const { output } = await prompt(input, { tools: [findTransactionsToolWithContext] });
      return output as ConversationalAccountingOutput;
    }
  );

  const result = await prompt(input);

  // If the AI generated knowledge, save it using the other flow
  if (result.knowledgeToSave) {
    try {
      await refineAllocationKnowledge({
        transactionDescription: 'Conversational Input',
        incorrectAllocation: 'N/A',
        correctAllocation: 'N/A',
        userProvidedRule: result.knowledgeToSave,
      });
      console.log('Knowledge saved from conversation:', result.knowledgeToSave);
    } catch (e) {
      console.error('Failed to save knowledge from conversation:', e);
    }
  }

  return result;
}
