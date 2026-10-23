/* =====================================================================
   mobile.js — phone / "installed app" behaviour:
     • bottom navigation bar (5 main places + "more" → drawer)
     • search icon that expands over the top bar
     • tables → cards (adds data-label to every cell)
     • hides the bottom bar while the keyboard is open
     • back button only on detail pages
   Loaded after all modules, before app.js. Pure progressive enhancement:
   on desktop nothing visible changes (CSS hides the bar).
   ===================================================================== */
(function(){
'use strict';
const U = window.Utils;

const BAR = [
  {key:'dashboard',    icon:'grid',    title:'navDashboard'},
  {key:'teachers',     icon:'gradcap', title:'navTeachers'},
  {key:'observations', icon:'eye',     title:'navObservations'},
  {key:'reports',      icon:'file',    title:'navReports'}
];

const Mobile = {
  routeKey(){
    const raw=(location.hash||'#/dashboard').replace(/^#\/?/,'').split('?')[0];
    const segs=raw.split('/').filter(Boolean);
    return {key:segs[0]||'dashboard', depth:segs.length};
  },

  /* ---------- bottom navigation ---------- */
  buildBottomNav(){
    const nav=document.getElementById('bottomNav');
    if(!nav || !U) return;
    /* the super admin only has the super dashboard + settings */
    const isSuper=!!(window.Cloud && Cloud.isSuper && Cloud.isSuper());
    const items=isSuper ? [BAR[0],{key:'settings',icon:'settings',title:'navSettings'}] : BAR;
    nav.innerHTML = items.map(it=>
      '<button type="button" class="bn-item" data-route="'+it.key+'">'+U.icon(it.icon)+'<span>'+U.escapeHtml(U.t(it.title))+'</span></button>'
    ).join('') +
      '<button type="button" class="bn-item" data-more="1">'+U.icon('menu')+'<span>'+U.escapeHtml(U.t('more'))+'</span></button>';
    nav.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{
      document.body.classList.remove('sidebar-open');
      if(window.Nav) Nav.go(b.dataset.route);
    }));
    nav.querySelector('[data-more]').addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));
    this.syncState();
  },

  syncState(){
    const {key,depth}=this.routeKey();
    document.body.classList.toggle('at-root', depth<=1);
    const nav=document.getElementById('bottomNav');
    if(!nav) return;
    let any=false;
    nav.querySelectorAll('[data-route]').forEach(b=>{
      const on=b.dataset.route===key; if(on) any=true;
      b.classList.toggle('active',on);
    });
    const more=nav.querySelector('[data-more]');
    if(more) more.classList.toggle('active',!any);       // other pages live under "more"
  },

  /* ---------- search icon → full-width search ---------- */
  initSearch(){
    const wrap=document.getElementById('globalSearchWrap');
    if(!wrap) return;
    const icon=wrap.querySelector('.gs-icon');
    const input=document.getElementById('globalSearch');
    const res=document.getElementById('globalSearchResults');
    const small=()=>window.matchMedia('(max-width:640px)').matches;
    const close=()=>{ wrap.classList.remove('gs-open'); if(res) res.hidden=true; };
    icon.addEventListener('click',()=>{
      if(!small()) return;
      const open=wrap.classList.toggle('gs-open');
      if(open) setTimeout(()=>input.focus(),30); else { input.value=''; close(); }
    });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    document.addEventListener('click',e=>{
      if(small() && wrap.classList.contains('gs-open') && !wrap.contains(e.target)) close();
    });
    window.addEventListener('hashchange',close);
  },

  /* ---------- tables → cards ---------- */
  decorateTables(root){
    const scope=root||document;
    scope.querySelectorAll('.table-wrap table.data:not(.type-table):not(.qual-table)').forEach(tb=>{
      const heads=Array.from(tb.querySelectorAll('thead th')).map(th=>th.textContent.trim());
      if(!heads.length) return;
      tb.classList.add('m-cards');
      tb.querySelectorAll('tbody tr').forEach(tr=>{
        Array.from(tr.children).forEach((td,i)=>{
          if(td.tagName!=='TD') return;
          const lab=heads[i]||'';
          if(td.getAttribute('data-label')!==lab) td.setAttribute('data-label',lab);
        });
      });
    });
  },
  watchTables(){
    let queued=false;
    const run=()=>{ queued=false; try{ Mobile.decorateTables(); }catch(e){} };
    const mo=new MutationObserver(()=>{ if(!queued){ queued=true; requestAnimationFrame(run); } });
    mo.observe(document.body,{childList:true,subtree:true});
    run();
  },

  /* ---------- keyboard: hide the bar so it never covers the field ---------- */
  watchKeyboard(){
    const isField=el=>el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|file)$/.test(el.type||'');
    document.addEventListener('focusin',e=>{ if(isField(e.target)) document.body.classList.add('kbd-open'); });
    document.addEventListener('focusout',()=>{
      setTimeout(()=>{ if(!isField(document.activeElement)) document.body.classList.remove('kbd-open'); },120);
    });
  },

  init(){
    this.buildBottomNav();
    this.initSearch();
    this.watchKeyboard();
    this.watchTables();
    window.addEventListener('hashchange',()=>this.syncState());
    /* language switch / brand refresh also relabels the bar */
    if(window.Nav && Nav.applyBrand){
      const orig=Nav.applyBrand;
      Nav.applyBrand=function(){ const r=orig.apply(this,arguments); try{ Mobile.buildBottomNav(); }catch(e){} return r; };
    }
  }
};

window.Mobile=Mobile;
window.addEventListener('DOMContentLoaded',()=>{ try{ Mobile.init(); }catch(e){ console.warn('[mobile]',e); } });
})();
