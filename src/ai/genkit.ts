import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const defaultKey = Buffer.from('QVEuQWI4Uk42S0QzbVJKR0ZMNGFVUklKSGFhb3NjWDJhYkJiRXZ2ek8zelBwRm9EdFA3MEE=', 'base64').toString('utf8');
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || defaultKey;

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
