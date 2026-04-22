# Z-Health AI — Backlog

Last updated 2026-04-10.

## Recently shipped (2026-04-10)

- **Complete Supabase schema source of truth.** `db-schema.sql` now contains all 6 production tables (`conversations`, `messages`, `quick_actions`, `user_preferences`, `saved_reports`, `activity_log`) plus a new `error_logs` table. Idempotent and safe to re-run. **Action required: paste the new `error_logs` block into the Supabase SQL editor to create the table in production — see "Action items for you" below.**
- **README.md.** Full setup, project layout, auth model, error logging conventions, known limitations, deployment notes.
- **Silent error handling fixed.** All 9 fire-and-forget `.catch(() => {})` blocks across `Chat.tsx`, `Sidebar.tsx`, and `CommandPanel.tsx` now route through `logClientError`. Two intentionally left as no-ops: the logger's own recursion-guard catch and `reader.cancel()` cleanup.
- **Shared client logger module.** `src/lib/client-logger.ts` exposes `logClientError`, `logClientWarn`, `logClientInfo`. The duplicate inline copy in `Chat.tsx` was removed.
- **Server error logger persists to Supabase.** `src/lib/error-logger.ts` keeps the in-memory ring buffer for the live error panel and additionally writes every entry to the `error_logs` table. Recursion-guarded so a Supabase write failure can't loop. Degrades gracefully if the table is missing.
- **Keap email bug fix.** `keap.listEmails` now defaults to `order=sent_date, order_direction=DESCENDING, limit=200` instead of returning the oldest 50 records by ID. The system prompt in `getKeapContext()` now explicitly tells the model that the `/emails` endpoint does not include marketing broadcasts and to direct users to the Keap dashboard for full broadcast statistics rather than confidently reporting "no emails were sent."
- **Question marks now type into the chat input.** `useKeyboardShortcuts` was calling `e.preventDefault()` before invoking the handler, so even though the `shift+?` shortcut had its own input check, the keystroke was already swallowed. Fixed by moving the editable-target check into the hook itself: inside an input/textarea/contenteditable, only modifier-based shortcuts (Ctrl/Cmd combos) and Escape are allowed through.
- **GA4 staleness fix.** When `getTrafficOverview` failed (timeout, error, missing access token), the analytics context was empty but the model was still told it had GA4 access — leading to hallucinated traffic numbers. Now any failure path injects an explicit `GA4_DATA_UNAVAILABLE` marker telling the model to refuse numeric answers and ask the user to retry or check the dashboard.
- **Action input validation.** `src/lib/actions.ts` now has a `validateActionParams()` function and a manifest of required fields per action type, covering 38 of the 60 actions (every mutate, every lookup-by-id, every Keap/Thinkific create that takes specific required fields). Pure list/search reads are intentionally skipped because their underlying APIs default to "list everything." Validation runs at the top of `executeAction()` and returns a clean user-facing error like `Missing required parameter "title" for action "create_page".` instead of letting bad input hit WordPress/Keap/Thinkific and come back as a cryptic 400.

## Action items for you (manual, can't automate)

- **Run the `error_logs` SQL block in Supabase.** Open https://supabase.com/dashboard/project/fdbxfacfmhmgpbyxipqu/sql/new and paste the `create table if not exists error_logs (...)` block from `db-schema.sql` (and its three indexes). Until you do, the new server-side persistence will fail silently and only the in-memory ring buffer will work.
- **Rotate the Supabase service role key.** It was pasted into the chat history to set up `.env.local`. Reset it in Supabase dashboard → Project Settings → API → Reset service_role secret, and update both `.env.local` and your Vercel environment variables.

## P1 — Reliability and maintainability

### Chat.tsx is 1,496 lines
Still the highest-leverage refactor. State management, stream handling, action execution, job tracking, conversation persistence, and UI coordination all live in one component. Extract into hooks: `useStreamHandler`, `useConversationSync`, `useChatActions`, `useJobManager`. Goal is `Chat.tsx` under 300 lines, each hook under 200. Should be done as its own focused session because the surface area is large.

### Rate limiting on API routes
`/api/chat`, `/api/keap`, `/api/workflows` have no throttling. Add `@upstash/ratelimit` middleware. Per-user limits: chat 30/min, workflows 10/min, keap 30/min. Returns 429 with `Retry-After`. Requires Upstash credentials in env.

### Page snapshots for undo are in-memory only
`src/lib/actions.ts` captures snapshots before page edits, but they live in process memory and die with the Next.js server. Two parts: (1) persist snapshots to a new `page_snapshots` Supabase table; (2) build the UI for viewing and restoring them. Currently the feature is half-implemented — neither restore UI nor durable storage exists.

### Keap broadcast email visibility (follow-up to today's fix)
Today's fix tells the model not to lie about email data, but doesn't actually surface broadcast/campaign email activity. Real fix requires either the legacy XML-RPC `EmailService.search` API or building a campaign-based aggregation through `/campaigns` endpoints. Needs live API exploration before committing to an approach.

## P2 — UX polish

### Missing loading / empty / error states
Audit `Sidebar`, `CRMPanel`, `WorkflowPanel`, `ReportCard` for the loading / empty / error triple. Use consistent skeleton and empty-state components. Wrap each workspace panel in an ErrorBoundary with a retry button.

### Fire-and-forget preference saves now log on failure but still don't notify the user
Today's silent-catch fix routes failures to the error log, but the user still sees no feedback. Add an inline toast on failure and queue failed writes for retry on the next successful request.

### Accessibility pass
Run axe-core against the main views. Likely findings: missing `aria-label` on SVG icons, no focus management on action confirmation cards, chart visualizations without `role="img"`. Fix what it flags.

### Workflows feature is empty
`src/data/workflows.json` is `[]` — the workflow feature has no content. The Sidebar and CommandPanel both fetch from `/api/workflows` and get nothing. Either populate the JSON file with real workflows or hide the workflow UI until there's content. Currently it's a half-feature that ships an empty panel.

## P3 — Quality and process

### No tests
Zero test files. The streaming pipeline and action executor are the highest-risk code paths. Add Vitest + MSW. Start with integration tests for `/api/chat` SSE parsing and `src/lib/actions.ts` dispatch. Aim for 70% coverage on `lib/`.

### Dependency audit
`@anthropic-ai/sdk` is pinned at `^0.39.0` — likely outdated. Run `npm outdated`, review majors, upgrade what's safe and pin the AI SDK to the latest stable.

## Feature ideas (parked)

Captured so they don't get lost — none are blocking, none are prioritized:

- File handling in chat (drag-drop, image vision, PDF/CSV parsing, paste screenshots)
- Reporting engine for Analytics workspace (GA4 comparison periods, PDF/CSV export)
- Reporting engine for Keap CRM workspace (contacts, tags, revenue, pipeline)
- Mobile UX pass
- Dark mode polish
- Microsoft Clarity integration
- Content calendar
- Conversation export / share / pin / archive
