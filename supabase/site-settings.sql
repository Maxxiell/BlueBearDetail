-- Public site copy + pricing (admin panel → all visitors via anon read).
-- Run in Supabase SQL Editor after enabling extensions if needed.

create table if not exists public.site_settings (
  id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.site_settings (id, settings)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Anyone can read published settings (pricing on services.html, hero copy, etc.)
drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings for select
  to anon, authenticated
  using (true);

-- Only staff admin email can publish changes (matches admin.js / bookings RLS)
drop policy if exists "site_settings_insert_admin" on public.site_settings;
create policy "site_settings_insert_admin"
  on public.site_settings for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') ilike 'deleteddata@outlook.com');

drop policy if exists "site_settings_update_admin" on public.site_settings;
create policy "site_settings_update_admin"
  on public.site_settings for update
  to authenticated
  using ((auth.jwt() ->> 'email') ilike 'deleteddata@outlook.com')
  with check ((auth.jwt() ->> 'email') ilike 'deleteddata@outlook.com');

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

comment on table public.site_settings is 'Site-wide JSON (pricing, promo, pageEdits) synced from admin panel; public read.';
