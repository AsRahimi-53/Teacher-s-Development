/* =====================================================================
   members.js — Scientific Members module.
   No fixed limit: 8, 10, 15, 20+ members supported.
   Individual dashboard per member + team overview via list.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const GENDER_OPTS=[{v:'boys',ps:'نارینه',fa:'مرد'},{v:'girls',ps:'ښځینه',fa:'زن'}];
const MEMBER_STATUS=[
  {v:'m_active',ps:'فعال',fa:'فعال'},{v:'m_inactive',ps:'غیر فعال',fa:'غیرفعال'},
  {v:'m_leave',ps:'رخصت',fa:'مرخصی'},{v:'m_other',ps:'نور',fa:'سایر'}
];
const EDU_OPTS=[
  {v:'eduBaccalaureate',ps:'بکلوریا',fa:'بکلوریا'},{v:'eduAssociate',ps:'فوق بکلوریا',fa:'فوق بکلوریا'},
  {v:'eduBachelor',ps:'لیسانس',fa:'لیسانس'},{v:'eduMaster',ps:'ماسټر',fa:'ماستر'}
];

/* the position is typed text now; values saved earlier as a key (posAmir…) are still shown in words */
const posText=v=>{ if(!v) return ''; const s=U.t(v); return s&&s!==v?s:v; };

const CFG={
  key:'members',
  /* a member that belongs to an ACCOUNT is never deleted here — the account is managed in Supabase */
  canDelete:r=>!r.accountId,
  titleKey:'navMembers',
  icon:'users',
  fields:[
    F('fullName',L('بشپړ نوم','نام کامل'),'text',{required:true}),
    F('fatherName',L('د پلار نوم','نام پدر')),
    F('employeeId',L('د تذکرې نمبر','نمبر تذکره')),
    F('tashkilCode',L('تشکیل کوډ','کد تشکیل')),
    F('position',L('دنده','سمت'),'text',{required:true,placeholder:'آمر / تدریسي مامور / اجرائیه مامور'}),
    F('gender',L('جنسیت','جنسیت'),'select',{options:GENDER_OPTS}),
    F('status',L('حالت','وضعیت'),'select',{options:MEMBER_STATUS,required:true}),
    F('phone',L('تلیفون','تلفون'),'tel'),
    F('email',L('برېښنالیک','ایمیل'),'email'),
    F('education',L('زده کړه','تحصیلات'),'select',{options:EDU_OPTS}),
    F('specialization',L('تخصص','تخصص')),
    F('appointmentDate',L('د مقررېدو نېټه','تاریخ انتصاب'),'date'),
    F('photo',L('انځور','عکس'),'photo',{span:2,maxDim:300}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'_name', label:L('بشپړ نوم','نام کامل'), isNum:false, cls:'cell-wide',
      render:r=>'<div class="cell-person">'+U.avatarHTML(r,38)+'<div class="cell-strong">'+U.escapeHtml(r.fullName||'')+'</div></div>',
      cell:r=>r.fullName||''},
    {key:'fatherName',label:L('د پلار نوم','نام پدر'),cell:r=>r.fatherName||''},
    {key:'tashkilCode',label:L('تشکیل کوډ','کد تشکیل'),cls:'cell-code',render:r=>r.tashkilCode?'<span class="code-chip">'+U.escapeHtml(r.tashkilCode)+'</span>':'—',cell:r=>r.tashkilCode||''},
    {key:'position',label:L('دنده','سمت'),cls:'cell-nowrap',cell:r=>posText(r.position)},
    {key:'gender',label:L('جنسیت','جنسیت'),render:r=>r.gender?U.badge('pg_'+r.gender):'',cell:r=>r.gender?U.statusLabel('pg_'+r.gender):''},
    {key:'phone',label:L('تلیفون','تلفون'),cell:r=>r.phone||''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'m_active'),cell:r=>U.statusLabel(r.status||'m_active')},
    {key:'appointmentDate',label:L('د مقررېدو نېټه','تاریخ انتصاب'),render:r=>r.appointmentDate?U.fmtDate(r.appointmentDate):'',cell:r=>r.appointmentDate?U.fmtDate(r.appointmentDate):''}
  ],
  searchKeys:['fullName','fatherName','position','phone','employeeId','tashkilCode'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:MEMBER_STATUS},
    {key:'gender',label:L('جنسیت','جنسیت'),type:'select',options:GENDER_OPTS}
  ],
  sort:{key:'fullName',dir:'asc'},
  print: printMember
};

