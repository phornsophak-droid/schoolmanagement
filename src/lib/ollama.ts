/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Optional LOCAL AI via Ollama (free, private, no API key). Used by the worksheet
// generator when reachable; the app falls back to Gemini, then the offline math
// generator. Only works in a browser on a machine that can reach the Ollama host
// (default localhost) — so it serves the teacher running it locally, while other
// devices/phones use the Gemini free key.
//
// Config (any of these; localStorage wins so it can be set in-app without rebuild):
//   localStorage 'ollama_url'   / VITE_OLLAMA_URL    (default http://localhost:11434)
//   localStorage 'ollama_model' / VITE_OLLAMA_MODEL  (default 'gemma3')
//
// NOTE: Ollama must allow the web origin — run it with OLLAMA_ORIGINS="*"
// (or your site origin) so the browser fetch isn't blocked by CORS.

const lsGet = (k: string): string => {
  try { return localStorage.getItem(k) || ''; } catch { return ''; }
};

export const getOllamaUrl = (): string =>
  (lsGet('ollama_url') || (import.meta.env.VITE_OLLAMA_URL as string) || 'http://localhost:11434').replace(/\/+$/, '');

export const getOllamaModel = (): string =>
  lsGet('ollama_model') || (import.meta.env.VITE_OLLAMA_MODEL as string) || 'gemma3';

// Cache reachability for the session so we don't pay the probe timeout on every
// call (e.g. on phones where Ollama is never present). Reset on full reload.
let reachable: boolean | null = null;
export async function ollamaReachable(timeoutMs = 1500): Promise<boolean> {
  if (reachable !== null) return reachable;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${getOllamaUrl()}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    reachable = res.ok;
  } catch { reachable = false; }
  return reachable;
}

// Force the next reachability check (e.g. after the user edits the URL in-app).
export const resetOllamaReachable = () => { reachable = null; };

// Generate text from Ollama, asking for JSON output. Throws on failure.
export async function ollamaGenerateJSON(prompt: string, timeoutMs = 90000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${getOllamaUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getOllamaModel(), prompt, stream: false, format: 'json' }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = String(data.response ?? '').trim();
    if (!text) throw new Error('Ollama returned empty response');
    return text;
  } finally {
    clearTimeout(t);
  }
}
