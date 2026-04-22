-- Z-Health AI — Supabase schema
--
-- Source of truth for the public schema. Safe to re-run: every statement uses
-- `if not exists` so it will not clobber existing tables, columns, or indexes.
--
-- Generated 2026-04-10 by reverse-engineering the live Supabase project
-- (fdbxfacfmhmgpbyxipqu) via the PostgREST OpenAPI spec.
--
-- NOTE: This file does not manage RLS policies. The live project may have
-- additional row-level security rules applied via the dashboard. If you need
-- a fresh environment to behave identically, copy the policies from the
-- Supabase dashboard (Authentication → Policies) after running this script.

-- ============================================================================
-- conversations — chat conversation metadata, one row per chat thread
-- ============================================================================
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  user_email text,
  title text not null,
  workspace text not null,
  page_context_id integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_conversations_user_updated
  on conversations(user_id, updated_at desc);

-- ============================================================================
-- messages — individual chat messages, attached to a conversation
-- ============================================================================
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  files jsonb,
  pending_action jsonb,
  action_result jsonb,
  report_data jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_messages_conversation_created
  on messages(conversation_id, created_at);

-- ============================================================================
-- quick_actions — per-user, per-workspace pinned prompts in the sidebar
-- ============================================================================
create table if not exists quick_actions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  workspace text not null,
  label text not null,
  prompt text not null,
  sort_order integer default 0,
  is_default boolean default false,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_quick_actions_user_workspace
  on quick_actions(user_id, workspace);

-- ============================================================================
-- user_preferences — per-user UI/model preferences (one row per user)
-- ============================================================================
create table if not exists user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  user_email text,
  selected_model text,
  workspace text,
  theme text,
  sidebar_collapsed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_user_preferences_user_id
  on user_preferences(user_id);

-- ============================================================================
-- saved_reports — reports the user has explicitly saved from chat output
-- ============================================================================
create table if not exists saved_reports (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text not null,
  report_type text not null,
  report_data jsonb not null,
  workspace text,
  created_at timestamptz default now()
);

create index if not exists idx_saved_reports_user_created
  on saved_reports(user_id, created_at desc);

-- ============================================================================
-- activity_log — append-only audit trail of user actions across workspaces
-- ============================================================================
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  user_email text,
  action_type text not null,
  workspace text,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_activity_log_user_created
  on activity_log(user_id, created_at desc);

create index if not exists idx_activity_log_workspace_created
  on activity_log(workspace, created_at desc);

-- ============================================================================
-- error_logs — persistent error/warn/info entries from server and client
-- ============================================================================
-- The app's `src/lib/error-logger.ts` keeps an in-memory ring buffer (last 200
-- entries) for the live error panel. It also writes to this table so errors
-- survive serverless cold starts and can be queried historically.
create table if not exists error_logs (
  id uuid default gen_random_uuid() primary key,
  level text not null,
  source text not null,
  message text not null,
  details text,
  user_id text,
  user_email text,
  workspace text,
  created_at timestamptz default now()
);

create index if not exists idx_error_logs_created
  on error_logs(created_at desc);

create index if not exists idx_error_logs_level_created
  on error_logs(level, created_at desc);

create index if not exists idx_error_logs_user_created
  on error_logs(user_id, created_at desc);
