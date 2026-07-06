/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Daily job (Vercel Cron) — reads today's attendance and sends each linked parent
// a PRIVATE message about their own child's absence. No student data ever goes to
// a group. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token; a
// ?secret= query param is also accepted for browser testing).
//
// Self-contained on purpose: Vercel transpiles each /api file individually and
// does NOT bundle helpers from outside /api (ERR_MODULE_NOT_FOUND). Only real npm
// modules are imported here.

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, any> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

export const config = { maxDuration: 60 };

// Today's date (YYYY-MM-DD) in Cambodia time (ICT, UTC+7, no DST).
function todayICT(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(req: Req, res: Res) {
  // Vercel Cron sends the secret as a Bearer token; a ?secret= query param is also
  // accepted so the run can be triggered/tested from a browser.
  const secret = process.env.CRON_SECRET;
  const ok = !secret
    || req.headers['authorization'] === `Bearer ${secret}`
    || req.query?.secret === secret;
  if (!ok) { res.status(401).json({ error: 'unauthorized' }); return; }

  // Safety-net run: delegate to the shared, DEDUPED notify endpoint so the same
  // logic serves both the cron and the on-save trigger (each student → one msg/day).
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
    const r = await fetch(`${base}/api/telegram-notify?date=${todayICT()}`, { method: 'POST' });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e: any) {
    console.error('telegram-cron error', e?.message || e);
    res.status(500).json({ error: e?.message || 'failed' });
  }
}
