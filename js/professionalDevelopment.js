/* =====================================================================
   professionalDevelopment.js — teacher professional development:
   1) PD programs (workshops, seminars, ...) with participant stats
   2) Teacher Learning Circles (د ښوونکو زده‌کړیزې حلقې) — circles
      that scientific members register for teachers on specific topics.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const TYPES=[
  {v:'pdWorkshop',ps:'ورکشاپ',fa:'کارگاه'},{v:'pdSeminar',ps:'سمینار',fa:'سمینار'},
  {v:'pdTraining',ps:'دنده',fa:'کارگاه آموزشی'},{v:'pdOnJob',ps:'په دندې کې',fa:'آموزش عملی'},
  {v:'pdMeeting',ps:'غونډه',fa:'جلسه'},{v:'pdOther',ps:'نور',fa:'سایر'}
];

const LC_STATUS=[
  {v:'lc_planned',ps:'پلان شوې',fa:'برنامه‌ریزی شده'},
  {v:'lc_active',ps:'روان',fa:'در حال انجام'},
  {v:'lc_done',ps:'بشپړه شوه',fa:'انجام شده'}
];

const LC_FREQ=[
  {v:'lcWeekly',ps:'اونیزه',fa:'هفتگی'},
  {v:'lcBiWeekly',ps:'دوه اونیزه',fa:'دوه‌هفتگی'},
  {v:'lcMonthly',ps:'میاشتنۍ',fa:'ماهانه'},
  {v:'lcQuarterly',ps:'درې میاشتنۍ',fa:'سه‌ماهانه'}
];

const CFG={
  key:'professionalDevelopment',
  titleKey:'pdPrograms',
  icon:'book',
  fields:[
    F('title',L('د پروګرام سرلیک','عنوان برنامه'),'text',{required:true,span:2}),
    F('type',L('د روزنې ډول','نوع آموزش'),'select',{options:TYPES,required:true}),
    F('date',L('نېټه','تاریخ'),'date',{required:true}),
    F('location',L('ځای','مکان')),
    F('trainer',L('روزونکی','مربی')),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('memberIds',L('مسوول غړي','اعضا مسئول'),'msStore',{store:'members',labelKey:'fullName',subKey:'position'}),
    F('targetTeachers',L('هدف ښوونکي','معلمان هدف'),'textarea'),
    F('participants',L('د ګډونوالو شمېر','تعداد شرکت‌کنندگان'),'number',{min:0}),
    F('maleCount',L('د هلکانو شمېر','تعداد پسران'),'number',{min:0}),
    F('femaleCount',L('د نجونو شمېر','تعداد دختران'),'number',{min:0}),
    F('topics',L('موضوعات','موضوعات'),'textarea',{span:2}),
    F('objectives',L('موخې','اهداف'),'textarea',{span:2}),
    F('results',L('پایلې','نتایج'),'textarea',{span:2}),
    F('problems',L('ستونزې','مسائل'),'textarea',{span:2}),
    F('recommendations',L('وړاندیزونه','پیشنهادها'),'textarea',{span:2}),
    F('followUp',L('تعقیب','پیگیری'),'textarea',{span:2}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'title',label:L('سرلیک','عنوان'),render:r=>'<b>'+U.escapeHtml(r.title||'')+'</b>',cell:r=>r.title||''},
    {key:'type',label:L('ډول','نوع'),render:r=>r.type?('<span class="badge b-purple">'+U.t(r.type)+'</span>'): '',cell:r=>r.type?U.t(r.type):''},
    {key:'date',label:L('نېټه','تاریخ'),render:r=>r.date?U.fmtDate(r.date):'',cell:r=>r.date?U.fmtDate(r.date):''},
    {key:'trainer',label:L('روزونکی','مربی'),cell:r=>r.trainer||''},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>pdScope(r.schoolIds),cell:r=>pdScopeText(r.schoolIds)},
    {key:'memberIds',label:L('غړي','اعضا'),render:r=>pdMembers(r.memberIds),cell:r=>pdMembersText(r.memberIds)},
    {key:'participants',label:L('ګډونوال','شرکت‌کنندگان'),render:r=>r.participants?(('<span class="num">'+U.num(r.participants)+'</span> '+miniGender(r))):'',cell:r=>Number(r.participants||0)}
  ],
  searchKeys:['title','trainer','topics'],
  filters:[
    {key:'type',label:L('ډول','نوع'),type:'select',options:TYPES},
    {key:'memberId',label:L('غړی','عضو'),type:'memberflt',match:(r,v)=>(r.memberIds||[]).includes(v)},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolflt',match:(r,v)=>(r.schoolIds||[]).includes(v)}
  ],
  sort:{key:'date',dir:'desc'},
  print: printPD
};

/* ---------------- learning circles ---------------- */
const CCFG={
  key:'learningCircles',
  titleKey:'navLearningCircles',
  icon:'users',
  fields:[
    F('topic',L('د حلقې موضوع','موضوع حلقه'),'text',{required:true,span:2}),
    F('memberIds',L('مسئول علمي غړي','اعضای علمی مسئول'),'msStore',{store:'members',labelKey:'fullName',subKey:'position',required:true}),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('teacherCount',L('د ښوونکو شمېر','تعداد معلمان'),'number',{required:true,min:0}),
    F('maleCount',L('د هلکانو ښوونکو شمېر','تعداد معلمان پسران'),'number',{min:0}),
    F('femaleCount',L('د نجونو ښوونکو شمېر','تعداد معلمان دختران'),'number',{min:0}),
    F('sessions',L('د غونډو شمېر','تعداد جلسات'),'number',{min:0}),
    F('frequency',L('د غونډو موده','بافت جلسات'),'select',{options:LC_FREQ}),
    F('startDate',L('د پیل نېټه','تاریخ شروع'),'date',{required:true}),
    F('endDate',L('د پای نېټه','تاریخ پایان'),'date'),
    F('status',L('حالت','وضعیت'),'select',{options:LC_STATUS}),
    F('objectives',L('د حلقې موخې','اهداف حلقه'),'textarea',{span:2}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'topic',label:L('موضوع','موضوع'),render:r=>'<b>'+U.escapeHtml(r.topic||'')+'</b>',cell:r=>r.topic||''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>r.status?U.badge(r.status):'',cell:r=>r.status?U.statusLabel(r.status):''},
    {key:'memberIds',label:L('مسئول غړي','اعضا مسئول'),render:r=>pdMembers(r.memberIds),cell:r=>pdMembersText(r.memberIds)},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>pdScope(r.schoolIds),cell:r=>pdScopeText(r.schoolIds)},
    {key:'teacherCount',label:L('ښوونکي','معلمان'),render:r=>r.teacherCount?('<span class="num">'+U.num(r.teacherCount)+'</span> '+miniGender(r)):'',cell:r=>Number(r.teacherCount||0)},
    {key:'sessions',label:L('غونډې','جلسات'),render:r=>r.sessions?(U.num(r.sessions)+(r.frequency?' <span class="muted small">('+U.t(r.frequency)+')</span>':'')):'',cell:r=>Number(r.sessions||0)},
    {key:'startDate',label:L('د پیل نېټه','تاریخ شروع'),render:r=>r.startDate?U.fmtDate(r.startDate):'',cell:r=>r.startDate?U.fmtDate(r.startDate):''}
  ],
  searchKeys:['topic','objectives','notes'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:LC_STATUS},
    {key:'memberId',label:L('غړی','عضو'),type:'memberflt',match:(r,v)=>(r.memberIds||[]).includes(v)},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolflt',match:(r,v)=>(r.schoolIds||[]).includes(v)}
  ],
  sort:{key:'startDate',dir:'desc'},
  print: printCircle
};

