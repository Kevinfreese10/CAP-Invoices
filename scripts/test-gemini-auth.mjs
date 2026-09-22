/**
 * Diagnostic: works out which auth transport (if any) the configured Gemini key accepts.
 * Run from the project root:   node scripts/test-gemini-auth.mjs
 * Reads GEMINI_API_KEY from .env — nothing is printed except the key's prefix.
 */
import fs from 'node:fs';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = fs.readFileSync('.env', 'utf8');
  const line = env.split(/\r?\n/).find(l => l.startsWith('GEMINI_API_KEY='));
  if (!line) throw new Error('GEMINI_API_KEY not found in .env');
  return line.slice('GEMINI_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
}

const KEY = loadKey();
const MODEL = 'gemini-2.5-flash';
const BODY = JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] });

console.log(`key: ${KEY.slice(0, 6)}... (length ${KEY.length})\n`);

const cases = [
  ['v1beta + x-goog-api-key header',
   `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
   { 'x-goog-api-key': KEY }],
  ['v1beta + ?key= query param',
   `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`,
   {}],
  ['v1 + x-goog-api-key header',
   `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,
   { 'x-goog-api-key': KEY }],
  ['v1beta + Authorization: Bearer',
   `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
   { Authorization: `Bearer ${KEY}` }],
  ['v1beta + header + x-goog-user-project',
   `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
   { 'x-goog-api-key': KEY, 'x-goog-user-project': '841799917183' }],
];

for (const [label, url, headers] of cases) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: BODY,
    });
    if (res.ok) {
      console.log(`PASS  ${label}`);
      continue;
    }
    const text = await res.text();
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = `${j?.error?.status || ''} ${j?.error?.message || ''}`.trim().slice(0, 200);
    } catch {}
    console.log(`FAIL  ${label}\n        HTTP ${res.status}  ${msg}`);
  } catch (e) {
    console.log(`ERROR ${label}\n        ${e.message}`);
  }
}

// Does the endpoint recognise the key at all?
try {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': KEY },
  });
  const text = await res.text();
  if (res.ok) {
    const names = (JSON.parse(text).models || []).map(m => m.name).slice(0, 5);
    console.log(`\nPASS  ListModels — key is recognised. e.g. ${names.join(', ')}`);
  } else {
    let msg = text.slice(0, 300);
    try { const j = JSON.parse(text); msg = `${j?.error?.status || ''} ${j?.error?.message || ''}`.trim(); } catch {}
    console.log(`\nFAIL  ListModels — HTTP ${res.status}  ${msg.slice(0, 300)}`);
  }
} catch (e) {
  console.log(`\nERROR ListModels — ${e.message}`);
}

import { createHash } from 'node:crypto';
console.log(`\n.env key fingerprint: ${createHash('sha256').update(KEY).digest('hex').slice(0, 8)}  (length ${KEY.length})`);
console.log('Compare this against the "fp:" value in the app error / /api/diag/gemini.');
console.log('If they differ, the server is loading a DIFFERENT key than .env.');
