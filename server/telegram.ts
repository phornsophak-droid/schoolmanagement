/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Thin wrapper over the Telegram Bot API. Runs only in Vercel serverless
// functions (server-side) — the bot token is a server env var and never reaches
// the browser bundle. See docs/TELEGRAM_SETUP.md.

const apiUrl = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

export async function tgCall(method: string, body: Record<string, unknown>): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(apiUrl(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  return data.result;
}

// Send a private/group message. HTML formatting; a failed send (e.g. the parent
// blocked the bot) is caught by the caller so one bad chat_id doesn't abort the run.
export const sendMessage = (chatId: string | number, text: string) =>
  tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
