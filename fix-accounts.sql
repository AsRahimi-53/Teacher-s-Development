-- =====================================================================
--  fix-accounts.sql — د اکاونټونو کتنه او پاکول (په SQL Editor کې، د Super Admin لخوا)
--  دا فایل خپله هیڅ نه ړنګوي؛ لومړی کتنې دي، وروسته ستاسو د پریکړې پر بنسټ ړنګول.
-- =====================================================================

-- ۱) هره ولسوالۍ: حد او اوسني اکاونټونه (باید اوسني ≤ حد وي)
select pr.name_ps as ولایت, d.name_ps as ولسوالۍ, d.max_accounts as حد,
       count(p.id) filter (where p.role = 'member') as اوسني_اکاونټونه,
       case when count(p.id) filter (where p.role = 'member') > d.max_accounts then 'زیات!' else 'سم' end as حالت
from public.districts d
join public.provinces pr on pr.id = d.province_id
left join public.profiles p on p.district_id = d.id
group by pr.name_ps, d.name_ps, d.max_accounts
order by حالت desc, pr.name_ps, d.name_ps;

-- ۲) د یوې ولسوالۍ ټول اکاونټونه (د جوړېدو په ترتیب) — ولسوالۍ نوم دلته ولیکئ
select p.id, p.email, p.full_name, p.role, p.created_at
from public.profiles p
join public.districts d on d.id = p.district_id
where d.name_ps = 'چهاربران'          -- ← د ولسوالۍ نوم
order by p.created_at;

-- ۳) ړنګول: Supabase → Authentication → Users → د ناغوښتل شوي کاربر Delete.
--    پروفایل او د هغه «علمي غړی» په ټولو وسیلو کې پخپله لرې کېږي (trigger).

-- ۴) هغه Auth کاربران چې پروفایل نلري (د ډک شوې ولسوالۍ له امله ثبت نیمګړی پاتې شوی)
select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at;
