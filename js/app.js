/* =====================================================================
   app.js — bootstrap: init IndexedDB, Settings, I18N, Navigation,
   global App object, and the hash router (#/route/id?key=val).
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

window.App = {
  booting:true,
  init:async function(){
    await DB.init();
    await Settings.load();
    await this.migrateSchoolTypes();
    await this.migrateStudentStats();
    await this.migratePersonFields();
    U.setLang(Settings.get().language||'ps');
    /* cloud: connect Supabase + restore session (no-op in local mode) */
    let cloudReady=true;
    try{
      if(window.Cloud && Cloud.init()){
        const p=await Cloud.loadAccount();
        if(!p){ cloudReady=false; }      // no session → auth screen
        else{
          await Cloud.guardDistrict();        /* other district on this phone → wipe old data */
          if(window.Sync) await Sync.startup();   /* pull first … */
          /* … then make sure every account is a member of the district (علمي غړي) */
          if(window.ensureAccountMember) await ensureAccountMember(p);
        }
      }
    }catch(e){ console.warn('[app] cloud boot', e); }
    await Nav.init();
    /* wire memory fallback warning */
    if(DB.memory){
      const w=document.getElementById('memoryWarn');
      if(w) w.style.display='block';
    }
    /* PWA: register the service worker (secure contexts only — Netlify) */
    try{
      if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
        navigator.serviceWorker.register('sw.js').catch(()=>{});
      }
    }catch(e){}
    /* PWA: capture the install prompt (topbar button) */
    try{
      if(!window.__installEvt){
        window.addEventListener('beforeinstallprompt', (e)=>{
          e.preventDefault();
          window.__installEvt=e;
          if(window.Nav) Nav.installBtn();
        });
        window.addEventListener('appinstalled', ()=>{ window.__installEvt=null; });
      }
    }catch(e){}
    this.booting=false;
    if(!cloudReady){
      if(window.Auth) Auth.show();
      if(window.Cloud && Cloud.blocked && window.U) U.toast(U.t('districtInactive'),'error');
      return;
    }
    if(location.hash && location.hash.length>1){
      this.route();
    } else {
      location.hash='#/dashboard';
    }
  },

  /* one-time migration: old single school `type` (دولتي/خصوصي/ابتدایي/متوسطه/لیسه/نور)
     is split into the three separate fields: level / ownership / genderType */
  migrateSchoolTypes:async function(){
    /* idempotent: only schools still carrying the legacy `type` field are touched */
    try{
      const levels=Settings.schoolLevels();
      const owns=Settings.schoolOwnershipTypes();
      const schools=await DB.getAll('schools');
      for(const s of schools){
        if(s.type===undefined || s.type===null || s.type==='') continue;
        const raw=Utils.tv(s.type);
        const lv=levels.find(x=> x.ps===raw || x.fa===raw || (typeof s.type==='object' && (s.type.ps===x.ps||s.type.fa===x.fa)) );
        const ow=owns.find(x=> x.ps===raw || x.fa===raw || (typeof s.type==='object' && (s.type.ps===x.ps||s.type.fa===x.fa)) );
        if(lv && !s.level) s.level={ps:lv.ps, fa:lv.fa};
        if(ow && !s.ownership) s.ownership={ps:ow.ps, fa:ow.fa};
        delete s.type;
        await DB.put('schools', s);
      }
    }catch(e){ /* non-fatal: migration is best-effort */ }
  },

  /* idempotent: education 'eduHigh' → 'eduBaccalaureate'; teachers' old
     `tashkilPosition` → `tashkilCode` (renamed field) */
  migratePersonFields:async function(){
    try{
      for(const store of ['teachers','members','employees']){
        const rows=await DB.getAll(store);
        for(const r of rows){
          let ch=false;
          if(r.education==='eduHigh'){ r.education='eduBaccalaureate'; ch=true; }
          if(store==='members' && /^pos(Amir|TeachingOfficer|ExecutiveOfficer)$/.test(r.position||'')){
            r.position={posAmir:'آمر',posTeachingOfficer:'تدریسي مامور',posExecutiveOfficer:'اجرائیه مامور'}[r.position]; ch=true;
          }
          if(store==='teachers' && r.tashkilPosition!==undefined){
            if(r.tashkilPosition && !r.tashkilCode) r.tashkilCode=r.tashkilPosition;
            delete r.tashkilPosition; ch=true;
          }
          if(ch) await DB.put(store,r);
        }
      }
    }catch(e){ /* best effort */ }
  },

  /* idempotent: legacy student stats rows {gender:'boys'|'girls', studentCount}
     → one row per class {genderMode, maleCount, femaleCount} */
  migrateStudentStats:async function(){
    try{
      const rows=await DB.getAll('studentStats');
      for(const r of rows){
        if(r.genderMode && r.studentCount===undefined && r.gender===undefined) continue; /* new shape */
        const n=Number(r.studentCount||0);
        const mode=(r.genderMode|| (r.gender==='girls'?'girls':'boys'));
        const rec={
          id:r.id, schoolId:r.schoolId, academicYear:r.academicYear,
          className:r.className, genderMode:mode,
          maleCount: mode==='girls' ? 0 : (r.maleCount!==undefined?Number(r.maleCount||0):n),
          femaleCount: mode==='boys' ? 0 : (r.femaleCount!==undefined?Number(r.femaleCount||0):n),
          notes:r.notes||''
        };
        if(r.createdAt) rec.createdAt=r.createdAt;
        delete rec.gender; delete rec.studentCount;
        await DB.put('studentStats', rec);
      }
    }catch(e){ /* non-fatal */ }
  },

  route:async function(){
    const raw=(location.hash||'#/dashboard').replace(/^#\/?/,'');
    const [pathPart,queryPart]=raw.split('?');
    const params={};
    if(queryPart) queryPart.split('&').forEach(kv=>{
      const [k,v]=kv.split('=');
      if(k) params[decodeURIComponent(k)]=decodeURIComponent(v||'');
    });
    const segs=pathPart.split('/').filter(Boolean);
    const key=segs[0]||'dashboard';
    const id=segs[1]||'';
    const def=Nav.ROUTES[key];
    const view=document.getElementById('view');
    /* the super admin only has the super dashboard + settings (never district data) */
    if(window.Cloud && Cloud.isSuper() && key!=='dashboard' && key!=='settings'){
      location.hash='#/dashboard';
      return;
    }
    if(!def){
      Nav.setActive('dashboard');
      location.hash='#/dashboard';
      return;
    }
    /* a page change closes any dialog that was left open (modals never outlive their page) */
    const mroot=document.getElementById('modal-root'); if(mroot) mroot.innerHTML='';
    /* brief loading state */
    if(view) view.innerHTML='<div class="view-fade" style="padding:40px;text-align:center"><div class="spinner"></div></div>';
    try{
      await def.render(id, params);
      /* Jalali hints for date filters on list pages (modal forms get them in UI.modal) */
      try{ UI.attachJalaliHints(document.getElementById('view')); }catch(e2){}
    }catch(e){
      console.error('[route]',key,e);
      if(view) view.innerHTML='<div class="empty" style="padding:60px 20px"><div class="empty-icon">'+U.icon('alert')+'</div><h3>'+U.t('error')+'</h3><p class="muted">'+U.escapeHtml(String(e.message||e))+'</p><button class="btn btn-primary" onclick="location.hash=\'#/dashboard\'">'+U.t('navDashboard')+'</button></div>';
    }
    /* close mobile drawer */
    document.body.classList.remove('sidebar-open');
    if(view) view.scrollTop=0;
    const main=document.querySelector('.main');
    if(main) main.scrollTop=0;
  },

  refreshView:async function(){
    if(this.booting) return;
    await this.route();
  },

  refreshAll:async function(){
    /* re-apply language + brand then re-route */
    U.setLang(Settings.get().language||'ps');
    Nav.applyBrand();
    if(window.AppLang!==undefined){}
    this.route();
  }
};

/* settings page lives in settings.js (loaded before navigation.js) — register here */
register('settings', {render: (id)=>Settings.renderPage(id)});

window.addEventListener('hashchange', ()=>App.route());
window.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await App.init();
  }catch(e){
    console.error(e);
    const v=document.getElementById('view');
    if(v) v.innerHTML='<div class="empty" style="padding:60px 20px"><div class="empty-icon">'+U.icon('alert')+'</div><h3>'+U.t('error')+'</h3><p class="muted">'+U.escapeHtml(String(e.message||e))+'</p></div>';
  }
});

})();
