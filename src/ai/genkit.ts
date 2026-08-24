import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {resolveGeminiKey, describeGeminiKeyProblem} from '@/ai/gemini-key';

const {key: apiKey, status} = resolveGeminiKey();

// Warn loudly at boot so a misconfigured key is obvious in the server logs
// instead of only surfacing as a masked Server Action error in the browser.
const problem = describeGeminiKeyProblem(status);
if (problem) {
  console.error('[genkit] ' + problem);
}

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
