/* =====================================================================
   navigation.js — sidebar, breadcrumbs, back button, language switch,
   global search, sidebar toggle. Hash-based routing makes browser
   Back button work natively.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const NAV = [
  {group:'gOverview', items:[
    {key:'dashboard',  icon:'grid',        title:'navDashboard'},
  ]},
  {group:'gPeople', items:[
    {key:'members',    icon:'users',       title:'navMembers'},
    {key:'employees',  icon:'briefcase',   title:'navEmployees'},
    {key:'teachers',   icon:'gradcap',     title:'navTeachers'},
  ]},
  {group:'gInstitutions', items:[
    {key:'schools',    icon:'school',      title:'navSchools'},
    {key:'tashkil',    icon:'layers',      title:'navTashkil'},
    {key:'students',   icon:'chart',       title:'navStudents'},
  ]},
  {group:'gFollow', items:[
    {key:'observations', icon:'eye',       title:'navObservations'},
    {key:'monitoring',   icon:'clipboardCheck', title:'navMonitoring'},
    {key:'activities',   icon:'activity',  title:'navActivities'},
    {key:'profdev',      icon:'book',      title:'navProfDev'},
  ]},
  {group:'gPlanning', items:[
    {key:'annualplan', icon:'calendar',    title:'navAnnualPlan'},
    {key:'monthlyplan',icon:'calendarCheck',title:'navMonthlyPlan'},
    {key:'duties',     icon:'checkSquare', title:'navDuties'},
  ]},
  {group:'gSystem', items:[
    {key:'statistics', icon:'pie',         title:'navStatistics'},
    {key:'reports',    icon:'file',        title:'navReports'},
    {key:'backup',     icon:'database',    title:'navBackup'},
    {key:'settings',   icon:'settings',    title:'navSettings'},
  ]}
];

const ROUTES = {}; // key → {render, titleKey, icon}
function register(key, def){ ROUTES[key]=def; }

const Nav = {
  ROUTES,
  register,

  buildSidebar(){
    const nav=document.getElementById('sidebarNav');
    const isSuper = !!(window.Cloud && Cloud.profile && Cloud.profile.role==='super');
    let html='';
    NAV.forEach(g=>{
      const visible=g.items.filter(it=>!(it.superOnly && !isSuper) && !(isSuper && it.key!=='dashboard' && it.key!=='settings'));
      if(!visible.length) return;
      html+='<div class="nav-group-label">'+U.t(g.group)+'</div>';
      visible.forEach(it=>{
        html+='<div class="nav-item" data-route="'+it.key+'" role="button" tabindex="0">'+
          U.icon(it.icon)+'<span>'+U.t(it.title)+'</span></div>';
      });
    });
    nav.innerHTML=html;
    nav.querySelectorAll('.nav-item').forEach(el=>{
      el.addEventListener('click', ()=>Nav.go(el.dataset.route));
      el.addEventListener('keydown', e=>{ if(e.key==='Enter') Nav.go(el.dataset.route); });
    });
    Nav.applyBrand();
    Nav.accountChip();
  },

  /* PWA install button: shown when the browser fires beforeinstallprompt */
  installBtn(){
    const btn=document.getElementById('installBtn');
    if(!btn) return;
    if(window.__installEvt){
      btn.hidden=false;
      btn.innerHTML=U.icon('download');
      btn.title=U.t('installApp');
      btn.onclick=async ()=>{
        const evt=window.__installEvt;
        window.__installEvt=null;
        if(!evt) return;
        evt.prompt();
        let choice=null;
        try{ choice=await evt.userChoice; }catch(e){}
        btn.hidden=true;
        if(choice && choice.outcome==='accepted') U.toast(U.t('installDone'),'success');
      };
    } else {
      btn.hidden=true;
    }
  },

  /* header account section — ALWAYS visible:
       cloud + signed in  → avatar + name + role + logout
       cloud + signed out → sign-in button
       local mode         → "local mode" chip */
  accountChip(){
    const head=document.getElementById('headerAcct');
    if(!head) return;
    head.hidden=false;
    const cloudOn=window.Cloud && Cloud.configured();
    if(!cloudOn){
      head.innerHTML='<div class="acct-chip local"><span class="acct-dot" style="background:var(--warning)"></span>'+U.t('localModeChip')+'</div>';
      return;
    }
    const p=Cloud.enabled()?Cloud.profile:null;
    if(!p){
      head.innerHTML='<button type="button" class="btn btn-primary btn-sm acct-in" id="btnSignIn">'+U.icon('login')+' '+U.t('signIn')+'</button>';
      const btn=document.getElementById('btnSignIn');
      if(btn) btn.addEventListener('click', ()=>{ if(window.Auth) Auth.show(); });
      return;
    }
    head.innerHTML=
      '<div class="acct-chip">'+
        U.avatarHTML({fullName:p.full_name},30)+
        '<div class="acct-meta"><div class="acct-name">'+U.escapeHtml(p.full_name)+'</div>'+
        '<div class="acct-role">'+(Cloud.offline?U.t('offlineMode'):(p.role==='super'?U.t('superBadge'):U.t('memberBadge')))+'</div></div>'+
        (Cloud.offline
          ? '<button type="button" class="icon-btn sm acct-out" id="btnSignInOff" title="'+U.t('signIn')+'">'+U.icon('login')+'</button>'
          : '<button type="button" class="icon-btn sm acct-out" id="btnLogout" title="'+U.t('logout')+'">'+U.icon('logout')+'</button>')+
      '</div>';
    const inOff=document.getElementById('btnSignInOff');
    if(inOff) inOff.addEventListener('click', ()=>{ if(window.Auth) Auth.show({tab:'login', closable:true}); });
    const out=document.getElementById('btnLogout');
    if(out) out.addEventListener('click', async ()=>{
      const ok=await UI.confirm({title:U.t('logout'),msg:U.t('logoutMsg'),okLabel:U.t('logout'),danger:true,icon:'logout'});
      if(ok) Auth.logout();
    });
  },

  applyBrand(){
    const s=Settings.get();
    const logo=document.getElementById('brandLogo');
    logo.innerHTML = s.logo ? '<img src="'+s.logo+'" alt="logo">' : U.icon('bookClosed');
    document.getElementById('brandTitle').textContent = U.t('appName');
    const bits=[s.province, s.district].filter(Boolean);
    document.getElementById('brandSub').textContent = bits.length? bits.join(' — ') : U.t('appSub');
    document.getElementById('sidebarYear').innerHTML = U.icon('calendar')+' '+U.t('academicYear')+' — '+(s.academicYear||'');
    document.title = U.t('appFull') + (s.district? ' | '+s.district : '');
  },

  setActive(key){
    document.querySelectorAll('.nav-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.route===key);
    });
  },

  crumb(items){
    const el=document.getElementById('crumbs');
    el.innerHTML= items.map((c,i)=>{
      if(i<items.length-1 && c.route)
        return '<span class="crumb-link" data-route="'+c.route+'">'+U.escapeHtml(c.label)+'</span><span class="crumb-sep">‹</span>';
      return '<span class="crumb-cur">'+U.escapeHtml(c.label)+'</span>';
    }).join('');
    el.querySelectorAll('.crumb-link').forEach(l=>{
      l.addEventListener('click', ()=>Nav.go(l.dataset.route));
    });
  },

  go(route){
    if(location.hash === '#/'+route){ window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
    location.hash = '#/'+route;
  },

  goBack(){
    if(window.history.length>1) window.history.back();
    else Nav.go('dashboard');
  },

  async init(){
    // sidebar toggle
    const menuBtn=document.getElementById('btnMenu');
    const overlay=document.getElementById('sidebarOverlay');
    menuBtn.innerHTML=U.icon('menu');
    const backBtn=document.getElementById('btnBack');
    backBtn.innerHTML=U.icon('arrowRight');
    backBtn.title=U.t('back');
    menuBtn.addEventListener('click', ()=>document.body.classList.toggle('sidebar-open'));
    overlay.addEventListener('click', ()=>document.body.classList.remove('sidebar-open'));

    backBtn.addEventListener('click', ()=>Nav.goBack());

    // language switch
    const sw=document.getElementById('langSwitch');
    sw.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', async ()=>{
        if(window.AppLang===b.dataset.lang) return;
        await Settings.save({language:b.dataset.lang});
        U.setLang(b.dataset.lang);
        window.App.refreshAll();
      });
    });

    // global search
    this.initGlobalSearch();

    this.buildSidebar();
  },

  langButtons(){
    document.querySelectorAll('#langSwitch button').forEach(b=>{
      b.classList.toggle('on', b.dataset.lang===U.currentLang());
    });
  },

  initGlobalSearch(){
    const input=document.getElementById('globalSearch');
    const wrap=document.getElementById('globalSearchWrap');
    const res=document.getElementById('globalSearchResults');
    input.placeholder=U.t('searchPh');
    wrap.querySelector('.gs-icon').innerHTML=U.icon('search');

    let timer=null;
    input.addEventListener('input', U.debounce(async ()=>{
      const q=input.value.trim().toLowerCase();
      if(q.length<2){ res.hidden=true; res.innerHTML=''; return; }
      const [members,schools,teachers,employees]=await Promise.all([
        DB.getAll('members'),DB.getAll('schools'),DB.getAll('teachers'),DB.getAll('employees')
      ]);
      const hit=(arr,field)=>arr.filter(x=>String(x[field]||'').toLowerCase().includes(q)).slice(0,4);
      const groups=[];
      const m1=hit(members,'fullName'); if(m1.length) groups.push({label:U.t('navMembers'),icon:'users',route:'members',rows:m1.map(x=>({id:x.id,name:x.fullName,sub:x.position||''}))});
      const s1=hit(schools,'name'); if(s1.length) groups.push({label:U.t('navSchools'),icon:'school',route:'schools',rows:s1.map(x=>({id:x.id,name:x.name,sub:x.village||''}))});
      const t1=hit(teachers,'fullName'); if(t1.length) groups.push({label:U.t('navTeachers'),icon:'gradcap',route:'teachers',rows:t1.map(x=>({id:x.id,name:x.fullName,sub:x.subject||''}))});
      const e1=hit(employees,'fullName'); if(e1.length) groups.push({label:U.t('navEmployees'),icon:'briefcase',route:'employees',rows:e1.map(x=>({id:x.id,name:x.fullName,sub:x.position||''}))});
      let html='';
      groups.forEach(g=>{
        html+='<div class="gs-group-label">'+U.escapeHtml(g.label)+'</div>';
        g.rows.forEach(r=>{
          html+='<div class="gs-item" data-route="'+g.route+'" data-id="'+r.id+'">'+
            '<div class="gs-ico">'+U.icon(g.icon)+'</div>'+
            '<div><b>'+U.escapeHtml(r.name)+'</b><small>'+U.escapeHtml(r.sub)+'</small></div></div>';
        });
      });
      if(!html) html='<div style="padding:14px;color:var(--muted);font-size:13px;text-align:center">'+U.t('noResults')+'</div>';
      res.innerHTML=html;
      res.hidden=false;
      res.querySelectorAll('.gs-item').forEach(it=>{
        it.addEventListener('click', ()=>{
          res.hidden=true; input.value='';
          Nav.go(it.dataset.route+'/'+it.dataset.id);
        });
      });
    },220));
    document.addEventListener('click', e=>{ if(!wrap.contains(e.target)) res.hidden=true; });
    input.addEventListener('focus', ()=>{ if(input.value.trim().length>=2) input.dispatchEvent(new Event('input')); });
  }
};

window.Nav = Nav;
window.register = register;
})();
