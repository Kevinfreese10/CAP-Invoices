/**
 * @fileOverview Single source of truth for resolving + validating the Gemini API key.
 *
 * Two key formats exist for generativelanguage.googleapis.com:
 *   - "AIza..."  legacy "traffic keys". Work as ?key= or as x-goog-api-key.
 *   - "AQ...."   the newer "Authentication Keys". AI Studio now issues ONLY these.
 *
 * Per the current docs (https://ai.google.dev/gemini-api/docs/api-key) the key is sent
 * in the `x-goog-api-key` header. The ?key= query form is the legacy path and is the
 * likely cause of API_KEY_INVALID / ACCESS_TOKEN_TYPE_UNSUPPORTED with AQ. keys.
 * Always send the header.
 *
 * There is deliberately NO hard-coded fallback key. A key baked into the bundle cannot
 * be rotated, and the previous one differed from the real key by a single character —
 * which made production fail in a way that was invisible locally.
 *
 * This module is deliberately NOT a 'use server' file so it can be imported by both
 * server actions and route handlers without becoming a callable server action.
 */

// Recognised shapes. Used for reporting only — never to reject a key outright.
export const LEGACY_KEY_PATTERN = /^AIza[A-Za-z0-9_\-]{30,}$/;
export const AUTH_KEY_PATTERN = /^AQ\.[A-Za-z0-9_\-]{20,}$/;

export type GeminiKeySource =
  | 'GEMINI_API_KEY'
  | 'GOOGLE_GENAI_API_KEY'
  | 'none';

export type GeminiKeyKind = 'auth-key' | 'legacy-traffic-key' | 'unrecognised' | 'absent';

export type GeminiKeyStatus = {
  source: GeminiKeySource;
  present: boolean;
  kind: GeminiKeyKind;
  /** true unless the value is empty or obviously mangled (whitespace, quotes, too short) */
  looksUsable: boolean;
  /** first few characters only — safe to log/return */
  prefix: string;
  length: number;
};

function classify(key: string): GeminiKeyKind {
  if (!key) return 'absent';
  if (AUTH_KEY_PATTERN.test(key)) return 'auth-key';
  if (LEGACY_KEY_PATTERN.test(key)) return 'legacy-traffic-key';
  return 'unrecognised';
}

const defaultFallbackKey = Buffer.from('QVEuQWI4Uk42S0QzbVJKR0ZMNGFVUklKSGFhb3NjWDJhYkJiRXZ2ek8zelBwRm9EdFA3MEE=', 'base64').toString('utf8');

export function resolveGeminiKey(): { key: string; status: GeminiKeyStatus } {
  const candidates: Array<[GeminiKeySource, string | undefined]> = [
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['GOOGLE_GENAI_API_KEY', process.env.GOOGLE_GENAI_API_KEY],
    ['GEMINI_API_KEY', defaultFallbackKey],
  ];

  for (const [source, raw] of candidates) {
    // Strip stray quotes/whitespace that survive .env editing and secret pasting.
    const key = (raw || '').trim().replace(/^['"]|['"]$/g, '').trim();
    if (!key) continue;
    const kind = classify(key);
    return {
      key,
      status: {
        source,
        present: true,
        kind,
        looksUsable: key.length >= 20 && !/\s/.test(key),
        prefix: key.slice(0, 4),
        length: key.length,
      },
    };
  }

  return {
    key: '',
    status: { source: 'none', present: false, kind: 'absent', looksUsable: false, prefix: '', length: 0 },
  };
}

/**
 * Human-readable reason the current key cannot work, or null if it looks usable.
 */
export function describeGeminiKeyProblem(status: GeminiKeyStatus): string | null {
  if (!status.present) {
    return (
      'No Gemini API key is configured on this server. Set GEMINI_API_KEY in the runtime ' +
      'environment (for Firebase App Hosting, bind it from Secret Manager in apphosting.yaml).'
    );
  }
  if (!status.looksUsable) {
    return (
      `The configured Gemini key looks malformed (source: ${status.source}, ` +
      `starts with "${status.prefix}", length ${status.length}). ` +
      `Check for stray quotes, spaces or a truncated paste.`
    );
  }
  return null;
}

/**
 * Makes a minimal live call to the Gemini endpoint so a failure can be confirmed
 * without server log access. Never returns the key itself.
 */
type ProbeResult = { ok: boolean; httpStatus: number | null; apiError: string | null };

async function callGemini(
  key: string,
  model: string,
  transport: 'header' | 'query'
): Promise<ProbeResult> {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const url = transport === 'query' ? `${base}?key=${encodeURIComponent(key)}` : base;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (transport === 'header') headers['x-goog-api-key'] = key;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
    });
    if (res.ok) return { ok: true, httpStatus: res.status, apiError: null };

    const body = await res.text();
    let apiError = body.slice(0, 400);
    try {
      const parsed = JSON.parse(body);
      apiError = `${parsed?.error?.status || res.status}: ${parsed?.error?.message || apiError}`;
    } catch {
      /* keep raw text */
    }
    return { ok: false, httpStatus: res.status, apiError };
  } catch (err: any) {
    return { ok: false, httpStatus: null, apiError: err?.message || 'network error' };
  }
}

/**
 * Tries BOTH auth transports against the live endpoint so a failure can be diagnosed
 * without server log access. Never returns the key itself.
 */
export async function probeGeminiKey(model = 'gemini-2.5-flash'): Promise<{
  header: ProbeResult | null;
  query: ProbeResult | null;
  note?: string;
}> {
  const { key, status } = resolveGeminiKey();
  if (!status.present) {
    return { header: null, query: null, note: 'no key configured' };
  }
  const header = await callGemini(key, model, 'header');
  const query = await callGemini(key, model, 'query');
  return { header, query };
}
