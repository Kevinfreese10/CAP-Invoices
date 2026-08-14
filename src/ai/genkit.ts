import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-3.5-flash-lite',
});

export function getCustomAi(apiKey?: string) {
    if (!apiKey || !apiKey.trim()) return ai;
    return genkit({
        plugins: [googleAI({ apiKey: apiKey.trim() })],
        model: 'googleai/gemini-3.5-flash-lite',
    });
}
