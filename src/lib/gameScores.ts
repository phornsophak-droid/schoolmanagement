/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Top-Scorer leaderboards for the Learning Games. Each game keeps a short list of
// high scores (name + score), stored as one small JSON in the generic
// school_settings KV (cloud-synced) and mirrored to localStorage — the same
// pattern as [[project-announcements]] and [[project-timetable]]. Because it is
// shared across devices, every pupil in the school sees (and competes for) the
// same top scores.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

export interface ScoreEntry {
  name: string;
  score: number;
  at: number; // epoch ms — tie-breaker (earlier wins) and "this is mine" marker
}
export type Leaderboard = ScoreEntry[]; // sorted best-first, capped at TOP_N

const TOP_N = 10;
const MAX_NAME = 24;
const keyFor = (game: string) => `game_scores_${game}`;

const sortCap = (list: Leaderboard): Leaderboard =>
  [...list].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, TOP_N);

// Synchronous read of the locally-cached board (may be empty before hydrate).
export function loadScores(game: string): Leaderboard {
  const v = kvReadSync<Leaderboard>(keyFor(game), []);
  return Array.isArray(v) ? v : [];
}

// Pull the shared board from the cloud so every device matches.
export async function refreshScoresFromCloud(game: string): Promise<Leaderboard> {
  const key = keyFor(game);
  await kvHydrate(key);
  try {
    const v = await fetchSetting(key);
    if (Array.isArray(v)) { await kvWrite(key, v); return sortCap(v as Leaderboard); }
  } catch { /* offline — keep local */ }
  return sortCap(loadScores(game));
}

// Add a result and persist. Merges with the latest cloud copy first to avoid one
// device clobbering another's scores. Returns the new (sorted, capped) board.
export async function submitScore(game: string, name: string, score: number): Promise<{ board: Leaderboard; entry: ScoreEntry }> {
  const key = keyFor(game);
  let board = loadScores(game);
  try { const v = await fetchSetting(key); if (Array.isArray(v)) board = v as Leaderboard; } catch { /* offline */ }
  const clean = (name || '').trim().slice(0, MAX_NAME) || 'សិស្ស';
  const entry: ScoreEntry = { name: clean, score, at: Date.now() };
  board = sortCap([...board, entry]);
  await kvWrite(key, board);
  try { await syncUpsertSetting(key, board); } catch { /* offline — saved locally */ }
  return { board, entry };
}
