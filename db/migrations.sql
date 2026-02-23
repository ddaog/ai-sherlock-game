-- =========================================================================================
-- Initial Schema for AI Sherlock SaaS
-- Tables: profiles, subscriptions, story_progress, credits_daily, hints_usage, special_access
-- =========================================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  email text,
  locale text default 'en',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

-- Profile Trigger for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, locale)
  values (new.id, new.email, 'en');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call handle_new_user when an auth.user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Subscriptions Table
-- Managed by the server (webhook/checkout)
create table if not exists public.subscriptions (
  user_id uuid references public.profiles(user_id) on delete cascade primary key,
  plan text not null default 'free', -- 'free', 'lestrade', 'watson', 'sherlock'
  status text not null default 'active',
  current_period_end timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);
-- No insert/update policies for normal users. Only service_role can write.

-- Subscription Trigger to update `updated_at`
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger on_subscriptions_updated
  before update on public.subscriptions
  for each row execute procedure public.set_current_timestamp_updated_at();


-- 3. Story Progress
create table if not exists public.story_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  story_id text not null,
  completed_at timestamp with time zone,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, story_id)
);
alter table public.story_progress enable row level security;
create policy "Users can view own progress" on public.story_progress for select using (auth.uid() = user_id);
create policy "Users can insert own progress" on public.story_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.story_progress for update using (auth.uid() = user_id);


-- 4. Credits (Daily usage tracking)
create table if not exists public.credits_daily (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  date date not null default current_date,
  remaining integer not null default 0,
  unique(user_id, date)
);
alter table public.credits_daily enable row level security;
create policy "Users can view own credits" on public.credits_daily for select using (auth.uid() = user_id);
-- Updates and inserts ideally handled by RPC or Server. We'll allow users to read only.
-- Service_role manages decrements to prevent client-side bypassing.


-- 5. Hints Usage
create table if not exists public.hints_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  story_id text not null,
  used_count integer not null default 0,
  unique(user_id, story_id)
);
alter table public.hints_usage enable row level security;
create policy "Users can view own hints" on public.hints_usage for select using (auth.uid() = user_id);


-- 6. Special Access (For Sherlock Plan)
create table if not exists public.special_access (
  user_id uuid references public.profiles(user_id) on delete cascade primary key,
  flag text not null default 'special_story_unlocked',
  granted_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.special_access enable row level security;
create policy "Users can view own special access" on public.special_access for select using (auth.uid() = user_id);
-- Service role only writes.
