/* =====================================================================
   monitoring.js — school monitoring visits with graded aspects
   (administration, teacher status, attendance, teaching quality,
   tashkil, facilities, books), findings, problems, recommendations.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const STATUS=[
  {v:'mng_planned',ps:'پلان شوې',fa:'برنامه‌ریزی شده'},{v:'mng_done',ps:'بشپړه',fa:'انجام شده'},
  {v:'mng_follow',ps:'تر تعقیب لاندې',fa:'در پیگیری'}
];
const RATINGS=['rg_good','rg_mid','rg_bad'];

const CFG={
  key:'monitoring',
  titleKey:'navMonitoring',
  icon:'clipboardCheck',
  fields:[
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name',required:true}),
    F('date',L('نېټه','تاریخ'),'date',{required:true}),
    F('memberIds',L('علمي غړي','اعضا علمی'),'msStore',{store:'members',labelKey:'fullName',subKey:'position'}),
    F('purpose',L('د څارنې موخه','هدف پایش'),'textarea',{span:2,required:true}),
    F('administration',L('اداره','اداریه'),'rating'),
    F('teacherStatus',L('د ښوونکو حالت','وضعیت معلمان'),'rating'),
    F('attendance',L('حضور','حضور'),'rating'),
    F('teachingQuality',L('د تدریس کیفیت','کیفیت تدریس'),'rating'),
    F('tashkil',L('تشکیل','ساخت'),'rating'),
    F('facilities',L('وسایل','تجهیزات'),'rating'),
    F('books',L('کتابونه / مواد','کتاب‌ها / مواد'),'rating'),
    F('studentStats',L('د زده کوونکو احصایې','آمار دانش‌آموزان'),'textarea'),
    F('problems',L('ستونزې','مسائل'),'textarea',{span:2}),
    F('findings',L('موندنې','یافته‌ها'),'textarea',{span:2}),
    F('recommendations',L('وړاندیزونه','پیشنهادها'),'textarea',{span:2}),
    F('requiredActions',L('اړین فعالیتونه','اقدامات لازم'),'textarea',{span:2}),
    F('followUp',L('تعقیب','پیگیری'),'textarea',{span:2}),
    F('status',L('حالت','وضعیت'),'select',{options:STATUS}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'_s',label:L('ښوونځي','مدارس'),render:r=>monScope(r.schoolIds),cell:r=>monScopeText(r.schoolIds)},
    {key:'date',label:L('نېټه','تاریخ'),render:r=>r.date?U.fmtDate(r.date):'',cell:r=>r.date?U.fmtDate(r.date):''},
    {key:'memberIds',label:L('غړي','اعضا'),render:r=>monMembers(r.memberIds),cell:r=>monMembersText(r.memberIds)},
    {key:'teachingQuality',label:L('د تدریس کیفیت','کیفیت تدریس'),render:r=>ratingBadge(r.teachingQuality),cell:r=>ratingLabel(r.teachingQuality)},
    {key:'facilities',label:L('وسایل','تجهیزات'),render:r=>ratingBadge(r.facilities),cell:r=>ratingLabel(r.facilities)},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'mng_done'),cell:r=>U.statusLabel(r.status||'mng_done')}
  ],
  searchKeys:['purpose','findings','problems'],
  filters:[
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:STATUS},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolflt',match:(r,v)=>(r.schoolIds||[]).includes(v)},
    {key:'memberId',label:L('غړی','عضو'),type:'memberflt',match:(r,v)=>(r.memberIds||[]).includes(v)}
  ],
  sort:{key:'date',dir:'desc'},
  print: printMonitoring
};

function ratingBadge(r){
  if(!r) return '—';
  const s=U.STATUS['rg_'+r];
  return '<span class="badge '+(r==='good'?'b-green':r==='mid'?'b-orange':'b-red')+'"><span class="dot"></span>'+(U.currentLang()==='fa'?s.fa:s.ps)+'</span>';
}
function ratingLabel(r){
  if(!r) return '';
  const s=U.STATUS['rg_'+r];
  return U.currentLang()==='fa'?s.fa:s.ps;
}
function monScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function monScopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function monMembers(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__memberName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function monMembersText(ids){
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

register('monitoring', {render: async (id, params)=>{
  Nav.setActive('monitoring');
  await prep();
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){
    CRUD.openForm(CFG, {date:U.todayISO(), schoolIds:(params&&params.school)?[params.school]:[]});
    return;
  }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navMonitoring')}]);
  await CRUD.renderList(CFG);
}});

/* generic detail with all fields */
CFG.detail = async (rec)=>{
  const fields=CFG.fields;
  const head='<div class="detail-head"><div class="dh-avatar">M</div><div><h2>'+U.escapeHtml(monScopeText(rec.schoolIds))+'</h2><div class="dh-sub">'+U.fmtDate(rec.date)+'</div></div></div>';
  const pairs=[];
  for(const f of fields){
    let v=rec[f.key];
    if(f.type==='msStore'){
      if(f.store==='schools') v=monScopeText(rec.schoolIds);
      else v=monMembersText(rec.memberIds);
    }
    if(f.type==='rating') v=v?ratingLabel(v):'';
    if(f.type==='date') v=v?U.fmtDate(v):'';
    if(f.type==='select') v=U.statusLabel(v);
    pairs.push({k:f.label, v, full: f.span===2||f.type==='textarea'});
  }
  return head+UI.detailKV(pairs);
};

async function printMonitoring(m){
  const kv=[
    {k:U.t('schoolIds'),v:monScopeText(m.schoolIds),full:true},
    {k:U.t('date'),v:m.date?U.fmtDate(m.date):''},{k:U.t('memberIds'),v:monMembersText(m.memberIds),full:true},
    {k:U.t('purposeVisit'),v:m.purpose,full:true}
  ];
  const ratings=[
    {k:U.t('admin'),v:m.administration},{k:U.t('teacherStatus'),v:m.teacherStatus},
    {k:U.t('attendance'),v:m.attendance},{k:U.t('teachingQuality'),v:m.teachingQuality},
    {k:U.t('tashkil'),v:m.tashkil},{k:U.t('facilities'),v:m.facilities},{k:U.t('books'),v:m.books}
  ];
  const doc=await PrintDoc.officialDoc({
    seqType:'monitoring',
    title: U.t('navMonitoring')+' — '+U.t('official'),
    sub: monScopeText(m.schoolIds),
    meta:[{k:U.t('status'),v:U.statusLabel(m.status||'mng_done')}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv(kv)},
      {heading:U.t('analysis'), html: PrintDoc.kv(ratings.map(r=>({k:r.k, v:ratingLabel(r.v)})))},
      {heading:U.t('studentStats'), html: PrintDoc.para(m.studentStats||'')},
      {heading:U.t('problems'), html: PrintDoc.para(m.problems||'')},
      {heading:U.t('findings'), html: PrintDoc.para(m.findings||'')},
      {heading:U.t('recommendations')+' / '+U.t('requiredActions'), html: PrintDoc.kv([
        {k:U.t('recommendations'),v:m.recommendations,full:true},
        {k:U.t('requiredActions'),v:m.requiredActions,full:true}
      ])},
      {heading:U.t('followUp')+' / '+U.t('notes'), html: PrintDoc.kv([
        {k:U.t('followUp'),v:m.followUp,full:true},{k:U.t('notes'),v:m.notes,full:true}
      ])}
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.MonitoringModule={CFG, printMonitoring, view: async (rec)=>{ CRUD.openDetail(CFG, rec); }};
})();
