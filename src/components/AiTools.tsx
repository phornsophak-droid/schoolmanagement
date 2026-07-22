/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ជំនួយការ AI — a directory of the AI assistants teachers use for lesson prep,
// worksheets and translation. Every entry just opens the tool's own site in a new
// tab: nothing is embedded and no school data passes through this screen, which
// also sidesteps the fact that none of these sites can be iframed.
//
// Marks are the tool's initial on its brand colour rather than a copy of its logo.

import React from 'react';
import { Sparkles, ExternalLink, X } from 'lucide-react';

interface Tool {
  name: string;
  mark: string;       // short initial shown in the tile
  color: string;      // brand-ish background for the mark
  url: string;
  km: string;         // what it is, in Khmer
}

const TOOLS: Tool[] = [
  { name: 'Claude',       mark: 'C',  color: '#D97757', url: 'https://claude.ai',              km: 'ជំនួយការសរសេរ និងវិភាគ' },
  { name: 'ChatGPT',      mark: 'G',  color: '#10A37F', url: 'https://chatgpt.com',            km: 'ឆ្លើយសំណួរ និងបង្កើតមេរៀន' },
  { name: 'Gemini',       mark: 'G',  color: '#4285F4', url: 'https://gemini.google.com',      km: 'ជំនួយការរបស់ Google' },
  { name: 'NotebookLM',   mark: 'N',  color: '#1A73E8', url: 'https://notebooklm.google.com',  km: 'សង្ខេបឯកសារ និងកត់ត្រា' },
  { name: 'Google AI Studio', mark: 'AI', color: '#8E44AD', url: 'https://aistudio.google.com', km: 'សាកល្បង និងបង្កើតកម្មវិធី AI' },
  { name: 'Antigravity',  mark: 'A',  color: '#0F9D58', url: 'https://antigravity.google',     km: 'សរសេរកូដជាមួយ AI' },
  { name: 'Copilot',      mark: 'Co', color: '#0078D4', url: 'https://copilot.microsoft.com',  km: 'ជំនួយការរបស់ Microsoft' },
  { name: 'DeepSeek',     mark: 'D',  color: '#4D6BFE', url: 'https://chat.deepseek.com',      km: 'ជំនួយការឆ្លើយសំណួរ' },
  { name: 'Grok',         mark: 'X',  color: '#111827', url: 'https://grok.com',               km: 'ជំនួយការរបស់ xAI' },
  { name: 'Perplexity',   mark: 'P',  color: '#20808D', url: 'https://www.perplexity.ai',      km: 'ស្វែងរក និងដកស្រង់ប្រភព' },
];

// Tools that build the slides themselves — type the lesson topic and they lay out
// a deck, which is the slow part of preparing a lesson.
const SLIDE_TOOLS: Tool[] = [
  { name: 'Gamma',              mark: 'Gm', color: '#7C3AED', url: 'https://gamma.app',                 km: 'បង្កើតស្លាយពីប្រធានបទ' },
  { name: 'Canva',              mark: 'Cv', color: '#00C4CC', url: 'https://www.canva.com',             km: 'រចនាស្លាយ និងសម្ភារបង្រៀន' },
  { name: 'Microsoft Designer', mark: 'Ds', color: '#0F6CBD', url: 'https://designer.microsoft.com',    km: 'រចនាស្លាយ និងរូបភាព' },
  { name: 'Beautiful.ai',       mark: 'Ba', color: '#111827', url: 'https://www.beautiful.ai',          km: 'ស្លាយរៀបចំទ្រង់ទ្រាយស្វ័យប្រវត្តិ' },
  { name: 'SlidesAI',           mark: 'Sl', color: '#F59E0B', url: 'https://www.slidesai.io',           km: 'បង្កើតស្លាយក្នុង Google Slides' },
  { name: 'Napkin AI',          mark: 'Np', color: '#EC4899', url: 'https://www.napkin.ai',             km: 'បម្លែងអត្ថបទជារូបភាពពន្យល់' },
];

function Section({ title, tools }: { title: string; tools: Tool[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-400 px-1">{title}</p>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(t => (
          <a
            key={t.name}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 shadow-sm p-3 flex items-center gap-3 transition-all no-underline"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold shrink-0 text-[13px]"
              style={{ background: t.color }}
            >
              {t.mark}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-700 truncate">{t.name}</p>
              <p className="text-[11px] text-slate-400 font-semibold truncate">{t.km}</p>
            </div>
            <ExternalLink size={13} className="text-slate-300 group-hover:text-violet-500 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

interface Props {
  onClose?: () => void;
}

export default function AiTools({ onClose }: Props) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-500" />
          <div>
            <h2 className="text-sm font-bold text-slate-700">ជំនួយការ AI</h2>
            <p className="text-[11px] text-slate-400 font-semibold">ចុចដើម្បីបើកក្នុងផ្ទាំងថ្មី</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"
          >
            <X size={13} /> បិទ
          </button>
        )}
      </div>

      <Section title="ជំនួយការទូទៅ" tools={TOOLS} />
      <Section title="បង្កើតបទបង្ហាញ និងស្លាយមេរៀន" tools={SLIDE_TOOLS} />

      <p className="text-[11px] text-slate-400 font-semibold text-center px-3 pb-1">
        គេហទំព័រទាំងនេះជារបស់ក្រុមហ៊ុនខាងក្រៅ។ សូមកុំបញ្ចូលព័ត៌មានផ្ទាល់ខ្លួនរបស់សិស្ស។
      </p>
    </div>
  );
}
