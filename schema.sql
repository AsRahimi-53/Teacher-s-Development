-- =====================================================================
--  schema.sql — Supabase schema for the Teachers' Professional
--  Development Management PWA.
--
--  Run this ONCE in Supabase → SQL Editor.
--
--  Tables:
--    provinces : registered provinces (registered by the super admin)
--    districts : registered districts (province + name + credit + limits)
--    profiles  : one row per account (email login via Supabase Auth)
--    revenue   : income collected per district (super admin only)
--    records   : ALL district app data (generic), scoped per district
--
--  Roles:
--    • super admin : the FIRST account is created with the SQL script in
--      README (section ۴) — it registers the province + district and
--      inserts the auth user + profile with role='super'. Afterwards it
--      signs in like any account. Any later account can also be
--      designated the same way (SQL Editor):
--        UPDATE public.profiles SET role='super'
--        WHERE email = 'super@example.com';
--      Only the super admin registers provinces/districts, records
--      revenue and sets district credit & restrictions.
--    • members : registration only offers provinces + districts that
--      the super admin has registered (never free text). Max 8 accounts
--      per district (enforced in complete_registration, server-side).
--
--  Row Level Security:
--    • users only ever see their own district's data
--    • a district's members see the district's account list (profiles)
--    • the super dashboard is visible to the super admin only
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) provinces
-- ---------------------------------------------------------------------
create table if not exists public.provinces (
  id         uuid primary key default gen_random_uuid(),
  name_ps    text not null,
  name_fa    text not null default '',
  created_at timestamptz not null default now(),
  unique (name_ps)
);

-- ---------------------------------------------------------------------
-- 2) districts
-- ---------------------------------------------------------------------
create table if not exists public.districts (
  id            uuid primary key default gen_random_uuid(),
  province_id   uuid not null references public.provinces(id) on delete cascade,
  name_ps       text not null,
  name_fa       text not null default '',
  credit_limit  numeric not null default 0,   -- اعتباري حد (افغانۍ)
  restrictions  text not null default '',      -- محدوديتونه
  created_at    timestamptz not null default now(),
  unique (province_id, name_ps)
);

-- activation + limits (super admin) — safe to re-run on an existing database
alter table public.provinces add column if not exists is_active boolean not null default true;
alter table public.districts add column if not exists is_active boolean not null default true;
alter table public.districts add column if not exists max_accounts integer not null default 8;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='districts_max_accounts_chk') then
    alter table public.districts add constraint districts_max_accounts_chk check (max_accounts between 1 and 500);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) profiles (one per auth user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  full_name   text not null,
  phone       text default '',
  district_id uuid not null references public.districts(id),
  role        text not null default 'member' check (role in ('member','super')),
  created_at  timestamptz not null default now()
);
create index if not exists profiles_district_idx on public.profiles (district_id);

-- ---------------------------------------------------------------------
-- 4) revenue — income collected from each district (super admin)
-- ---------------------------------------------------------------------
create table if not exists public.revenue (
  id            uuid primary key default gen_random_uuid(),
  district_id   uuid not null references public.districts(id) on delete cascade,
  amount        numeric not null default 0,
  collected_at  date not null,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists revenue_district_idx on public.revenue (district_id);

-- ---------------------------------------------------------------------
-- 5) records — all app data (generic payload, per district)
-- ---------------------------------------------------------------------
create table if not exists public.records (
  district_id uuid not null references public.districts(id) on delete cascade,
  store       text not null,
  key_id      text not null,
  payload     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  primary key (district_id, store, key_id)
);
create index if not exists records_district_updated_idx
  on public.records (district_id, updated_at);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.provinces enable row level security;
alter table public.districts enable row level security;
alter table public.profiles  enable row level security;
alter table public.revenue   enable row level security;
alter table public.records   enable row level security;

-- helpers -------------------------------------------------------------
create or replace function public.is_super()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super'
  );
$$;

create or replace function public.my_district()
returns uuid
language sql stable security definer set search_path = public
as $$
  select district_id from public.profiles where id = auth.uid();
$$;

-- true when the caller's district AND its province are active (deactivating a
-- district locks its data: RLS below stops all reads/writes of `records`)
create or replace function public.my_district_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select d.is_active and p.is_active
    from public.districts d join public.provinces p on p.id = d.province_id
    where d.id = (select district_id from public.profiles where id = auth.uid())
  ), false);
