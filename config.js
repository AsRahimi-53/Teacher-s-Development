/* =====================================================================
   CONFIG.JS — د Supabase اړیکه (Supabase connection)
   ---------------------------------------------------------------------
   د آنلاین/کلاوډ حالت فعالولو لپاره:
   1. supabase.com باندې نوی پروژه جوړ کړئ
   2. په SQL Editor کې schema.sql یو ځل ترسره کړئ (run once)
   3. دلته خپل Url او anon key ولیکئ
   4. ویب پاڼه بیا راوباسئ (refresh)

   Local mode (no internet needed): leave both values empty —
   the app works entirely on the device (IndexedDB).
   ===================================================================== */
window.APP_CONFIG = {
  /* e.g. https://abcdefghijklmnop.supabase.co */
  supabaseUrl: 'https://qutmyumsjmtlkotwhbzv.supabase.co',
  /* the public anon key from Supabase → Settings → API */
  supabaseAnonKey: 'sb_publishable_3nRp0QFIOikJG1l2C6mcYQ_vKdSDqJE',
  /* maximum accounts per district (ولسوالۍ) */
  maxAccountsPerDistrict: 8
};
