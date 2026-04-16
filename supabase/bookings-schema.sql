-- Blue Bear Detail: booking requests from book-flow.html
-- Run in Supabase SQL Editor after account-schema.sql (optional; no dependency).

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'book_requested'
    check (status in ('book_requested', 'pay_pending', 'cancelled')),
  service_package text not null default '',
  vehicle_type text not null default '',
  addons jsonb not null default '[]'::jsonb,
  booking_date date not null,
  booking_time text not null default '',
  cust_first_name text not null default '',
  cust_last_name text not null default '',
  cust_email text not null default '',
  cust_phone text not null default '',
  cust_address text not null default '',
  veh_year integer,
  veh_make text not null default '',
  veh_model text not null default '',
  veh_make_custom text,
  veh_model_custom text,
  veh_color text,
  cust_notes text,
  checkout_method text not null default 'book',
  pay_inspection_ack boolean not null default false,
  summary_text text not null default '',
  reference_code text
);

create index if not exists idx_bookings_created_at on public.bookings (created_at desc);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_bookings_cust_email on public.bookings (cust_email);

alter table public.bookings enable row level security;

-- Guests and signed-in users can create booking requests (public form).
-- Logged-in users may only attach their own user_id (or leave it null).
drop policy if exists "bookings_insert_anon" on public.bookings;
drop policy if exists "bookings_insert_authenticated" on public.bookings;
drop policy if exists "bookings_insert_public" on public.bookings;

create policy "bookings_insert_public"
  on public.bookings for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Do not expose reads to the public anon key (staff uses Dashboard SQL or a future admin API).
-- Authenticated users could read own rows later; for now, no select policies for anon/authenticated.
--
-- Important: PostgREST INSERT ... RETURNING requires SELECT RLS to pass. With no SELECT for anon,
-- .insert().select() from the browser fails. The app generates the booking UUID client-side and
-- inserts without returning rows (see js/booking-submit-supabase.js).

comment on table public.bookings is 'Mobile detailing booking wizard submissions. Customer email confirmations are not sent by Postgres alone — use an Edge Function + Resend/SendGrid/etc., or Twilio, with secrets server-side only.';