$$;

-- provinces / districts:
--   • visitors (anon, registration picker) see ACTIVE rows only
--   • signed-in users see all rows (so the app can tell the user that their
--     own district was deactivated)
--   • only the super admin writes
drop policy if exists "provinces_read" on public.provinces;
drop policy if exists "provinces_read_anon" on public.provinces;
create policy "provinces_read_anon" on public.provinces
  for select to anon using (is_active);
drop policy if exists "provinces_read_auth" on public.provinces;
create policy "provinces_read_auth" on public.provinces
  for select to authenticated using (true);

drop policy if exists "provinces_super_write" on public.provinces;
create policy "provinces_super_write" on public.provinces
  for all to authenticated
  using (public.is_super()) with check (public.is_super());

drop policy if exists "districts_read" on public.districts;
drop policy if exists "districts_read_anon" on public.districts;
create policy "districts_read_anon" on public.districts
  for select to anon
  using (is_active and exists (select 1 from public.provinces p where p.id = province_id and p.is_active));
drop policy if exists "districts_read_auth" on public.districts;
create policy "districts_read_auth" on public.districts
  for select to authenticated using (true);

drop policy if exists "districts_super_write" on public.districts;
create policy "districts_super_write" on public.districts
  for all to authenticated
  using (public.is_super()) with check (public.is_super());

-- profiles: self OR members of the same district (account list) -------
drop policy if exists "profiles_read_self_or_district" on public.profiles;
create policy "profiles_read_self_or_district" on public.profiles
  for select to authenticated
  using (id = auth.uid() OR district_id = public.my_district());

-- revenue: super admin only -------------------------------------------
drop policy if exists "revenue_super_only" on public.revenue;
create policy "revenue_super_only" on public.revenue
  for all to authenticated
  using (public.is_super()) with check (public.is_super());

-- records: full CRUD inside own district -------------------------------
drop policy if exists "records_own_district" on public.records;
create policy "records_own_district" on public.records
  for all to authenticated
  using (district_id = public.my_district() and public.my_district_active())
  with check (district_id = public.my_district() and public.my_district_active());

-- =====================================================================
-- RPC functions
-- =====================================================================

-- count accounts of the caller's own district (super admin: all)
create or replace function public.count_profiles()
returns table (c bigint)
language sql stable security definer set search_path = public
as $$
  select count(*) from public.profiles
  where public.is_super() or district_id = public.my_district();
$$;
revoke execute on function public.count_profiles() from public;
revoke execute on function public.count_profiles() from anon;
grant  execute on function public.count_profiles() to authenticated;

-- complete registration: province + district must ALREADY be registered AND
-- ACTIVE (super admin). The app only offers such values — never free text.
-- The limit is the district's own `max_accounts` (set by the super admin); the
-- p_max argument is kept for backward compatibility and is IGNORED, so a
-- modified client cannot raise it. Role is always 'member'.
-- NOTE: parameters without a default must come BEFORE parameters with one.
drop function if exists public.complete_registration(text,text,text,text,int);
drop function if exists public.complete_registration(text,text,text,text,integer);
create or replace function public.complete_registration(
  p_full_name   text,
  p_province_ps text,
  p_district_ps text,
  p_phone       text default '',
  p_max         int  default 8
)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_cnt      bigint;
  v_pid      uuid;
  v_pactive  boolean;
  v_did      uuid;
  v_dactive  boolean;
  v_max      integer;
  v_email    text;
  v_profile  public.profiles;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    select * into v_profile from public.profiles where id = auth.uid();
    return v_profile;                        -- already registered (idempotent)
  end if;
  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'FULLNAME_REQUIRED';
  end if;
  if p_province_ps is null or trim(p_province_ps) = ''
     or p_district_ps is null or trim(p_district_ps) = '' then
    raise exception 'PROVINCE_DISTRICT_REQUIRED';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');

  select id, is_active into v_pid, v_pactive from public.provinces where name_ps = p_province_ps;
  if v_pid is null then
    raise exception 'PROVINCE_NOT_REGISTERED';
  end if;
  if not v_pactive then
    raise exception 'PROVINCE_INACTIVE';
  end if;

  select id, is_active, max_accounts into v_did, v_dactive, v_max from public.districts
   where province_id = v_pid and name_ps = p_district_ps;
  if v_did is null then
    raise exception 'DISTRICT_NOT_REGISTERED';
  end if;
  if not v_dactive then
    raise exception 'DISTRICT_INACTIVE';
  end if;

  -- serialize concurrent registrations for the same district
  perform pg_advisory_xact_lock(hashtext(v_did::text));
  select count(*) into v_cnt from public.profiles where district_id = v_did and role = 'member';
  if v_cnt >= coalesce(v_max, 8) then
    raise exception 'DISTRICT_FULL (max %)', coalesce(v_max, 8);
  end if;

  insert into public.profiles (id, email, full_name, phone, district_id, role)
  values (auth.uid(), v_email, p_full_name, coalesce(p_phone,''), v_did, 'member')
  returning * into v_profile;

  return v_profile;
