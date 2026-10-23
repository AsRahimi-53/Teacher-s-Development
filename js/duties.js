/* =====================================================================
   duties.js — duties/tasks with today/upcoming/overdue/completed views.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const STATUS=[
  {v:'d_open',ps:'پرانیستې',fa:'باز'},{v:'d_progress',ps:'روان',fa:'در حال انجام'},
  {v:'d_done',ps:'بشپړه',fa:'انجام شده'},{v:'d_delayed',ps:'ځنډېدلې',fa:'تأخیری'},
  {v:'d_cancelled',ps:'لغوه شوې',fa:'لغوشده'}
];
const PRIORITY=[{v:'pr_high',ps:'لوړ',fa:'بالا'},{v:'pr_medium',ps:'منځنی',fa:'متوسط'},{v:'pr_low',ps:'ټیټ',fa:'پایین'}];

const CFG={
  key:'duties',
  titleKey:'navDuties',
  icon:'checkSquare',
  fields:[
    F('title',L('د دندې سرلیک','عنوان وظیفه'),'text',{required:true,span:2}),
    F('description',L('توضیح','توضیح'),'textarea',{span:2}),
    F('memberIds',L('مسوول غړي','اعضا مسئول'),'msStore',{store:'members',labelKey:'fullName',subKey:'position'}),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('date',L('نېټه','تاریخ'),'date'),
    F('deadline',L('مهلت','مهلت'),'date',{required:true}),
    F('priority',L('لومړیتوب','اولویت'),'select',{options:PRIORITY}),
    F('status',L('حالت','وضعیت'),'select',{options:STATUS}),
    F('completion',L('بشپړتیا (%)','درصد انجام'),'number',{min:0,max:100}),
    F('result',L('پایله','نتیجه'),'textarea',{span:2}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'title',label:L('سرلیک','عنوان'),render:r=>'<b>'+U.escapeHtml(r.title||'')+'</b>',cell:r=>r.title||''},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>duScope(r.schoolIds),cell:r=>duScopeText(r.schoolIds)},
    {key:'memberIds',label:L('مسوول غړي','مسئولان'),render:r=>duMembers(r.memberIds),cell:r=>duMembersText(r.memberIds)},
    {key:'deadline',label:L('مهلت','مهلت'),render:r=>r.deadline?('<span class="'+(open(r)&&U.isOverdue(r.deadline)?'badge b-red':'')+'">'+U.fmtDate(r.deadline)+'</span>'): (r.deadline?U.fmtDate(r.deadline):''),cell:r=>r.deadline?U.fmtDate(r.deadline):''},
    {key:'priority',label:L('لومړیتوب','اولویت'),render:r=>r.priority?U.badge(r.priority):'',cell:r=>r.priority?U.statusLabel(r.priority):''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'d_open'),cell:r=>U.statusLabel(r.status||'d_open')},
    {key:'completion',label:L('بشپړتیا','انجام'),render:r=>UI.progressHTML(r.completion||0),cell:r=>Number(r.completion||0)}
  ],
  searchKeys:['title','description'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:STATUS},
    {key:'priority',label:L('لومړیتوب','اولویت'),type:'select',options:PRIORITY}
  ],
  sort:{key:'deadline',dir:'asc'},
  print: printDuty
};

function open(r){ return r.status==='d_open'||r.status==='d_progress'; }
function duScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function duScopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function duMembers(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__memberName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function duMembersText(ids){
  if(!ids||!ids.length) return U.t('entireTeam');
  return (ids.map(i=>(window.__memberName||{})[i]).filter(Boolean)).join(', ');
}

const DVT={view:'all'};

register('duties', {render: async (id, params)=>{
  Nav.setActive('duties');
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){ CRUD.openForm(CFG,{schoolIds:(params&&params.school)?[params.school]:[], memberIds:(params&&params.member)?[params.member]:[], date:U.todayISO()}); return; }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navDuties')}]);
  const rows=await DB.getAll('duties');
  const today=U.todayISO();
  const todays=rows.filter(r=>r.date===today||r.deadline===today);
  const upcoming=rows.filter(r=>open(r)&&r.deadline&&U.isUpcoming(r.deadline,7));
  const overdue=rows.filter(r=>open(r)&&r.deadline&&U.isOverdue(r.deadline));
  const done=rows.filter(r=>r.status==='d_done');

  const view=document.getElementById('view');
  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('checkSquare')+'</div>'+
      '<div><h1>'+U.t('navDuties')+'</h1><div class="ph-sub">'+U.fmtDate(today)+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="duExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-primary" id="duAdd">'+U.icon('plus')+U.t('add')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="tabs" id="duTabs">'+
      tab('all',U.t('all'),rows.length)+
      tab('today',U.t('today'),todays.length)+
      tab('upcoming',U.t('upcoming'),upcoming.length)+
      tab('overdue',U.t('overdue'),overdue.length)+
      tab('done',U.t('completed'),done.length)+
    '</div>'+
    '<div id="duBody"></div>';

  function tab(k,label,n){ return '<button class="tab'+(DVT.view===k?' active':'')+'" data-tv="'+k+'">'+label+' <span class="tab-badge">'+U.num(n)+'</span></button>'; }

  const bodyEl=document.getElementById('duBody');
  const render=()=>{
    let r2=rows.slice();
    const v=DVT.view;
    if(v==='today') r2=r2.filter(r=>r.date===today||r.deadline===today);
    if(v==='upcoming') r2=r2.filter(r=>open(r)&&r.deadline&&U.isUpcoming(r.deadline,30)&&!(r.deadline===today));
    if(v==='overdue') r2=r2.filter(r=>open(r)&&r.deadline&&U.isOverdue(r.deadline));
    if(v==='done') r2=r2.filter(r=>r.status==='d_done');
    if(!r2.length){ bodyEl.innerHTML=U.emptyState('checkSquare',U.t('noResults'),U.t('noResultsSub')); return; }
    bodyEl.innerHTML=U.tableHTML(CFG.tableCols, r2, (r,i)=>
      '<button class="icon-btn sm" data-dv="'+r2[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
      '<button class="icon-btn sm" data-de="'+r2[i].id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
      '<button class="icon-btn sm" data-dp="'+r2[i].id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
      '<button class="icon-btn sm danger" data-dd="'+r2[i].id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>');
    bodyEl.querySelectorAll('[data-dv]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('duties',b.dataset.dv); if(rec) CRUD.openDetail(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-de]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('duties',b.dataset.de); if(rec) CRUD.openForm(CFG,rec);
    }));
    bodyEl.querySelectorAll('[data-dp]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('duties',b.dataset.dp); if(rec) printDuty(rec);
    }));
    bodyEl.querySelectorAll('[data-dd]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('duties',b.dataset.dd); if(rec) CRUD.remove(CFG,rec);
    }));
  };
  render();
  view.querySelectorAll('#duTabs .tab').forEach(b=>b.addEventListener('click', ()=>{
    DVT.view=b.dataset.tv;
    view.querySelectorAll('#duTabs .tab').forEach(x=>x.classList.toggle('active',x===b));
    render();
  }));
  document.getElementById('duAdd').addEventListener('click', ()=>CRUD.openForm(CFG,{date:U.todayISO()}));
  document.getElementById('duExport').addEventListener('click', ()=>ExcelExport.exportList(CFG, rows));
}});

async function printDuty(d){
  const doc=await PrintDoc.officialDoc({
    seqType:'duty',
    title: U.t('navDuties')+' — '+U.t('official'),
    sub: d.title,
    meta:[{k:U.t('status'),v:U.statusLabel(d.status||'d_open')},{k:U.t('priority'),v:d.priority?U.statusLabel(d.priority):''}],
    sections:[{heading:U.t('detail'), html: PrintDoc.kv([
      {k:U.t('dutyTitle'),v:d.title,full:true},{k:U.t('description'),v:d.description,full:true},
      {k:U.t('memberIds'),v:duMembersText(d.memberIds),full:true},{k:U.t('schoolIds'),v:duScopeText(d.schoolIds),full:true},
      {k:U.t('date'),v:d.date?U.fmtDate(d.date):''},{k:U.t('deadline'),v:d.deadline?U.fmtDate(d.deadline):''},
      {k:U.t('completion'),v:(d.completion||0)+'%'},{k:U.t('result'),v:d.result,full:true},
      {k:U.t('notes'),v:d.notes,full:true}
    ])}]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.DutiesModule={CFG, printDuty};
})();
