/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { FolderOpen, ExternalLink, Save, RefreshCw, Pencil, X } from 'lucide-react';
import { SchoolUser } from '../types';
import { fetchSetting, syncUpsertSetting } from '../lib/supabase';

// Document Bank — a shared library of ALL school documents (lessons, workbooks,
// references…). To avoid any storage/egress cost, the files live in a Google Drive
// folder and the app just EMBEDS that folder (read-only grid) + links to it. The
// folder id is stored as a cloud setting so every device sees the same library;
// the principal can change it. The Drive folder must be shared "anyone with the
// link" for the embedded view to render.

const SETTING_KEY = 'docbank_folder_id';
const LS_KEY = 'docbank_folder_id';
// Default = the folder the school provided.
const DEFAULT_FOLDER_ID = '1bxDY-ax4WixWrg2nPRFu3fI51s-3C1R2';

// Accept a full Drive folder URL or a raw id and return just the id.
const extractFolderId = (input: string): string => {
  const s = (input || '').trim();
  const m = s.match(/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return (m ? m[1] : s).trim();
};

interface Props {
  currentUser?: SchoolUser | null;
  embedded?: boolean;
  onClose: () => void;
}

export default function DocBank({ currentUser, onClose }: Props) {
  const isPrincipal = currentUser?.role === 'principal';
  const [folderId, setFolderId] = useState<string>(() => {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_FOLDER_ID; } catch { return DEFAULT_FOLDER_ID; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [iframeKey, setIframeKey] = useState(0); // bump to force-reload the embed
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // Pull the shared folder id from the cloud so all devices match.
  useEffect(() => {
    fetchSetting(SETTING_KEY).then(v => {
      const id = extractFolderId(String(v || ''));
      if (id && id !== folderId) {
        setFolderId(id);
        try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
      }
    }).catch(() => { /* offline — use local/default */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
  const openUrl = `https://drive.google.com/drive/folders/${folderId}`;

  const saveFolder = async () => {
    const id = extractFolderId(draft);
    if (!id) { flash('សូមបញ្ចូលតំណ Google Drive ត្រឹមត្រូវ'); return; }
    setFolderId(id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
    setEditing(false);
    setIframeKey(k => k + 1);
    try { await syncUpsertSetting(SETTING_KEY, id); flash('បានរក្សាទុក និងធ្វើបច្ចុប្បន្នភាព (គ្រប់ឧបករណ៍) ✓'); }
    catch { flash('បានរក្សាទុកក្នុងម៉ាស៊ីន — ភ្ជាប់ Cloud បរាជ័យ'); }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <FolderOpen size={16} className="text-amber-500" /> បណ្ណាល័យឯកសារ (Document Bank)
        </h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setIframeKey(k => k + 1)} title="ផ្ទុកឡើងវិញ" className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1.5">
            <RefreshCw size={13} /> ផ្ទុកឡើងវិញ
          </button>
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm">
            <ExternalLink size={13} /> បើកក្នុង Google Drive
          </a>
          {isPrincipal && (
            <button onClick={() => { setDraft(openUrl); setEditing(e => !e); }} className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm">
              <Pencil size={13} /> ប្តូរថត
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5">
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {toast && <div className="text-center text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">{toast}</div>}

      {/* Principal: change the Drive folder link */}
      {isPrincipal && editing && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">តំណ Google Drive Folder</span>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none"
            />
          </label>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] text-slate-400 leading-snug">បិទភ្ជាប់តំណថត Google Drive។ ត្រូវ Share ថតនោះជា «Anyone with the link» ដើម្បីបង្ហាញក្នុង app បាន។</p>
            <button onClick={saveFolder} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 flex items-center gap-1.5">
              <Save size={13} /> រក្សាទុក
            </button>
          </div>
        </div>
      )}

      {/* Embedded Drive folder */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <iframe
          key={iframeKey}
          title="Document Bank"
          src={embedUrl}
          className="w-full"
          style={{ height: '70vh', border: 0 }}
        />
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        បើឯកសារមិនបង្ហាញ — សូមប្រាកដថាថត Google Drive ត្រូវបាន Share ជា «Anyone with the link», ឬចុច «បើកក្នុង Google Drive»។
      </p>
    </div>
  );
}
