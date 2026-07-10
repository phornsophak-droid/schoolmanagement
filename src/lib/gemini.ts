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

// The model, made configurable so it can be switched without a code change when
// Google changes free-tier quotas. gemini-2.5-flash's free tier is only ~20
// requests/day; the "-lite" model has a much higher free daily limit, so it's the
// default. Override via localStorage 'gemini_model' or env VITE_GEMINI_MODEL
// (e.g. 'gemini-2.0-flash', 'gemini-2.5-flash').
export const getGeminiModel = (): string => {
  let ls = '';
  try { ls = localStorage.getItem('gemini_model') || ''; } catch { /* ignore */ }
  return ls || (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-2.5-flash-lite';
};

let client: GoogleGenAI | null = null;
export const getClient = (): GoogleGenAI | null => {
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
};

// Ask Gemini to write the summary in Khmer from the supplied data digest. Throws
// if there is no key or the request fails — callers fall back to the computed text.
export async function generateSchoolSummaryAI(dataDigest: string, periodLabel: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error('Gemini API key not configured');

  const prompt = `អ្នកគឺជាជំនួយការអប់រំ និងជាអ្នកវិភាគទិន្នន័យសាលារៀន។ ខាងក្រោមនេះជាទិន្នន័យលទ្ធផលសិក្សារួមសាលា ${periodLabel} (ជា JSON)។
សូមសរសេរ​របាយការណ៍​វិភាគ​ជា​ភាសា​ខ្មែរ​ត្រឹមត្រូវ ខ្លី​ច្បាស់ និង​មាន​ប្រយោជន៍ ដោយ​បែងចែក​ជា ៦ ផ្នែក៖
១) លទ្ធផលសិក្សារួម (មធ្យមភាគ អត្រាជាប់ ថ្នាក់ឆ្នើម/ខ្សោយ)
២) ការវិភាគតាមមុខវិជ្ជា (មុខវិជ្ជាខ្លាំង និងខ្សោយ)
៣) ការវិភាគអវត្តមាន (បរិមាណ មូលហេតុ ថ្នាក់/សិស្ស)
៤) សិស្សដែលត្រូវការការគាំទ្រពីគ្រូ និងមាតាបិតា (ខ្សោយសិក្សា ឬអវត្តមានញឹកញាប់)
៥) បញ្ហាប្រឈម (ចំណុចសំខាន់ៗ ៣-៥)
៦) ចំណុចដែលគ្រូ និងសាលាត្រូវធ្វើបន្ទាប់ (បែងចែក «សម្រាប់គ្រូបង្រៀន» និង «សម្រាប់សាលា/គណៈគ្រប់គ្រង» ជាបញ្ជី អនុវត្តបាន)
កុំ​បង្កើត​លេខ ឬ​ឈ្មោះ​ថ្មី​ក្រៅ​ពី​ទិន្នន័យ។ កុំ​ប្រើ markdown headers ច្រើន​ពេក។

ទិន្នន័យ៖
${dataDigest}`;

  const res = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
  });
  const text = (res.text || '').trim();
  if (!text) throw new Error('Empty AI response');
  return text;
}
