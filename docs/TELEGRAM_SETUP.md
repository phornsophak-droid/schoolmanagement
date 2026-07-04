# Telegram parent notifications — Phase 1 setup

Private daily absence messages to each parent, plus parent→child linking via the
bot. Free (Telegram Bot API + Vercel Hobby cron + existing Supabase).

**Privacy:** each parent only ever receives their **own** child's info in a private
chat. No student data is posted to any group. The `telegram_links` table (parents'
chat_ids) is readable only by the server (service_role), never by the browser.

## 1. Create the bot
1. In Telegram, open **@BotFather** → send `/newbot` → follow prompts.
2. Copy the **bot token** it gives you (looks like `123456:ABC-DEF...`).

## 2. Create the database table
In Supabase → **SQL Editor**, run the contents of [`db/telegram_links.sql`](../db/telegram_links.sql).

## 3. Get the Supabase service-role key
Supabase → **Project Settings → API** → copy the **`service_role`** secret (NOT the
anon key) and the **Project URL**.

## 4. Set environment variables in Vercel
Vercel → your project → **Settings → Environment Variables**. Add (Production):

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from step 1 |
| `TELEGRAM_WEBHOOK_SECRET` | any random string you invent (e.g. `ccc-hook-9f3a`) |
| `CRON_SECRET` | any random string you invent (e.g. `ccc-cron-71b2`) |
| `SUPABASE_URL` | the Project URL from step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 3 |

Redeploy after saving (push to `main`, or Vercel → Deployments → Redeploy).

## 5. Point Telegram at the webhook
Replace the placeholders and run this once (any terminal):

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR-VERCEL-DOMAIN>/api/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Expect `{"ok":true,"result":true,...}`. (Check anytime with `.../getWebhookInfo`.)

## 6. Parents link their child
Each parent opens the bot → **Start** → sends their child's **name** or **អត្តលេខ**.
The bot confirms the link. If the name matches several classes, it asks them to
reply `ឈ្មោះ | ថ្នាក់`. Commands: `/list` (see links), `/unlink` (remove all).

## 7. Daily send
`vercel.json` runs `/api/telegram-cron` at **01:30 UTC = 08:30 Cambodia** daily. It
reads that day's attendance and privately messages the parents of absent students.

Test it manually anytime:
```bash
curl "https://<YOUR-VERCEL-DOMAIN>/api/telegram-cron" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
Returns e.g. `{"date":"2026-07-05","absent":3,"recipients":4,"sent":4}`.

## Notes / next phases
- Change the send time: edit the cron `schedule` in `vercel.json` (UTC). Vercel
  Hobby allows one run per day; multiple times/day needs Vercel Pro.
- **Phase 2:** private grade reports + a group-announcement composer in the app.
- **Phase 3:** the bot answers parents' questions (webhook + Gemini).
