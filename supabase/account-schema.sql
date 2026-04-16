-- Blue Bear Detail: account/settings schema for account.html + settings.html
-- Run this in Supabase SQL Editor.

-- 1) Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 2) Profile/settings table (settings.html form + avatar)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text default '',
  last_name text default '',
  phone text default '',
  default_service_address text default '',
  avatar_url text default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 3) Dashboard summary table (top stat cards in account.html)
create table if not exists public.account_dashboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wash_credit_balance numeric(10,2) not null default 0,
  reward_points integer not null default 0,
  wash_pass_tier text default '',
  wash_pass_renews_on date,
  last_service_title text default '',
  last_service_meta text default '',
  next_appointment_label text default '',
  next_appointment_meta text default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists account_dashboard_set_updated_at on public.account_dashboard;
create trigger account_dashboard_set_updated_at
before update on public.account_dashboard
for each row execute function public.set_updated_at();

-- 4) Vehicles on file card (count + list)
create table if not exists public.account_vehicles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer,
  make text not null default '',
  model text not null default '',
  nickname text default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_account_vehicles_user_id on public.account_vehicles(user_id);

-- 5) Recent activity list block
create table if not exists public.account_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  detail text default '',
  amount_label text default '',
  happened_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_account_activity_user_id on public.account_activity(user_id);
create index if not exists idx_account_activity_sort on public.account_activity(user_id, sort_order, happened_on desc);

-- 6) Enable RLS
alter table public.profiles enable row level security;
alter table public.account_dashboard enable row level security;
alter table public.account_vehicles enable row level security;
alter table public.account_activity enable row level security;

-- 7) Policies: each signed-in user can only access their own rows
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "account_dashboard_select_own" on public.account_dashboard;
create policy "account_dashboard_select_own" on public.account_dashboard
for select using (auth.uid() = user_id);

drop policy if exists "account_dashboard_insert_own" on public.account_dashboard;
create policy "account_dashboard_insert_own" on public.account_dashboard
for insert with check (auth.uid() = user_id);

drop policy if exists "account_dashboard_update_own" on public.account_dashboard;
create policy "account_dashboard_update_own" on public.account_dashboard
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "account_vehicles_select_own" on public.account_vehicles;
create policy "account_vehicles_select_own" on public.account_vehicles
for select using (auth.uid() = user_id);

drop policy if exists "account_vehicles_insert_own" on public.account_vehicles;
create policy "account_vehicles_insert_own" on public.account_vehicles
for insert with check (auth.uid() = user_id);

drop policy if exists "account_vehicles_update_own" on public.account_vehicles;
create policy "account_vehicles_update_own" on public.account_vehicles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "account_vehicles_delete_own" on public.account_vehicles;
create policy "account_vehicles_delete_own" on public.account_vehicles
for delete using (auth.uid() = user_id);

drop policy if exists "account_activity_select_own" on public.account_activity;
create policy "account_activity_select_own" on public.account_activity
for select using (auth.uid() = user_id);

drop policy if exists "account_activity_insert_own" on public.account_activity;
create policy "account_activity_insert_own" on public.account_activity
for insert with check (auth.uid() = user_id);

drop policy if exists "account_activity_update_own" on public.account_activity;
create policy "account_activity_update_own" on public.account_activity
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "account_activity_delete_own" on public.account_activity;
create policy "account_activity_delete_own" on public.account_activity
for delete using (auth.uid() = user_id);

-- 8) Auto-create profile/dashboard shell row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.account_dashboard (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