/* ---------------- individual member dashboard ---------------- */
async function renderMemberPage(id){
  const m=await DB.get('members',id);
  if(!m){ location.hash='#/members'; return; }
  const view=document.getElementById('view');
  Nav.setActive('members');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navMembers'),route:'members'},{label:m.fullName}]);

  const [duties,ap,mp,acts,obs,pd,mon]=await Promise.all([
    DB.getAll('duties'),DB.getAll('annualPlans'),DB.getAll('monthlyPlans'),
    DB.getAll('activities'),DB.getAll('observations'),DB.getAll('professionalDevelopment'),
    DB.getAll('monitoring')
  ]);
  const hasMid=arr=>arr.filter(r=>(r.memberIds||[]).includes(id));
  const d=hasMid(duties), p=hasMid(ap), mpd=hasMid(mp), a=hasMid(acts),
        o=obs.filter(x=>x.observerId===id), pdp=hasMid(pd), monr=hasMid(mon);

  const today=U.todayISO();
  const dToday=d.filter(x=>x.date===today || x.deadline===today);
  const dOverdue=d.filter(x=>['d_open','d_progress'].includes(x.status) && x.deadline && U.isOverdue(x.deadline));
  const dUpcoming=d.filter(x=>['d_open','d_progress'].includes(x.status) && x.deadline && !U.isOverdue(x.deadline));
  const dDone=d.filter(x=>x.status==='d_done');

  const avgCompletion=arr=>arr.length?Math.round(arr.reduce((s,x)=>s+Number(x.completion||0),0)/arr.length):0;
  const openItems=[...d.filter(x=>x.status!=='d_done'),...p.filter(x=>x.status!=='p_done'),...mpd.filter(x=>x.status!=='mp_done'),...a.filter(x=>x.status!=='a_done')];
  const allItems=[...d,...p,...mpd,...a];
  const annualProgress=allItems.length?Math.round(allItems.filter(x=>x.status==='d_done'||x.status==='p_done'||x.status==='mp_done'||x.status==='a_done').length/allItems.length*100):0;

  const statCard=(num,label,icon,route)=>
    '<div class="stat-card" data-nav="'+(route||'')+'" style="--sc-bg:var(--primary-soft);--sc-fg:var(--primary)">'+
    '<div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+U.num(num)+'</div><div class="sc-label">'+label+'</div></div></div>';

  const listDuties=(arr, icon, cls)=>{
    if(!arr.length) return '<div class="muted small" style="padding:8px 4px">'+U.t('none')+'</div>';
    return '<div class="mini-list">'+arr.slice(0,6).map(x=>
      '<div class="mini-item"><div class="mi-ico" style="background:var(--'+cls+'-soft);color:var(--'+cls+')">'+U.icon(icon)+'</div>'+
      '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(x.title||x.activity||'')+'</div>'+
      '<div class="mi-sub">'+U.fmtDate(x.deadline||x.date)+'</div></div>'+U.badge(x.status)+'</div>'
    ).join('')+'</div>';
  };

  const workRows=[
    [U.t('navDuties'), U.num(d.length), U.badge('d_open')+' '+U.num(d.filter(x=>x.status!=='d_done').length)],
    [U.t('navAnnualPlan'), U.num(p.length), ''],
    [U.t('navMonthlyPlan'), U.num(mpd.length), ''],
    [U.t('navActivities'), U.num(a.length), ''],
    [U.t('navObservations'), U.num(o.length), ''],
    [U.t('navProfDev'), U.num(pdp.length), ''],
    [U.t('navMonitoring'), U.num(monr.length), '']
  ];

  view.innerHTML =
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('userCheck')+'</div>'+
      '<div><h1>'+U.escapeHtml(m.fullName)+'</h1><div class="ph-sub">'+U.escapeHtml(posText(m.position))+' — '+U.t('navMembers')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="mpPrint">'+U.icon('printer')+U.t('print')+'</button>'+
        '<button class="btn btn-outline" id="mpEdit">'+U.icon('edit')+U.t('edit')+'</button>'+
        '<button class="btn btn-primary" id="mpObs">'+U.icon('eye')+U.t('newObs')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      statCard(d.length,U.t('navDuties'),'checkSquare')+
      statCard(p.length,U.t('navAnnualPlan'),'calendar')+
      statCard(a.length,U.t('navActivities'),'activity')+
      statCard(o.length,U.t('navObservations'),'eye')+
      statCard(pdp.length,U.t('navProfDev'),'book')+
      statCard(monr.length,U.t('navMonitoring'),'clipboardCheck')+
    '</div>'+
    '<div class="grid-2 mb-3">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('progress')+'</h3></div><div class="card-body">'+
        '<div class="mb-2"><div class="flex mb-1"><b class="small">'+U.t('annualPlanProgress')+'</b><span class="muted small grow"></span><b class="small">'+annualProgress+'%</b></div>'+UI.progressHTML(annualProgress)+'</div>'+
        '<div class="mb-2"><div class="flex mb-1"><b class="small">'+U.t('completion')+' — '+U.t('navDuties')+'</b><span class="muted small grow"></span><b class="small">'+avgCompletion(d)+'%</b></div>'+UI.progressHTML(avgCompletion(d))+'</div>'+
        '<div><div class="flex mb-1"><b class="small">'+U.t('completed')+' / '+U.t('pending')+'</b><span class="muted small grow"></span><b class="small">'+U.num(dDone.length)+' / '+U.num(openItems.length)+'</b></div>'+
        UI.progressHTML(allItems.length?dDone.length/allItems.length*100:0)+'</div>'+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('overview')+'</h3></div><div class="card-body flush" style="max-height:340px;overflow:auto">'+
        U.tableHTML(
          [{key:0,label:L('عملیات','عملیات')},{key:1,label:L('شمېر','تعداد')},{key:2,label:L('حالت','وضعیت'),render:r=>r[2]||''}],
          workRows.map((r,i)=>({0:r[0],1:r[1],2:r[2]})),
          ()=>''
        )
      '</div></div>'+
    '</div>'+
    '<div class="grid-2 mb-3">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('today')+' — '+U.t('navDuties')+'</h3></div><div class="card-body">'+listDuties(dToday,'clock','primary')+'</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('overdueDuties')+'</h3></div><div class="card-body">'+listDuties(dOverdue,'alert','danger')+'</div></div>'+
    '</div>'+
    '<div class="grid-2">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('upcomingDuties')+'</h3></div><div class="card-body">'+listDuties(dUpcoming,'calendar','info')+'</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('completed')+' — '+U.t('navDuties')+'</h3></div><div class="card-body">'+listDuties(dDone,'checkSquare','success')+'</div></div>'+
    '</div>';

  document.getElementById('mpEdit').addEventListener('click', ()=>CRUD.openForm(CFG,m));
  document.getElementById('mpPrint').addEventListener('click', ()=>printMember(m));
  document.getElementById('mpObs').addEventListener('click', ()=>{ location.hash='#/observations/new?teacher=&observer='+id; });
}

