# Z-Health AI

AI-powered management dashboard for Z-Health Education. Provides a chat interface that talks to Claude / Gemini and can take real actions across the WordPress site, Keap CRM, Thinkific LMS, and Google Analytics 4.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **NextAuth** for Google OAuth (domain-restricted to `@zhealth.net` by default)
- **Supabase** (Postgres) for conversations, messages, preferences, activity log, saved reports, error logs
- **Anthropic** + **Gemini** for the AI side
- Integrations: WordPress REST API, WooCommerce, Keap (Infusionsoft) v1 REST, Thinkific REST, Google Analytics Data API

## Prerequisites

- Node.js 18 or newer
- A Supabase project (free tier is fine)
- A Google Cloud OAuth client (see `GOOGLE-AUTH-SETUP.md`)
- API keys for whichever integrations you want to enable (Claude, Gemini, Keap, Thinkific, WordPress, GA4)

## First-time setup

1. **Install dependencies.**
   ```sh
   cd zhealth-ai
   npm install
   ```

2. **Create your env file.**
   ```sh
   cp .env.local.example .env.local
   ```
   Then fill in real values. Every variable in `.env.local.example` is required for the app to fully function — missing keys will cause specific features to fail at runtime rather than at build. The non-obvious ones:
   - `SUPABASE_SERVICE_ROLE_KEY` — service role, not anon. Found in Supabase dashboard → Project Settings → API.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` — set to `http://localhost:3000` for dev, your deployed URL in production.
   - `ALLOWED_EMAIL_DOMAIN` — only users with this email domain can sign in. Defaults to `zhealth.net`.

3. **Apply the database schema.**
   Open the Supabase SQL editor for your project and paste the contents of `db-schema.sql`. It is idempotent — every statement uses `if not exists`, so it is safe to re-run on an existing database. The tables it manages: `conversations`, `messages`, `quick_actions`, `user_preferences`, `saved_reports`, `activity_log`, `error_logs`.

4. **Set up Google OAuth.**
   Follow `GOOGLE-AUTH-SETUP.md` end-to-end. The OAuth consent screen needs the `analytics.readonly` scope or GA4 reads will fail.

5. **Run the dev server.**
   ```sh
   npm run dev
   ```
   The app expects to live at `http://localhost:3000` during development. Sign in with a `@zhealth.net` Google account.

## Available scripts

| Command         | Purpose                                  |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start Next.js in development mode        |
| `npm run build` | Production build                         |
| `npm start`     | Serve the production build               |

## Project layout

```
zhealth-ai/
├── db-schema.sql            # Source of truth for the Supabase public schema
├── src/
│   ├── app/                 # Next.js App Router routes
│   │   ├── api/             # API route handlers (chat, conversations, keap, ...)
│   │   ├── login/           # NextAuth sign-in page
│   │   └── page.tsx         # Main app entry
│   ├── components/          # React components (Chat, Sidebar, WorkflowPanel, ...)
│   ├── lib/                 # Integrations and helpers
│   │   ├── supabase.ts      # Server-side Supabase client (service role)
│   │   ├── db.ts            # Typed query helpers for the public schema
│   │   ├── error-logger.ts  # In-memory ring buffer + Supabase persistence
│   │   ├── client-logger.ts # Client-side wrapper that POSTs to /api/logs
│   │   ├── actions.ts       # Action dispatcher (WordPress / Keap / Thinkific / GA4)
│   │   ├── keap.ts          # Keap REST v1 client
│   │   ├── google-analytics.ts
│   │   └── ...
│   └── data/
│       └── workflows.json   # Pre-built workflow definitions (currently empty)
└── BACKLOG.md               # Active backlog
```

## How auth works

`src/middleware.ts` wraps every non-public route with `next-auth`'s `withAuth`. Unauthenticated requests are redirected to `/login`. The `signIn` callback in `src/lib/auth.ts` rejects any email that doesn't end in `@${ALLOWED_EMAIL_DOMAIN}`. The Google OAuth client requests the `analytics.readonly` scope so the resulting access token can be used directly against the GA4 Data API on the server.

## How errors are logged

Both client and server errors flow into a single store with two layers:

- **In-memory ring buffer** (`src/lib/error-logger.ts`) keeps the last 200 entries for the live error panel in the UI. Resets on serverless cold start.
- **Supabase `error_logs` table** persists every entry historically. Writes are fire-and-forget with a recursion guard so a logging failure can never crash the app or trigger more logging.

Client code should call `logClientError(source, message, details)` from `@/lib/client-logger` instead of swallowing errors with `.catch(() => {})`. Server code should call `logError(source, message, details)` from `@/lib/error-logger`.

## Known limitations

- **Keap broadcast emails are not exposed via REST.** The `/emails` endpoint only returns mailbox-synced or one-off logged emails, not marketing campaign sends. The system prompt in `src/lib/keap.ts` tells the model not to confidently report email volume from this data alone.
- **Page snapshots for undo are in-memory.** Snapshots taken before edit actions in `src/lib/actions.ts` live in process memory and die with the Next.js server. Persisting them is on the backlog.
- **No tests.** Adding Vitest is on the backlog.

## Deployment

The app is designed to run on Vercel. Set every variable from `.env.local.example` in the Vercel project's Environment Variables tab. Make sure `NEXTAUTH_URL` matches your deployed domain and that the OAuth client in Google Cloud has the deployed callback URL listed.
