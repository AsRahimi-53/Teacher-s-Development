-- =====================================================================
--  first-admin.sql — لومړی حساب (عمومي مدیر) جوړول
--  -------------------------------------------------------------------
--  ګامونه:
--   ۱. schema.sql مخکې یو ځل RUN شوی وي
--   ۲. لاندې اسکرېپټ په Supabase → SQL Editor کې RUN کړئ —
--      یوازې د وروستیو `select public.setup_first_admin(...)` ګام کې
--      خپل ارزښتونه (برېښنالیک، پټنوم، نوم، ولایت، ولسوالۍ) ولیکئ
--   ۳. اپلیکېشن ته ولاړ شئ او د دې حساب په واسطه ننوتل وکړئ
--
--  دا اسکرېپټ: ولایت + ولسوالۍ ثبت کوي، د اوطور (Supabase Auth)
--  کاربر جوړوي، او profile يې د role='super' سره ثبت کوي.
--  د دې وروسته نور ټول حسابونه د اپلیکېشن له لارې راکتل کېږي —
--  ولایت/ولسوالۍ يې یوازې له ثبت شویو لیستونو څخه ټاکي.
-- =====================================================================

create or replace function public.setup_first_admin(
  p_email     text,
  p_password  text,
  p_full_name text,
  p_province  text,
  p_district  text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pid uuid;
  v_did uuid;
  v_uid uuid;
begin
  -- 1) ولایت
  insert into public.provinces (name_ps, name_fa)
  values (p_province, p_province)
  on conflict (name_ps) do update set name_fa = excluded.name_fa;
  select id into v_pid from public.provinces where name_ps = p_province;

  -- 2) ولسوالۍ (د هغه ولایت لاندې)
  insert into public.districts (province_id, name_ps, name_fa)
  values (v_pid, p_district, p_district)
  on conflict (province_id, name_ps) do nothing;
  select id into v_did from public.districts
   where province_id = v_pid and name_ps = p_district;

  -- 3) د Auth کاربر (برېښنالیک + پټنوم، سمدستي تایید)
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'EMAIL_ALREADY_EXISTS';
  end if;
  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', ''          -- NULL tokens break sign-in on some Supabase versions
  );
  -- the e-mail identity (needed for e-mail + password sign-in)
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- 4) عمومي مدیر (role='super')
  insert into public.profiles (id, email, full_name, phone, district_id, role)
  values (v_uid, p_email, p_full_name, '', v_did, 'super');
end;
$$;

/* د امنیت لپاره: دا فنکشن یوازې له SQL Editor څخه کارېدلی شي */
revoke execute on function public.setup_first_admin(text,text,text,text,text) from public;
revoke execute on function public.setup_first_admin(text,text,text,text,text) from anon;
revoke execute on function public.setup_first_admin(text,text,text,text,text) from authenticated;

-- ═══════════════════════════════════════════════════════════════
-- ▼▼▼  دلته خپل ارزښتونه ولیکئ (بیا ټول اسکرېپټ RUN کړئ)  ▼▼▼
-- ═══════════════════════════════════════════════════════════════
select public.setup_first_admin(
  'super@example.com',  -- ← خپل برېښنالیک
  'password123',        -- ← خپل پټنوم (ډېر قوي يې وگڼئ)
  'سید احمد موسی',      -- ← خپل نوم
  'کابل',               -- ← ولایت
  'شیرپور'              -- ← ولسوالۍ
);