function miniGender(r){
  const m=r.maleCount, f=r.femaleCount;
  if(!m && !f) return '';
  return '<span class="muted small">('+(m?U.num(m)+' '+U.t('male'):'')+(m&&f?'، ':'')+(f?U.num(f)+' '+U.t('female'):'')+') </span>';
}
function pdScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function pdScopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function pdMembers(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__memberName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function pdMembersText(ids){
  if(!ids||!ids.length) return U.t('entireTeam');
  return (ids.map(i=>(window.__memberName||{})[i]).filter(Boolean)).join(', ');
}

let ACTIVE_TAB='programs';

async function prep(){
  const [mopts,sopts]=await Promise.all([optionsFromStore('members','fullName'),optionsFromStore('schools','name')]);
  [CFG,CCFG].forEach(cfg=>cfg.filters.forEach(f=>{
    if(f.type==='memberflt') f.options=mopts.map(o=>({v:o.id,ps:o.label,fa:o.label}));
    if(f.type==='schoolflt') f.options=sopts.map(o=>({v:o.id,ps:o.label,fa:o.label}));
  }));
}

register('profdev', {render: async (id, params)=>{
  Nav.setActive('profdev');
  await prep();
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  const view=document.getElementById('view');

  /* deep links: new record / new circle */
  if(id==='new'){ CRUD.openForm(CFG, {date:U.todayISO(), schoolIds:(params&&params.school)?[params.school]:[]}); return; }
  if(id==='circle-new'){ CRUD.openForm(CCFG, {startDate:U.todayISO(), status:'lc_planned', schoolIds:(params&&params.school)?[params.school]:[]}); return; }
  if(id==='circles'){ ACTIVE_TAB='circles'; }

  const [progs,circles]=await Promise.all([DB.getAll('professionalDevelopment'),DB.getAll('learningCircles')]);
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navProfDev')}]);

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('book')+'</div>'+
      '<div><h1>'+U.t('navProfDev')+'</h1><div class="ph-sub">'+U.t('profDevSub')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-primary" id="pdAddProg">'+U.icon('plus')+U.t('newProgram')+'</button>'+
        '<button class="btn btn-outline" id="pdAddCircle">'+U.icon('plus')+U.t('newCircle')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="tabs mb-3" id="pdTabs">'+
      '<button class="tab'+(ACTIVE_TAB==='programs'?' active':'')+'" data-tab="programs">'+U.icon('book')+' '+U.t('pdPrograms')+' <span class="count-chip" style="margin:0 4px"><b>'+U.num(progs.length)+'</b></span></button>'+
      '<button class="tab'+(ACTIVE_TAB==='circles'?' active':'')+'" data-tab="circles">'+U.icon('users')+' '+U.t('navLearningCircles')+' <span class="count-chip" style="margin:0 4px"><b>'+U.num(circles.length)+'</b></span></button>'+
    '</div>'+
    '<div id="tab-programs"'+(ACTIVE_TAB==='circles'?' hidden':'')+'></div>'+
    '<div id="tab-circles"'+(ACTIVE_TAB==='programs'?' hidden':'')+'></div>';

  document.getElementById('pdAddProg').addEventListener('click', ()=>CRUD.openForm(CFG, {date:U.todayISO()}));
  document.getElementById('pdAddCircle').addEventListener('click', ()=>CRUD.openForm(CCFG, {startDate:U.todayISO(), status:'lc_planned'}));
  document.querySelectorAll('#pdTabs [data-tab]').forEach(b=>b.addEventListener('click', async ()=>{
    ACTIVE_TAB=b.dataset.tab;
    document.querySelectorAll('#pdTabs [data-tab]').forEach(x=>x.classList.toggle('active', x===b));
    document.getElementById('tab-programs').hidden = ACTIVE_TAB!=='programs';
    document.getElementById('tab-circles').hidden = ACTIVE_TAB!=='circles';
    if(ACTIVE_TAB==='circles' && !window.__circlesRendered) await CRUD.renderTab(CCFG, document.getElementById('tab-circles'));
    if(ACTIVE_TAB==='programs' && !window.__progsRendered) await CRUD.renderTab(CFG, document.getElementById('tab-programs'));
  }));

  window.__progsRendered=false; window.__circlesRendered=false;
  if(ACTIVE_TAB==='circles'){ await CRUD.renderTab(CCFG, document.getElementById('tab-circles')); window.__circlesRendered=true; }
  else { await CRUD.renderTab(CFG, document.getElementById('tab-programs')); window.__progsRendered=true; }
}});

async function printPD(p){
  const totalP=Number(p.participants||0);
  const m=Number(p.maleCount||0), f=Number(p.faleCount||p.femaleCount||0);
  const doc=await PrintDoc.officialDoc({
    seqType:'pd',
    title: U.t('navProfDev')+' — '+U.t('official'),
    sub: p.title,
    meta:[{k:U.t('trainingType'),v:p.type?U.t(p.type):''},{k:U.t('documentDate'),v:p.date?U.fmtDate(p.date):''}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('programTitle'),v:p.title,full:true},{k:U.t('trainingType'),v:p.type?U.t(p.type):''},
        {k:U.t('date'),v:p.date?U.fmtDate(p.date):''},{k:U.t('location2'),v:p.location},
        {k:U.t('trainer'),v:p.trainer},{k:U.t('targetTeachers'),v:p.targetTeachers,full:true},
        {k:U.t('schoolIds'),v:pdScopeText(p.schoolIds),full:true},
        {k:U.t('memberIds'),v:pdMembersText(p.memberIds),full:true}
      ])},
      {heading:U.t('participants'), html: PrintDoc.table(
        [L('جنس','جنسیت'),L('شمېر','تعداد'),L('سلنه','درصد')],
        [[U.t('male'),m,totalP?Math.round(m/totalP*100)+'%':''],
         [U.t('female'),f,totalP?Math.round(f/totalP*100)+'%':''],
         [U.t('total'),totalP,'100%']],
        {numCols:[1,2], totals:[U.t('total'),totalP,'']}
      )},
      {heading:U.t('topics')+' / '+U.t('objectives'), html: PrintDoc.kv([
        {k:U.t('topics'),v:p.topics,full:true},{k:U.t('objectives'),v:p.objectives,full:true}
      ])},
      {heading:U.t('results'), html: PrintDoc.para(p.results||'')},
      {heading:U.t('problems'), html: PrintDoc.para(p.problems||'')},
      {heading:U.t('recommendations')+' / '+U.t('followUp'), html: PrintDoc.kv([
        {k:U.t('recommendations'),v:p.recommendations,full:true},{k:U.t('followUp'),v:p.followUp,full:true},
        {k:U.t('notes'),v:p.notes,full:true}
      ])}
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

async function printCircle(c){
  const doc=await PrintDoc.officialDoc({
    seqType:'lc',
    title: U.t('navLearningCircles')+' — '+U.t('official'),
    sub: c.topic,
    meta:[{k:U.t('status'),v:c.status?U.statusLabel(c.status):''},{k:U.t('documentDate'),v:c.startDate?U.fmtDate(c.startDate):''}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:L('د حلقې موضوع','موضوع حلقه'),v:c.topic,full:true},
        {k:U.t('status'),v:c.status?U.statusLabel(c.status):''},
        {k:L('د غونډو موده','بافت جلسات'),v:c.frequency?U.t(c.frequency):''},
        {k:L('د غونډو شمېر','تعداد جلسات'),v:c.sessions?U.num(c.sessions):''},
        {k:L('د پیل نېټه','تاریخ شروع'),v:c.startDate?U.fmtDate(c.startDate):''},
        {k:L('د پای نېټه','تاریخ پایان'),v:c.endDate?U.fmtDate(c.endDate):''},
        {k:U.t('memberIds'),v:pdMembersText(c.memberIds),full:true},
        {k:U.t('schoolIds'),v:pdScopeText(c.schoolIds),full:true}
      ])},
      {heading:L('د ښوونکو شمېر','تعداد معلمان'), html: PrintDoc.table(
        [L('جنس','جنسیت'),L('شمېر','تعداد')],
        [[U.t('male'),Number(c.maleCount||0)],[U.t('female'),Number(c.femaleCount||0)],[U.t('total'),Number(c.teacherCount||0)]],
        {numCols:[1], totals:[U.t('total'),Number(c.teacherCount||0)]}
      )},
      {heading:L('د حلقې موخې','اهداف حلقه'), html: PrintDoc.para(c.objectives||'')},
      {heading:U.t('notes'), html: PrintDoc.para(c.notes||'')}
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.ProfDevModule={CFG, CCFG, TYPES, LC_STATUS, LC_FREQ, printPD, printCircle};
})();