end;
$$;
revoke execute on function public.complete_registration(text,text,text,text,int) from public;
revoke execute on function public.complete_registration(text,text,text,text,int) from anon;
grant  execute on function public.complete_registration(text,text,text,text,int) to authenticated;

-- super admin: districts overview (with province + account counts + status)
drop function if exists public.district_overview();
create or replace function public.district_overview()
returns table (
  id uuid, province_id uuid,
  province_ps text, province_fa text, province_active boolean,
  name_ps text, name_fa text,
  credit_limit numeric, restrictions text,
  is_active boolean, max_accounts integer,
  accounts bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super() then
    return;
  end if;
  return query
    select d.id, d.province_id,
           p.name_ps, p.name_fa, p.is_active,
           d.name_ps, d.name_fa,
           d.credit_limit, d.restrictions,
           d.is_active, d.max_accounts,
           (select count(*) from public.profiles pr where pr.district_id = d.id and pr.role = 'member'),
           d.created_at
    from public.districts d
    join public.provinces p on p.id = d.province_id
    order by p.name_ps, d.name_ps;
end;
$$;
revoke execute on function public.district_overview() from public;
revoke execute on function public.district_overview() from anon;
grant  execute on function public.district_overview() to authenticated;

-- super admin: provinces overview (with district counts + status)
drop function if exists public.provinces_overview();
create or replace function public.provinces_overview()
returns table (
  id uuid, name_ps text, name_fa text, is_active boolean,
  districts bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super() then
    return;
  end if;
  return query
    select p.id, p.name_ps, p.name_fa, p.is_active,
           (select count(*) from public.districts d where d.province_id = p.id),
           p.created_at
    from public.provinces p
    order by p.name_ps;
end;
$$;
revoke execute on function public.provinces_overview() from public;
revoke execute on function public.provinces_overview() from anon;
grant  execute on function public.provinces_overview() to authenticated;

-- super admin: revenue overview (all districts)
create or replace function public.revenue_overview()
returns table (
  id uuid, district_id uuid,
  province_ps text, district_ps text,
  amount numeric, collected_at date, notes text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super() then
    return;
  end if;
  return query
    select r.id, r.district_id,
           p.name_ps, d.name_ps,
           r.amount, r.collected_at, r.notes, r.created_at
    from public.revenue r
    join public.districts d on d.id = r.district_id
    join public.provinces p on p.id = d.province_id
    order by r.collected_at desc, r.created_at desc;
end;
$$;
revoke execute on function public.revenue_overview() from public;
revoke execute on function public.revenue_overview() from anon;
grant  execute on function public.revenue_overview() to authenticated;


-- =====================================================================
-- 8) ACCOUNT LIMIT (hard, inside the database) + account clean-up
--    Safe to re-run.
-- =====================================================================

-- 8.1  A district can NEVER hold more member accounts than its `max_accounts`.
--      This trigger fires on EVERY insert (app, SQL editor, scripts) and also
--      when a profile is moved to another district / made a member, so the
--      limit cannot be bypassed by any client or by a race between two sign-ups.
create or replace function public.enforce_account_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_max integer;
  v_cnt bigint;
begin
  if new.role <> 'member' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.district_id = new.district_id and old.role = new.role then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.district_id::text));   -- serialize
  select coalesce(max_accounts, 8) into v_max from public.districts where id = new.district_id;
  select count(*) into v_cnt from public.profiles
   where district_id = new.district_id and role = 'member' and id <> new.id;
  if v_cnt >= coalesce(v_max, 8) then
    raise exception 'DISTRICT_FULL (max %)', coalesce(v_max, 8);
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_limit on public.profiles;
create trigger profiles_limit
  before insert or update of district_id, role on public.profiles
  for each row execute function public.enforce_account_limit();

