/* =====================================================================
   monthlyPlan.js — monthly plans with planned/completed/delayed/
   cancelled comparison.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const STATUS=[
  {v:'mp_planned',ps:'پلان شوی',fa:'برنامه‌ریزی شده'},{v:'mp_inprogress',ps:'روان',fa:'در حال انجام'},
  {v:'mp_done',ps:'بشپړ شوی',fa:'انجام شده'},{v:'mp_delayed',ps:'ځنډېدلی',fa:'تأخیر یافته'},
  {v:'mp_cancelled',ps:'لغوه شوی',fa:'لغو شده'}
];

const CFG={
  key:'monthlyPlans',
  titleKey:'navMonthlyPlan',
  icon:'calendarCheck',
  fields:[
    F('activity',L('فعالیت','فعالیت'),'text',{required:true,span:2}),
    F('objective',L('موخه','هدف'),'textarea',{span:2}),
    F('expectedResult',L('تمه شوې پایله','نتیجه مورد انتظار'),'textarea',{span:2}),
    F('year',L('کال','سال'),'year',{required:true}),
    F('month',L('میاشت','ماه'),'month',{required:true}),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('memberIds',L('مسوول غړي','اعضا مسئول'),'msStore',{store:'members',labelKey:'fullName',subKey:'position'}),
    F('date',L('نېټه','تاریخ'),'date'),
    F('deadline',L('مهلت','مهلت'),'date'),
    F('status',L('حالت','وضعیت'),'select',{options:STATUS}),
    F('result',L('پایله','نتیجه'),'textarea',{span:2}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'activity',label:L('فعالیت','فعالیت'),render:r=>'<b>'+U.escapeHtml(r.activity||'')+'</b>',cell:r=>r.activity||''},
    {key:'ym',label:L('کال / میاشت','سال / ماه'),render:r=>mpYM(r),cell:r=>mpYMText(r)},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>mpScope(r.schoolIds),cell:r=>mpScopeText(r.schoolIds)},
    {key:'memberIds',label:L('مسوول غړي','مسئولان'),render:r=>mpMembers(r.memberIds),cell:r=>mpMembersText(r.memberIds)},
    {key:'deadline',label:L('مهلت','مهلت'),render:r=>r.deadline?U.fmtDate(r.deadline):'',cell:r=>r.deadline?U.fmtDate(r.deadline):''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'mp_planned'),cell:r=>U.statusLabel(r.status||'mp_planned')}
  ],
  searchKeys:['activity','objective','result'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:STATUS},
    {key:'month',label:L('میاشت','ماه'),type:'monthflt'}
  ],
  sort:{key:'date',dir:'desc'},
  print: printMonthly
};

function mpYM(r){
  if(!r.month) return r.year?String(r.year):'';
  return (r.year?r.year+' / ':'')+U.monthName(r.month);
}
function mpYMText(r){
  if(!r.month) return r.year?String(r.year):'';
  return (r.year?r.year+' / ':'')+U.monthName(r.month, 'ps');
}
function mpScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function mpScopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function mpMembers(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__memberName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function mpMembersText(ids){
  if(!ids||!ids.length) return U.t('entireTeam');
  return (ids.map(i=>(window.__memberName||{})[i]).filter(Boolean)).join(', ');
}

async function prep(){
  const opts=[];
  for(let i=1;i<=12;i++) opts.push({v:String(i), ps:U.monthName(i), fa:U.monthName(i,'fa')});
  CFG.filters.forEach(f=>{ if(f.type==='monthflt') f.options=opts; });
}

register('monthlyplan', {render: async (id, params)=>{
  Nav.setActive('monthlyplan');
  await prep();
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){ CRUD.openForm(CFG,{schoolIds:(params&&params.school)?[params.school]:[], memberIds:(params&&params.member)?[params.member]:[]}); return; }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navMonthlyPlan')}]);
  const rows=await DB.getAll('monthlyPlans');
  const year=Settings.get().academicYear;
  const curMonth=U.nowJalaliMonth();
  const yrRows=rows.filter(r=>String(r.year)===String(year));
  const cnt=s=>yrRows.filter(r=>r.status===s).length;
  const planned=cnt('mp_planned')+cnt('mp_inprogress');
  const done=cnt('mp_done'), delayed=cnt('mp_delayed'), cancelled=cnt('mp_cancelled');
  const total=yrRows.length;
  const compPct=total?Math.round((done/(done+planned+delayed+cancelled||1))*100):0;

  const view=document.getElementById('view');
  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('calendarCheck')+'</div>'+
      '<div><h1>'+U.t('navMonthlyPlan')+'</h1><div class="ph-sub">'+U.t('academicYear')+' — '+year+' · '+U.monthName(curMonth)+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="mpExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-primary" id="mpAdd">'+U.icon('plus')+U.t('add')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      mini(planned,U.t('planned'),'calendar','var(--info-soft)')+
      mini(done,U.t('completed'),'checkSquare','var(--success-soft)')+
      mini(delayed,U.t('delayed'),'clock','var(--warning-soft)')+
      mini(cancelled,U.t('cancelled'),'x','var(--danger-soft)')+
    '</div>'+
    '<div class="card mb-3"><div class="card-body">'+
      '<div class="flex mb-1"><b class="small">'+U.t('monthlyPlanProgress')+'</b><span class="muted small grow"></span><b class="small">'+U.num(done)+' / '+U.num(total)+'</b></div>'+
      '<div class="progress progress-lg" style="display:flex"><div class="bar" style="width:'+(total?done/total*100:0)+'%"></div><div class="bar warn" style="width:'+(total?delayed/total*100:0)+'%"></div></div>'+
      '<div class="progress-labels"><span>'+U.t('completed')+': '+U.num(done)+'</span><span>'+U.t('delayed')+': '+U.num(delayed)+'</span><span>'+U.t('planned')+': '+U.num(planned)+'</span></div>'+
    '</div></div>'+
    '<div class="toolbar">'+
      '<div class="tb-grow"><span class="tb-icon">'+U.icon('search')+'</span><input type="search" id="mpSearch" placeholder="'+U.t('searchPh')+'"></div>'+
      '<select class="flt" id="mpMonthF"><option value="">'+U.t('month')+': '+U.t('all')+'</option>'+
        Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">'+U.monthName(i+1)+'</option>').join('')+'</select>'+
      '<select class="flt" id="mpStatusF"><option value="">'+U.t('status')+': '+U.t('all')+'</option>'+STATUS.map(o=>'<option value="'+o.v+'">'+U.tv(o)+'</option>').join('')+'</select>'+
    '</div>'+
    '<div id="mpBody"></div>';

  let st={search:'',month:'',status:''};
  const bodyEl=document.getElementById('mpBody');
  const render=()=>{
    let r2=rows.slice();
    const q=st.search.trim().toLowerCase();
    if(q) r2=r2.filter(r=>(r.activity||'').toLowerCase().includes(q)||(r.objective||'').toLowerCase().includes(q));
    if(st.month) r2=r2.filter(r=>String(r.month)===st.month);
    if(st.status) r2=r2.filter(r=>r.status===st.status);
    if(!r2.length){ bodyEl.innerHTML=U.emptyState('calendarCheck',U.t('noResults'),U.t('noResultsSub')); return; }
    bodyEl.innerHTML=U.tableHTML(CFG.tableCols, r2, (r,i)=>
      '<button class="icon-btn sm" data-mv="'+r2[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
      '<button class="icon-btn sm" data-me="'+r2[i].id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
      '<button class="icon-btn sm" data-mp="'+r2[i].id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
      '<button class="icon-btn sm danger" data-md="'+r2[i].id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>');
    bodyEl.querySelectorAll('[data-mv]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('monthlyPlans',b.dataset.mv); if(rec) CRUD.openDetail(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-me]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('monthlyPlans',b.dataset.me); if(rec) CRUD.openForm(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-mp]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('monthlyPlans',b.dataset.mp); if(rec) printMonthly(rec);
    }));
    bodyEl.querySelectorAll('[data-md]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('monthlyPlans',b.dataset.md); if(rec) CRUD.remove(CFG,rec);
    }));
  };
  render();
  document.getElementById('mpSearch').addEventListener('input', U.debounce(e=>{ st.search=e.target.value; render(); },200));
  document.getElementById('mpMonthF').addEventListener('change', e=>{ st.month=e.target.value; render(); });
  document.getElementById('mpStatusF').addEventListener('change', e=>{ st.status=e.target.value; render(); });
  document.getElementById('mpAdd').addEventListener('click', ()=>CRUD.openForm(CFG,{year:Settings.get().academicYear, month:curMonth}));
  document.getElementById('mpExport').addEventListener('click', ()=>ExcelExport.exportList(CFG, rows));
}});

function mini(n,label,icon,bg){
  return '<div class="stat-card" style="cursor:default;--sc-bg:'+bg+'"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+(typeof n==='number'?U.num(n):n)+'</div><div class="sc-label">'+label+'</div></div></div>';
}

async function printMonthly(p){
  const doc=await PrintDoc.officialDoc({
    seqType:'monthlyplan',
    title: U.t('navMonthlyPlan')+' — '+U.t('official'),
    sub: p.activity,
    meta:[{k:U.t('year'),v:p.year},{k:U.t('month'),v:p.month?U.monthName(p.month):''},{k:U.t('status'),v:U.statusLabel(p.status||'mp_planned')}],
    sections:[{heading:U.t('detail'), html: PrintDoc.kv([
      {k:U.t('activity'),v:p.activity,full:true},{k:U.t('objective'),v:p.objective,full:true},
      {k:U.t('expectedResult'),v:p.expectedResult,full:true},{k:U.t('schoolIds'),v:mpScopeText(p.schoolIds),full:true},
      {k:U.t('memberIds'),v:mpMembersText(p.memberIds),full:true},
      {k:U.t('date'),v:p.date?U.fmtDate(p.date):''},{k:U.t('deadline'),v:p.deadline?U.fmtDate(p.deadline):''},
      {k:U.t('result'),v:p.result,full:true},{k:U.t('notes'),v:p.notes,full:true}
    ])}]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.MonthlyPlanModule={CFG, printMonthly};
})();
