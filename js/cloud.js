/* =====================================================================
   cloud.js — Supabase connection, auth session, account + district
   helpers. Two modes:
     • local : no config → pure IndexedDB, no account
     • cloud : Supabase enabled — accounts sign in; every write is
               mirrored to the district's Supabase project (sync.js)

   Model:
     provinces → districts (credit_limit + restrictions) → profiles
     revenue (per district, super admin) + records (district app data)

   Roles:
     • super admin — created as a normal account, then designated in
       Supabase (UPDATE profiles SET role='super' WHERE email=...).
       Registers provinces/districts, revenue, credit & restrictions.
     • members — pick a registered province + district (max 8 accounts
       per district, enforced in the complete_registration RPC).
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const CFG = window.APP_CONFIG || {};

/* PostgREST returns a many-to-one embed as an OBJECT, a one-to-many embed as an
   ARRAY — accept both so account/district loading never silently yields null */
function one(x){ return Array.isArray(x) ? (x[0]||null) : (x||null); }
const CACHE_KEY='tdp_account_cache';
const LAST_DISTRICT_KEY='tdp_last_district';
const HAS_ACCOUNT_KEY='tdp_has_account';      // this device has completed an account at least once

const Cloud = {
  cfg: CFG,
  client: null,
  profile: null,    // {id, email, full_name, phone, district_id, role}
  district: null,   // {id, name_ps, name_fa, province_id, province:{id,name_ps,name_fa}, credit_limit, restrictions}
  state: 'local',   // 'local' | 'cloud'
  online: (typeof navigator!=='undefined') ? navigator.onLine : true,
  offline: false,   // true while the app runs on the cached account without a session
  blocked: '',      // 'DISTRICT_INACTIVE' | 'PROVINCE_INACTIVE' when sign-in was refused

  configured(){ return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); },
  enabled(){ return !!(this.client && this.profile); },
  isSuper(){ return !!(this.profile && this.profile.role==='super'); },
  /* the limit is set per district by the super admin (the server enforces it) */
  maxAccounts(){ return Number((this.district && this.district.max_accounts) || CFG.maxAccountsPerDistrict) || 8; },

  /* localized names for the current UI language */
  provinceName(){
    if(!this.district || !this.district.province) return '';
    const p=this.district.province;
    return U.currentLang()==='fa' ? (p.name_fa||p.name_ps) : (p.name_ps||p.name_fa);
  },
  districtName(){
    if(!this.district) return '';
    return U.currentLang()==='fa' ? (this.district.name_fa||this.district.name_ps)
                                  : (this.district.name_ps||this.district.name_fa);
  },

  init(){
    if(!this.configured()) return false;
    if(typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function'){
      console.warn('[cloud] supabase lib missing — staying in local mode');
      return false;
    }
    try{
      this.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth:{ persistSession:true, autoRefreshToken:true, storageKey:'tdp_auth' }
      });
      this.state='cloud';
      if(typeof window.addEventListener==='function'){
        window.addEventListener('online', ()=>{ this.online=true; if(window.Sync) Sync.onNetChange(true); });
        window.addEventListener('offline', ()=>{ this.online=false; if(window.Sync) Sync.onNetChange(false); });
      }
      return true;
    }catch(e){
      console.warn('[cloud] init failed', e);
      this.state='local';
      return false;
    }
  },

  async session(){
    if(!this.client) return null;
    try{
      const {data} = await this.client.auth.getSession();
      return (data && data.session) ? data.session : null;
    }catch(e){ return null; }
  },

  /* load profile + district (with province) for the signed-in user */
  /* offline-first: the last successfully loaded account is cached so a phone
     that is offline at start-up (valid session, no network) still opens the app */
  _cacheAccount(){
    try{
      localStorage.setItem(CACHE_KEY, JSON.stringify({profile:this.profile, district:this.district}));
      localStorage.setItem(HAS_ACCOUNT_KEY,'1');
    }catch(e){}
  },
  /* has an account ever been created / signed in on THIS device? (first launch → no) */
  hasAccountOnDevice(){
    try{ return localStorage.getItem(HAS_ACCOUNT_KEY)==='1' && !!localStorage.getItem(CACHE_KEY); }catch(e){ return false; }
  },
  /* offline use: re-open the app with the cached account (no session, no network).
     The cached role is NEVER trusted → always a normal member (the super admin
     pages need the server anyway). */
  enterOffline(){
    try{
      const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(!c || !c.profile || !this.hasAccountOnDevice()) return null;
      this.profile=Object.assign({}, c.profile, {role:'member'});
      this.district=c.district||null;
      this.offline=true;
      return this.profile;
    }catch(e){ return null; }
  },
  _restoreCached(userId){
    try{
      const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(c && c.profile && c.profile.id===userId){
        this.profile=Object.assign({}, c.profile, {role:'member'});   // cached role is never trusted
        this.district=c.district||null; return this.profile;
      }
    }catch(e){}
    return null;
  },

  /* registration data typed on the sign-up form is stored in the auth user's
     metadata, so it can be completed after e-mail confirmation or after a
     failed first attempt (no more accounts stuck without a profile) */
  async _completeFromMetadata(user){
    const m=(user && user.user_metadata)||{};
    if(!m.province_ps || !m.district_ps || !m.full_name) return false;
    const {error} = await this.client.rpc('complete_registration', {
      p_full_name:m.full_name, p_province_ps:m.province_ps,
      p_district_ps:m.district_ps, p_phone:m.phone||'', p_max:this.maxAccounts()
    });
    return !error;
  },

  async loadAccount(){
    const sess = await this.session();
    if(!sess || !sess.user) return null;
    const q = () => this.client
      .from('profiles')
      .select('id, email, full_name, phone, district_id, role, created_at, districts(id, province_id, name_ps, name_fa, credit_limit, restrictions, is_active, max_accounts, provinces(id, name_ps, name_fa, is_active))')
      .eq('id', sess.user.id)
      .maybeSingle();
    let res;
    try{ res = await q(); }catch(e){ res = {error:e, data:null}; }
    if(res.error){
      /* network / server problem — NOT a missing profile: fall back to cache */
      return this._restoreCached(sess.user.id);
    }
    let data = res.data;
    if(!data){
      /* signed in but no profile row yet → finish the registration */
      if(await this._completeFromMetadata(sess.user)){
        try{ res = await q(); data = res.data; }catch(e){}
      }
      if(!data) return null;
    }
    this.profile = {
      id: data.id,
      email: data.email || sess.user.email || '',
      full_name: data.full_name || '',
      phone: data.phone || '',
      district_id: data.district_id,
      role: data.role || 'member'
    };
    const d=one(data.districts);
    const pv=d ? one(d.provinces) : null;
    this.district = d ? {
      id:d.id, province_id:d.province_id,
      name_ps:d.name_ps||'', name_fa:d.name_fa||'',
      is_active: d.is_active!==false, max_accounts: Number(d.max_accounts)||8,
      province: pv ? {id:pv.id, name_ps:pv.name_ps, name_fa:pv.name_fa, is_active:pv.is_active!==false} : null,
      credit_limit:Number(d.credit_limit||0),
      restrictions:d.restrictions||''
    } : null;
    /* settings: account district is authoritative */
    try{
      const s = Settings.get();
      const patch = {};
      if(this.district){
        if(this.district.province && (!s.province || s.province!==this.district.province.name_ps)){
          patch.province=this.district.province.name_ps;
        }
        if(!s.district || s.district!==this.district.name_ps) patch.district=this.district.name_ps;
      }
      if(Object.keys(patch).length) await Settings.save(patch);
    }catch(e){}
    /* a deactivated district / province is locked (the server blocks its data too) */
    this.blocked='';
    if(this.profile.role!=='super' && this.district){
      if(this.district.is_active===false) this.blocked='DISTRICT_INACTIVE';
      else if(this.district.province && this.district.province.is_active===false) this.blocked='PROVINCE_INACTIVE';
    }
    if(this.blocked){
      try{ await this.client.auth.signOut(); }catch(e){}
      this.profile=null; this.district=null;
      return null;
    }
    this.offline=false;
    this._cacheAccount();
    return this.profile;
  },

  /* a DIFFERENT district signing in on the same phone must never see (or
     upload!) the previous district's local data → wipe it first */
  async guardDistrict(){
    try{
      if(!this.district) return;
      const last=localStorage.getItem(LAST_DISTRICT_KEY);
      if(last && last!==this.district.id){
        await DB.wipeLocal();
        try{ U.toast(U.t('deviceReset'),'info'); }catch(e){}
      }
      localStorage.setItem(LAST_DISTRICT_KEY, this.district.id);
    }catch(e){ console.warn('[cloud] guardDistrict', e); }
  },

  /* ---- registration (province + district ALWAYS required) ----
     Only registered provinces/districts are offered (super admin).
     Exception: the very first account (nothing registered yet) may
     enter free text — its rows are created automatically. */
  async register({fullName, phone, email, password, province, district}){
    const missing=[];
    if(!fullName) missing.push(U.t('fullName'));
    if(!email) missing.push(U.t('email'));
    if(!password) missing.push(U.t('password'));
    if(!province) missing.push(U.t('province'));
    if(!district) missing.push(U.t('district'));
    if(missing.length) return {error:{message:'MISSING_FIELDS'}};
    /* the district must have a free place BEFORE the auth user is created */
    try{
      const opts=await this.districtOptions();
      const hit=opts.find(d=>d.name_ps===district && d.province && d.province.name_ps===province);
      if(!hit) return {error:{message:'DISTRICT_NOT_REGISTERED'}};
      if(hit.full) return {error:{message:'DISTRICT_FULL'}};
    }catch(e){}
    const {data, error} = await this.client.auth.signUp({
      email, password,
      options:{ data:{ full_name:fullName, phone:phone||'', province_ps:province, district_ps:district } }
    });
    if(error) return {error};
    if(!data || !data.session) return {needsConfirm:true};
    const profile = await this.finishRegistration(fullName, phone, province, district);
    if(profile.error) return profile;
    return {profile};
  },

  async finishRegistration(fullName, phone, province, district){
    const {data, error} = await this.client.rpc('complete_registration', {
      p_full_name: fullName, p_phone: phone||'',
      p_province_ps: province, p_district_ps: district,
      p_max: this.maxAccounts()     /* informational only — the server enforces its own limit */
    });
    if(error) return {error};
    await this.loadAccount();
    return {profile: this.profile};
  },

  async login(email, password){
    const {data, error} = await this.client.auth.signInWithPassword({email, password});
    if(error) return {error};
    const profile = await this.loadAccount();
    if(!profile){
      if(this.blocked) return {error:{message:this.blocked}};
      try{ await this.client.auth.signOut(); }catch(e){}
      return {error:{message:'PROFILE_MISSING'}};
    }
    return {profile};
  },

  async logout(){
    if(!this.client) return;
    try{ await this.client.auth.signOut(); }catch(e){}
    this.profile=null; this.district=null; this.offline=false;
  },

  /* ============ registration picker (registered only) ============ */
  async provincesList(){
    const {data, error} = await this.client.from('provinces').select('id, name_ps, name_fa').eq('is_active', true).order('name_ps');
    if(error) return [];
    return data||[];
  },
  async districtOptions(){
    const {data, error} = await this.client
      .from('districts')
      .select('id, province_id, name_ps, name_fa, is_active, provinces(id, name_ps, name_fa, is_active)')
      .eq('is_active', true)
      .order('name_ps');
    if(error) return [];
    const slots=await this.districtSlots();
    return (data||[]).map(d=>({
      id:d.id, province_id:d.province_id,
      name_ps:d.name_ps, name_fa:d.name_fa,
      province:one(d.provinces),
      accounts:slots[d.id]?slots[d.id].accounts:0,
      max:slots[d.id]?slots[d.id].max:null,
      full:!!(slots[d.id] && slots[d.id].accounts>=slots[d.id].max)
    })).filter(d=>!d.province || d.province.is_active!==false);
  },

  /* ============ super admin: provinces ============ */
  async addProvince(namePs, nameFa){
    const {data, error} = await this.client.from('provinces')
      .insert({name_ps:namePs, name_fa:nameFa||namePs}).select('id, name_ps, name_fa').single();
    if(error) return {error, data:null};
    return {data};
  },

  /* ============ super admin: districts ============ */
  async addDistrict(provinceId, namePs, nameFa){
    const {data, error} = await this.client.from('districts')
      .insert({province_id:provinceId, name_ps:namePs, name_fa:nameFa||namePs}).select('id, province_id, name_ps, name_fa').single();
    if(error) return {error, data:null};
    return {data};
  },
  /* ids of every account of MY district (used to drop members of deleted accounts);
     null when the call failed — never treat a failure as «no accounts» */
  async districtAccountIds(){
    try{
      const {data, error} = await this.client.rpc('district_account_ids');
      if(error || !Array.isArray(data)) return null;
      return data.map(x=>typeof x==='string'?x:(x && Object.values(x)[0])).filter(Boolean);
    }catch(e){ return null; }
  },
  /* {district_id: {accounts, max}} for ACTIVE districts (sign-up screen) */
  async districtSlots(){
    try{
      const {data, error} = await this.client.rpc('district_slots');
      if(error || !Array.isArray(data)) return {};
      const out={}; data.forEach(r=>{ out[r.district_id]={accounts:Number(r.accounts)||0, max:Number(r.max_accounts)||8}; });
      return out;
    }catch(e){ return {}; }
  },

  async updateProvince(id, patch){
    const upd={}; ['name_ps','name_fa','is_active'].forEach(k=>{ if(patch[k]!==undefined) upd[k]=patch[k]; });
    const {error} = await this.client.from('provinces').update(upd).eq('id', id);
    return error ? {error} : {ok:true};
  },
  async deleteProvince(id){
    const {error} = await this.client.from('provinces').delete().eq('id', id);
    return error ? {error} : {ok:true};
  },
  async updateDistrict(id, patch){
    const upd={};
    ['name_ps','name_fa','is_active','restrictions'].forEach(k=>{ if(patch[k]!==undefined) upd[k]=patch[k]; });
    if(patch.credit_limit!==undefined) upd.credit_limit=Number(patch.credit_limit||0);
    if(patch.max_accounts!==undefined) upd.max_accounts=Math.max(1,Math.min(500,Number(patch.max_accounts)||8));
    const {error} = await this.client.from('districts').update(upd).eq('id', id);
    return error ? {error} : {ok:true};
  },
  async deleteDistrict(id){
    const {error} = await this.client.from('districts').delete().eq('id', id);
    return error ? {error} : {ok:true};
  },
  async setDistrictCredit(districtId, creditLimit, restrictions){
    const {error} = await this.client.from('districts')
      .update({credit_limit:Number(creditLimit||0), restrictions:restrictions||''})
      .eq('id', districtId);
    if(error) return {error};
    return {ok:true};
  },
  async districtOverview(){
    const {data, error} = await this.client.rpc('district_overview');
    if(error) return {error, data:[]};
    return {data:data||[]};
  },
  async provincesOverview(){
    const {data, error} = await this.client.rpc('provinces_overview');
    if(error) return {error, data:[]};
    return {data:data||[]};
  },

  /* ============ super admin: revenue (عايد) ============ */
  async revenueOverview(){
    const {data, error} = await this.client.rpc('revenue_overview');
    if(error) return {error, data:[]};
    return {data:data||[]};
  },
  async revenueAdd({districtId, amount, collectedAt, notes}){
    const {data, error} = await this.client.from('revenue')
      .insert({district_id:districtId, amount:Number(amount||0), collected_at:collectedAt, notes:notes||''})
      .select('id, district_id, amount, collected_at, notes').single();
    if(error) return {error, data:null};
    return {data};
  },
  async revenueDel(id){
    const {error} = await this.client.from('revenue').delete().eq('id', id);
    if(error) return {error};
    return {ok:true};
  },

  /* ============ district members (own district account list) ============ */
  async districtMembers(){
    if(!this.district) return [];
    const {data, error} = await this.client
      .from('profiles')
      .select('id, email, full_name, phone, role, created_at')
      .eq('district_id', this.district.id)
      .order('created_at');
    if(error) return [];
    return data||[];
  },

  async countProfiles(){
    try{
      const {data} = await this.client.rpc('count_profiles');
      return (data && data.length) ? Number(data[0].c || data[0].count || 0) : 0;
    }catch(e){ return -1; }
  },

  rpc(name, params){ return this.client.rpc(name, params); }
};

window.Cloud = Cloud;
})();
