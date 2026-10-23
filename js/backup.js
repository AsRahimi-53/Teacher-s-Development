/* =====================================================================
   backup.js — full JSON backup / restore with validation,
   confirmation and integrity checks.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const STORE_LABELS={
  members:'navMembers', schools:'navSchools', employees:'navEmployees',
  teachers:'navTeachers', studentStats:'navStudents', tashkil:'navTashkil',
  observations:'navObservations', annualPlans:'navAnnualPlan', monthlyPlans:'navMonthlyPlan',
  duties:'navDuties', activities:'navActivities', professionalDevelopment:'pdPrograms',
  learningCircles:'navLearningCircles',
  monitoring:'navMonitoring', reports:'navReports', settings:'navSettings',
  criteria:'setCriteria', counters:'—'
};

register('backup', {render: async ()=>{
  Nav.setActive('backup');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navBackup')}]);
  const view=document.getElementById('view');
  const counts={};
  for(const k of Object.keys(DB.STORES)){ counts[k]=await DB.count(k); }
  const total=Object.values(counts).reduce((a,b)=>a+b,0);

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('database')+'</div>'+
      '<div><h1>'+U.t('backupTitle')+'</h1><div class="ph-sub">'+U.t('backupSub')+'</div></div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      stat(total,U.t('recordsCount'),'file')+
      stat(Object.keys(counts).length,U.t('database'),'database')+
      stat(U.tv(DB.memory?L('حافظه (موقتي)','حافظه (موقت)'):L('محلي زېرمه','بانک محلی')),U.t('engine'),'shieldCheck')+
    '</div>'+
    '<div class="grid-2">'+
      (window.Cloud && Cloud.configured() ? cloudCard() : '')+
      '<div class="card"><div class="card-head"><h3>'+U.t('fullBackup')+'</h3></div><div class="card-body">'+
        '<p class="small muted mb-2">'+U.t('autoSave')+' · '+U.t('storageUsed')+': <b>'+U.num(total)+'</b></p>'+
        '<button class="btn btn-primary btn-block" id="bkExport">'+U.icon('download')+U.t('jsonExport')+'</button>'+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('restore')+'</h3></div><div class="card-body">'+
        '<p class="small muted mb-2">'+U.t('restoreConfirm')+'</p>'+
        '<input type="file" id="bkFile" accept=".json,application/json" class="mb-2" style="width:100%">'+
        '<div class="flex gap">'+
          '<button class="btn btn-outline btn-sm" id="bkValidate">'+U.icon('shieldCheck')+U.t('validateBackup')+'</button>'+
        '</div>'+
        '<button class="btn btn-warning btn-block mt-2" id="bkRestore">'+U.icon('upload')+U.t('restore')+'</button>'+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('dataIntegrity')+'</h3></div><div class="card-body">'+
        '<button class="btn btn-outline btn-block mb-2" id="bkIntegrity">'+U.icon('refresh')+U.t('checkIntegrity')+'</button>'+
        '<div id="bkIntegrityOut" class="small"></div>'+
      '</div></div>'+
    '</div>'+
    '<div class="card mt-3"><div class="card-head"><h3>'+U.t('recordsCount')+'</h3></div><div class="card-body">'+
      '<div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">'+
        Object.keys(counts).filter(k=>k!=='counters').map(k=>
          '<div class="stat-card" style="cursor:default"><div class="sc-icon">'+U.icon('list')+'</div><div><div class="sc-num">'+U.num(counts[k])+'</div><div class="sc-label">'+(U.t(STORE_LABELS[k])||k)+'</div></div></div>'
        ).join('')+
      '</div>'+
    '</div></div>';

  document.getElementById('bkExport').addEventListener('click', async ()=>{
    const payload=await DB.dumpAll();
    const json=JSON.stringify(payload,null,1);
    U.downloadText('backup_school_tdp_'+U.fmtDateNum(U.todayISO())+'.json', json, 'application/json');
    U.toast(U.t('backupCreated'),'success');
  });

  let fileData=null;
  const fileInput=document.getElementById('bkFile');
  fileInput.addEventListener('change', ()=>{ fileData=fileInput.files[0]||null; });

  const readAndValidate=async ()=>{
    if(!fileData) return null;
    try{
      const text=await fileData.text();
      return JSON.parse(text);
    }catch(e){ return null; }
  };
  const validate=p=>{
    if(!p||typeof p!=='object') return {ok:false,msg:U.t('invalidBackup')};
    if(!p.data) return {ok:false,msg:U.t('invalidBackup')};
    const missing=Object.keys(DB.STORES).filter(k=>!(k in p.data));
    if(missing.length) return {ok:false,msg:U.t('invalidBackup')+' — '+missing.join(',')};
    let n=0; Object.values(p.data).forEach(rows=>{ if(Array.isArray(rows)) n+=rows.length; });
    return {ok:true, n};
  };

  document.getElementById('bkValidate').addEventListener('click', async ()=>{
    const p=await readAndValidate();
    const v=validate(p);
    if(v.ok) U.toast(U.t('integrityOk')+' — '+U.num(v.n)+' '+U.t('records'),'success');
    else U.toast(v.msg,'error');
  });

  document.getElementById('bkRestore').addEventListener('click', async ()=>{
    const p=await readAndValidate();
    const v=validate(p);
    if(!v.ok) return U.toast(v.msg,'error');
    const ok=await UI.confirm({danger:true, warn:true, icon:'alert', title:U.t('restore'), msg:U.t('restoreConfirm'), okLabel:U.t('restore')});
    if(!ok) return;
    try{
      await DB.loadAll(p);
      await Settings.load();
      U.toast(U.t('restoreDone'),'success');
      window.App.refreshAll();
    }catch(e){
      console.error(e);
      U.toast(U.t('restoreFailed'),'error');
    }
  });

  document.getElementById('bkIntegrity').addEventListener('click', async ()=>{
    const out=document.getElementById('bkIntegrityOut');
    out.innerHTML='<div class="spinner" style="margin:10px auto"></div>';
    const res=await DB.integrity();
    if(res.ok) out.innerHTML='<span class="badge b-green"><span class="dot"></span>'+U.t('integrityOk')+'</span>';
    else out.innerHTML='<span class="badge b-red"><span class="dot"></span>'+U.t('integrityIssues')+'</span><ul class="mt-1" style="padding-inline-start:18px">'+res.issues.map(i=>'<li>'+U.escapeHtml(i)+'</li>').join('')+'</ul>';
  });

  /* cloud sync card wiring */
  if(window.Cloud && Cloud.configured()){
    const upd=async ()=>{
      const pe=document.getElementById('bkSyncPending');
      if(pe) pe.textContent=U.num(Sync.pending);
      const te=document.getElementById('bkSyncTime');
      if(te) te.textContent=Sync.lastPushAt ? U.fmtDate(new Date(Sync.lastPushAt).toISOString())+' — '+new Date(Sync.lastPushAt).toLocaleTimeString() : U.t('neverSynced');
    };
    upd();
    const btn=document.getElementById('bkSyncNow');
    if(btn) btn.addEventListener('click', async ()=>{
      btn.disabled=true;
      await Sync.manual();
      await upd();
      btn.disabled=false;
    });
    window.__bkSyncUpd=upd;
  }
}});

