-- =========================================================================================
-- Stories Table for AI Sherlock SaaS
-- =========================================================================================

create table if not exists public.stories (
  id text primary key,
  title text not null,
  is_free boolean default false,
  config jsonb not null,
  display jsonb not null,
  evidence jsonb not null,
  embeddings jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stories enable row level security;

-- No public read policy. Stories should be served through app routes or server-side queries
-- so that config/evidence/embeddings are not exposed directly to clients.

-- Only admins should be able to insert/update/delete. For now, we'll allow service_role or specific user check.
-- Assuming admin has a specific role or metadata in auth.users (TBD)
-- Simplified for MVP/Demo: only service_role (backend) can write, or we add an admin user check.
create policy "Only service_role can modify stories" on public.stories
  for all using (false) with check (false); -- Default deny, requires service_role
