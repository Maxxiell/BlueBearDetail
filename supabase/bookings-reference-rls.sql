-- Run in Supabase SQL Editor after bookings-schema.sql
-- 1) Human-readable reference on each booking (shown in email + UI)
-- 2) Let signed-in customers read their own rows; admin email sees all

alter table public.bookings
  add column if not exists reference_code text;

create unique index if not exists idx_bookings_reference_code_unique
  on public.bookings (reference_code)
  where reference_code is not null;

comment on column public.bookings.reference_code is '8-char public reference (e.g. booking confirmation); unique when set.';

-- Authenticated: own bookings (linked user_id OR same email as account) OR admin staff email
drop policy if exists "bookings_select_authenticated" on public.bookings;
create policy "bookings_select_authenticated"
  on public.bookings for select to authenticated
  using (
    (auth.jwt() ->> 'email') ilike 'deleteddata@outlook.com'
    or user_id = auth.uid()
    or lower(trim(cust_email)) = lower(trim(coalesce((auth.jwt() ->> 'email'), '')))
  );
