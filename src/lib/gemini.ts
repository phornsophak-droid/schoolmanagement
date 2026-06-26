/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

// Optional AI wording for the school summary. The key comes from a Vite env var
// (VITE_GEMINI_API_KEY) — a FREE Google AI Studio key works. If it isn't set,
// hasGemini() is false and the app uses the locally-computed summary instead, so
// the feature still works fully offline.
const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

export const hasGemini = (): boolean => !!apiKey;

let client: GoogleGenAI | null = null;
const getClient = (): GoogleGenAI | null => {
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
};

// Ask Gemini to write the summary in Khmer from the supplied data digest. Throws
// if there is no key or the request fails — callers fall back to the computed text.
export async function generateSchoolSummaryAI(dataDigest: string, periodLabel: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error('Gemini API key not configured');

  const prompt = `អ្នកគឺជាជំនួយការអប់រំ។ ខាងក្រោមនេះជាទិន្នន័យលទ្ធផលសិក្សារួមសាលា ${periodLabel} (ជា JSON)។
សូមសរសេរ​ជា​ភាសា​ខ្មែរ​ត្រឹមត្រូវ និង​ខ្លី​ៗ ដោយ​មាន​៣​ផ្នែក៖
១) សេចក្ដី​សង្ខេប​លទ្ធផល (២-៣ ប្រយោគ)
២) ចំណុច​ខ្លាំង និង​ចំណុច​ខ្សោយ
៣) ចំណុច​គួរ​កែលម្អ​សម្រាប់​ដំណាក់កាល​បន្ទាប់ (ជា​បញ្ជី​ៗ ៣-៥ ចំណុច ដែល​អនុវត្ត​បាន)
កុំ​បង្កើត​លេខ​ថ្មី​ក្រៅ​ពី​ទិន្នន័យ។ កុំ​ប្រើ markdown headers ច្រើន​ពេក។

ទិន្នន័យ៖
${dataDigest}`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = (res.text || '').trim();
  if (!text) throw new Error('Empty AI response');
  return text;
}