/* ---------------- print ---------------- */
async function printMember(m){
  const schools=await DB.getAll('schools');
  const obs=await DB.getAll('observations');
  const myObs=obs.filter(o=>o.observerId===m.id);
  const docs=await PrintDoc.officialDoc({
    seqType:'member',
    title: U.t('viewRecord')+' — '+U.t('navMembers'),
    sub: m.fullName,
    meta:[{k:U.t('position'),v:posText(m.position)},{k:U.t('employeeId'),v:m.employeeId}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('fullName'),v:m.fullName},{k:U.t('fatherName'),v:m.fatherName},
        {k:U.t('employeeId'),v:m.employeeId},{k:U.t('tashkilCode'),v:m.tashkilCode},{k:U.t('position'),v:posText(m.position)},
        {k:U.t('gender'),v:m.gender?U.statusLabel('pg_'+m.gender):''},
        {k:U.t('phone'),v:m.phone},{k:U.t('email'),v:m.email},
        {k:U.t('education'),v:m.education?U.t(m.education):''},
        {k:U.t('specialization'),v:m.specialization},
        {k:U.t('appointmentDate'),v:m.appointmentDate?U.fmtDate(m.appointmentDate):''},
        {k:U.t('status'),v:U.statusLabel(m.status||'m_active')},
        {k:U.t('notes'),v:m.notes,full:true}
      ])},
      {heading:U.t('navObservations')+' ('+myObs.length+')', html: myObs.length?
        PrintDoc.table(
          [L('نېټه','تاریخ'),L('ښوونکی','معلم'),L('شمېره','شماره'),L('نمره','نمره'),L('سلنه','درصد'),L('کیفیت','کیفیت')],
          myObs.map(o=>{
            const t=(window.__cacheAll&&window.__cacheAll.teachers||[]).find(x=>x.id===o.teacherId);
            const q=Settings.quality(o.percentage);
            return [U.fmtDate(o.date), t?t.fullName:'', o.observationNumber, (o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||''), (o.percentage||0)+'%', U.currentLang()==='fa'?q.fa:q.ps];
          }),
          {numCols:[2,3,4]}
        ) : PrintDoc.para(U.t('noData'))}
    ]
  });
  PrintDoc.preview(docs, U.t('print'));
}

window.MembersModule={CFG, printMember, renderMemberPage};
register('members', {render: async (id)=>{ if(id==='new'){ Nav.setActive('members'); CRUD.openForm(CFG,{}); return; } if(id) await renderMemberPage(id); else { Nav.setActive('members'); Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navMembers')}]); await CRUD.renderList(CFG); } }});
})();
