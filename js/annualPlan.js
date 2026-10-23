/* =====================================================================
   annualPlan.js — annual plans. Assignable to one/multiple members,
   one/multiple schools or entire district.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const STATUS=[
  {v:'p_planned',ps:'پلان شوی',fa:'برنامه‌ریزی شده'},{v:'p_inprogress',ps:'د اجرا په حال کې',fa:'در حال اجرا'},
  {v:'p_done',ps:'بشپړ شوی',fa:'انجام شده'},{v:'p_delayed',ps:'ځنډېدلی',fa:'تأخیر یافته'},
  {v:'p_cancelled',ps:'لغوه شوی',fa:'لغو شده'}
];
const PRIORITY=[{v:'pr_high',ps:'لوړ',fa:'بالا'},{v:'pr_medium',ps:'منځنی',fa:'متوسط'},{v:'pr_low',ps:'ټیټ',fa:'پایین'}];

const CFG={
  key:'annualPlans',
  titleKey:'navAnnualPlan',
  icon:'calendar',
  fields:[
    F('title',L('د پلان سرلیک','عنوان برنامه'),'text',{required:true,span:2}),
    F('objective',L('موخه','هدف'),'textarea',{span:2}),
    F('activity',L('فعالیت','فعالیت'),'textarea',{span:2}),
    F('expectedResult',L('تمه شوې پایله','نتیجه مورد انتظار'),'textarea',{span:2}),
    F('targetGroup',L('هدف ګروپ','گروه هدف')),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('memberIds',L('مسوول غړي','اعضای مسئول'),'msStore',{store:'members',labelKey:'fullName',subKey:'position',required:true}),
    F('startDate',L('د پیل نېټه','تاریخ شروع'),'date',{required:true}),
    F('endDate',L('د پای نېټه','تاریخ پایان'),'date',{required:true}),
    F('priority',L('لومړیتوب','اولویت'),'select',{options:PRIORITY}),
    F('status',L('حالت','وضعیت'),'select',{options:STATUS}),
    F('completion',L('بشپړتیا (%)','درصد انجام'),'number',{min:0,max:100}),
    F('resources',L('وسایل','منابع'),'textarea',{span:2}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'title',label:L('سرلیک','عنوان'),render:r=>'<b>'+U.escapeHtml(r.title||'')+'</b>',cell:r=>r.title||''},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>planScope(r.schoolIds),cell:r=>scopeText(r.schoolIds)},
    {key:'memberIds',label:L('مسوول غړي','مسئولان'),render:r=>memberNames(r.memberIds),cell:r=>memberNamesText(r.memberIds)},
    {key:'dates',label:L('موده','مدت'),render:r=>(r.startDate||r.endDate)?U.fmtDate(r.startDate||'')+' ← '+U.fmtDate(r.endDate||''):'',cell:r=>(r.startDate?U.fmtDate(r.startDate):'')+' → '+(r.endDate?U.fmtDate(r.endDate):'')},
    {key:'priority',label:L('لومړیتوب','اولویت'),render:r=>r.priority?U.badge(r.priority):'',cell:r=>r.priority?U.statusLabel(r.priority):''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'p_planned'),cell:r=>U.statusLabel(r.status||'p_planned')},
    {key:'completion',label:L('بشپړتیا','میزان انجام'),render:r=>UI.progressHTML(r.completion||0),cell:r=>Number(r.completion||0)}
  ],
  searchKeys:['title','objective','targetGroup'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:STATUS},
    {key:'priority',label:L('لومړیتوب','اولویت'),type:'select',options:PRIORITY},
    {key:'memberId',label:L('غړی','عضو'),type:'memberflt',
      match:(r,v)=>(r.memberIds||[]).includes(v)},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolflt',
      match:(r,v)=>(r.schoolIds||[]).includes(v)}
  ],
  sort:{key:'startDate',dir:'desc'},
  print: printPlan,
  exportTotals:(rows)=>{
    const done=rows.filter(r=>r.status==='p_done').length;
    const avg=rows.length?Math.round(rows.reduce((a,r)=>a+Number(r.completion||0),0)/rows.length):0;
    return [U.t('total'),'','',done+' / '+rows.length,'',avg+'%'];
  }
};

function planScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function scopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function memberNames(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  const nm=ids.map(i=>(window.__memberName||{})[i]).filter(Boolean);
  return '<span class="small">'+U.escapeHtml(nm.join('، '))+'</span>';
}
function memberNamesText(ids){
  if(!ids||!ids.length) return U.t('entireTeam');
  return (ids.map(i=>(window.__memberName||{})[i]).filter(Boolean)).join(', ');
}

async function prep(){
  const [mopts,sopts]=await Promise.all([optionsFromStore('members','fullName'),optionsFromStore('schools','name')]);
  CFG.filters.forEach(f=>{
    if(f.type==='memberflt') f.options=mopts.map(o=>({v:o.id,ps:o.label,fa:o.label}));
    if(f.type==='schoolflt') f.options=sopts.map(o=>({v:o.id,ps:o.label,fa:o.label}));
  });
}

register('annualplan', {render: async (id, params)=>{
  Nav.setActive('annualplan');
  await prep();
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){ CRUD.openForm(CFG,{schoolIds:(params&&params.school)?[params.school]:[], memberIds:(params&&params.member)?[params.member]:[]}); return; }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navAnnualPlan')}]);
  const rows=await DB.getAll('annualPlans');
  const done=rows.filter(r=>r.status==='p_done').length;
  const prog=rows.filter(r=>r.status==='p_inprogress').length;
  const avg=rows.length?Math.round(rows.reduce((a,r)=>a+Number(r.completion||0),0)/rows.length):0;

  const view=document.getElementById('view');
  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('calendar')+'</div>'+
      '<div><h1>'+U.t('navAnnualPlan')+'</h1><div class="ph-sub">'+U.t('academicYear')+' — '+(Settings.get().academicYear||'')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="apExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-primary" id="apAdd">'+U.icon('plus')+U.t('add')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      mini(rows.length,U.t('totalPlans'),'calendar')+
      mini(done,U.t('completed'),'checkSquare')+
      mini(prog,U.t('inProgress'),'activity')+
      mini(U.num(avg)+'%',U.t('completion'),'trend')+
    '</div>'+
    '<div class="card"><div class="card-head"><h3>'+U.t('records')+'</h3></div><div class="card-body">'+
      '<div id="apBody" class="mb-2"></div>'+
    '</div></div>';

  const st={search:'',status:'',priority:'',memberId:'',schoolId:''};
  const bodyEl=document.getElementById('apBody');
  const render=()=>{
    let r2=rows.slice();
    const q=st.search.trim().toLowerCase();
    if(q) r2=r2.filter(r=>(r.title||'').toLowerCase().includes(q)||(r.objective||'').toLowerCase().includes(q));
    if(st.status) r2=r2.filter(r=>r.status===st.status);
    if(st.priority) r2=r2.filter(r=>r.priority===st.priority);
    if(st.memberId) r2=r2.filter(r=>(r.memberIds||[]).includes(st.memberId));
    if(st.schoolId) r2=r2.filter(r=>(r.schoolIds||[]).includes(st.schoolId));
    if(!r2.length){ bodyEl.innerHTML=U.emptyState('calendar',U.t('noResults'),U.t('noResultsSub')); return; }
    bodyEl.innerHTML=U.tableHTML(CFG.tableCols, r2, (r,i)=>
      '<button class="icon-btn sm" data-pv="'+r2[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
      '<button class="icon-btn sm" data-pe="'+r2[i].id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
      '<button class="icon-btn sm" data-pp="'+r2[i].id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
      '<button class="icon-btn sm danger" data-pd="'+r2[i].id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>');
    bodyEl.querySelectorAll('[data-pv]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('annualPlans',b.dataset.pv); if(rec) CRUD.openDetail(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-pe]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('annualPlans',b.dataset.pe); if(rec) CRUD.openForm(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-pp]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('annualPlans',b.dataset.pp); if(rec) printPlan(rec);
    }));
    bodyEl.querySelectorAll('[data-pd]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('annualPlans',b.dataset.pd); if(rec) CRUD.remove(CFG,rec);
    }));
  };
  render();

  const toolbar=document.createElement('div');
  toolbar.className='toolbar';
  toolbar.innerHTML=
    '<div class="tb-grow"><span class="tb-icon">'+U.icon('search')+'</span><input type="search" id="apSearch" placeholder="'+U.t('searchPh')+'"></div>'+
    '<select class="flt" id="apStatus"><option value="">'+U.t('status')+': '+U.t('all')+'</option>'+STATUS.map(o=>'<option value="'+o.v+'">'+U.tv(o)+'</option>').join('')+'</select>'+
    '<select class="flt" id="apMember"><option value="">'+U.t('member')+': '+U.t('all')+'</option>'+members.map(m=>'<option value="'+m.id+'">'+U.escapeHtml(m.fullName)+'</option>').join('')+'</select>'+
    '<select class="flt" id="apSchool"><option value="">'+U.t('school')+': '+U.t('all')+'</option>'+schools.map(s=>'<option value="'+s.id+'">'+U.escapeHtml(s.name)+'</option>').join('')+'</select>';
  view.querySelector('.card-body').prepend(toolbar);
  toolbar.querySelector('#apSearch').addEventListener('input', U.debounce(e=>{ st.search=e.target.value; render(); },200));
  toolbar.querySelector('#apStatus').addEventListener('change', e=>{ st.status=e.target.value; render(); });
  toolbar.querySelector('#apMember').addEventListener('change', e=>{ st.memberId=e.target.value; render(); });
  toolbar.querySelector('#apSchool').addEventListener('change', e=>{ st.schoolId=e.target.value; render(); });

  document.getElementById('apAdd').addEventListener('click', ()=>CRUD.openForm(CFG,{}));
  document.getElementById('apExport').addEventListener('click', ()=>ExcelExport.exportList(CFG, rows));
}});

function mini(n,label,icon){
  return '<div class="stat-card" style="cursor:default"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+(typeof n==='number'?U.num(n):n)+'</div><div class="sc-label">'+label+'</div></div></div>';
}

async function printPlan(p){
  const doc=await PrintDoc.officialDoc({
    seqType:'plan',
    title: U.t('navAnnualPlan')+' — '+U.t('official'),
    sub: p.title,
    meta:[{k:U.t('status'),v:U.statusLabel(p.status||'p_planned')},{k:U.t('completion'),v:(p.completion||0)+'%'}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('planTitle'),v:p.title,full:true},{k:U.t('objective'),v:p.objective,full:true},
        {k:U.t('activity'),v:p.activity,full:true},{k:U.t('expectedResult'),v:p.expectedResult,full:true},
        {k:U.t('targetGroup'),v:p.targetGroup},{k:U.t('priority'),v:p.priority?U.statusLabel(p.priority):''},
        {k:U.t('schoolIds'),v:scopeText(p.schoolIds),full:true},{k:U.t('memberIds'),v:memberNamesText(p.memberIds),full:true},
        {k:U.t('startDate'),v:p.startDate?U.fmtDate(p.startDate):''},{k:U.t('endDate'),v:p.endDate?U.fmtDate(p.endDate):''},
        {k:U.t('resources'),v:p.resources,full:true},{k:U.t('notes'),v:p.notes,full:true}
      ])}
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.AnnualPlanModule={CFG, printPlan};
})();
