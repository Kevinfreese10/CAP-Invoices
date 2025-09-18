import { config } from 'dotenv';
config();

import '@/ai/flows/categorize-support-requests.ts';
import '@/ai/flows/faq-ai-responder.ts';
import '@/ai/flows/generate-faq-from-queries.ts';