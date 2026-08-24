import { NextResponse } from 'next/server';
import { resolveGeminiKey, describeGeminiKeyProblem, probeGeminiKey } from '@/ai/gemini-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/diag/gemini
 *
 * Diagnostics for the invoice OCR pipeline. Reports whether a usable Gemini API key
 * is present at runtime and, optionally, what the live API says about it.
 * Never returns the key — only its source, length and 4-char prefix.
 *
 * Add ?probe=1 to make a real (tiny) call to the Gemini endpoint using BOTH
 * the x-goog-api-key header and the legacy ?key= query parameter, so you can see
 * exactly which transport your key is accepted on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsProbe = url.searchParams.get('probe') === '1';

  const { status } = resolveGeminiKey();
  const problem = describeGeminiKeyProblem(status);

  const body: Record<string, unknown> = {
    checkedAt: new Date().toISOString(),
    env: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      GOOGLE_GENAI_API_KEY: Boolean(process.env.GOOGLE_GENAI_API_KEY),
    },
    keyStatus: status,
    usable: problem === null,
    problem,
  };

  if (wantsProbe) {
    body.probe = await probeGeminiKey();
  }

  return NextResponse.json(body, { status: problem === null ? 200 : 503 });
}
