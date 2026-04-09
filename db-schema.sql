-- Quick Actions table
-- Run this migration against your Supabase database

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