-- 8.2  The super admin cannot lower a district's limit below the accounts it already has.
create or replace function public.guard_district_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.max_accounts < (select count(*) from public.profiles
                          where district_id = new.id and role = 'member') then
    raise exception 'MAX_BELOW_ACCOUNTS';
  end if;
  return new;
end;
$$;
drop trigger if exists districts_limit on public.districts;
create trigger districts_limit
  before update of max_accounts on public.districts
  for each row when (new.max_accounts is distinct from old.max_accounts)
  execute function public.guard_district_limit();

-- 8.3  When an account is deleted (Supabase → Authentication → Users → Delete),
--      its «علمي غړی» row in the app data is removed on EVERY device too.
--      (soft delete: devices that are offline pick it up on their next sync)
create or replace function public.profile_deleted_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.records
     set deleted = true, updated_at = now()
   where district_id = old.district_id
     and store = 'members'
     and deleted = false
     and payload ->> 'accountId' = old.id::text;
  return old;
end;
$$;
drop trigger if exists profiles_cleanup on public.profiles;
create trigger profiles_cleanup
  after delete on public.profiles
  for each row execute function public.profile_deleted_cleanup();

-- 8.4  One-time clean-up of what is already there: account-members whose account
--      no longer exists are removed (runs again harmlessly on every re-run).
update public.records r
   set deleted = true, updated_at = now()
 where r.store = 'members'
   and r.deleted = false
   and (r.payload ->> 'accountId') is not null
   and not exists (select 1 from public.profiles p where p.id::text = r.payload ->> 'accountId');

-- 8.5  The caller's district account ids (the app uses it to drop members whose
--      account was deleted and to remove duplicates).
create or replace function public.district_account_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where district_id = public.my_district();
$$;
revoke execute on function public.district_account_ids() from public;
revoke execute on function public.district_account_ids() from anon;
grant  execute on function public.district_account_ids() to authenticated;

-- 8.6  Free places per ACTIVE district (shown on the sign-up screen; counts only).
create or replace function public.district_slots()
returns table (district_id uuid, accounts bigint, max_accounts integer)
language sql stable security definer set search_path = public
as $$
  select d.id,
         (select count(*) from public.profiles p where p.district_id = d.id and p.role = 'member'),
         d.max_accounts
  from public.districts d
  join public.provinces pr on pr.id = d.province_id
  where d.is_active and pr.is_active;
$$;
revoke execute on function public.district_slots() from public;
grant  execute on function public.district_slots() to anon, authenticated;

-- 8.7  Stop a sign-up for a FULL / inactive district BEFORE the auth user is
--      created (otherwise the Auth list fills with accounts that have no profile).
--      Users created by the admin script (no district in the metadata) are not affected.
create or replace function public.check_signup_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_did    uuid;
  v_active boolean;
  v_max    integer;
  v_cnt    bigint;
begin
  if coalesce(new.raw_user_meta_data ->> 'district_ps', '') = '' then
    return new;
  end if;
  select d.id, (d.is_active and p.is_active), d.max_accounts
    into v_did, v_active, v_max
    from public.districts d
    join public.provinces p on p.id = d.province_id
   where p.name_ps = new.raw_user_meta_data ->> 'province_ps'
     and d.name_ps = new.raw_user_meta_data ->> 'district_ps';
  if v_did is null then
    raise exception 'DISTRICT_NOT_REGISTERED';
  end if;
  if not v_active then
    raise exception 'DISTRICT_INACTIVE';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_did::text));
  select count(*) into v_cnt from public.profiles where district_id = v_did and role = 'member';
  if v_cnt >= coalesce(v_max, 8) then
    raise exception 'DISTRICT_FULL (max %)', coalesce(v_max, 8);
  end if;
  return new;
end;
$$;
drop trigger if exists auth_signup_limit on auth.users;
create trigger auth_signup_limit
  before insert on auth.users
  for each row execute function public.check_signup_capacity();