function stat(n,label,icon){
  return '<div class="stat-card" style="cursor:default"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num" style="font-size:16px">'+U.escapeHtml(String(n))+'</div><div class="sc-label">'+label+'</div></div></div>';
}

/* cloud sync status card (only when Supabase is configured) */
function cloudCard(){
  const on=(typeof navigator!=='undefined')?navigator.onLine:true;
  const p=Cloud.profile;
  return '<div class="card"><div class="card-head"><h3>'+U.t('cloudSync')+'</h3></div><div class="card-body">'+
    '<div class="cloud-row"><span>'+U.t('cloudModeLbl')+'</span><span class="badge b-teal"><span class="dot"></span>'+U.t('cloudMode')+'</span></div>'+
    (p?'<div class="cloud-row"><span>'+U.t('yourAccount')+'</span><b>'+U.escapeHtml(p.full_name)+'</b> <span class="muted small">('+U.escapeHtml(p.email||'')+')</span></div>':'')+
    (Cloud.district?'<div class="cloud-row"><span>'+U.t('province')+' / '+U.t('district')+'</span><b>'+U.escapeHtml(Cloud.provinceName()+' — '+Cloud.districtName())+'</b></div>':'')+
    '<div class="cloud-row"><span>'+U.t('connection')+'</span><span class="badge '+(on?'b-green':'b-red')+'"><span class="dot"></span>'+(on?U.t('online'):U.t('offline'))+'</span></div>'+
    '<div class="cloud-row" id="bkSyncRow"><span>'+U.t('pendingSyncLbl')+'</span><b id="bkSyncPending">—</b></div>'+
    '<div class="cloud-row" id="bkLastSync"><span>'+U.t('lastSync')+'</span><span class="muted small" id="bkSyncTime">—</span></div>'+
    '<button type="button" class="btn btn-primary btn-block mt-2" id="bkSyncNow">'+U.icon('refresh')+' '+U.t('syncNow')+'</button>'+
  '</div></div>';
}

window.BackupModule={};
})();
