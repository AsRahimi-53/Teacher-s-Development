/* =====================================================================
   teachers.js — teacher management + teacher profile with complete
   observation history and 1–4 observation progress.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const GENDER_OPTS=[{v:'boys',ps:'نارینه',fa:'مرد'},{v:'girls',ps:'ښځینه',fa:'زن'}];
const E_STATUS=[
  {v:'e_active',ps:'فعال',fa:'فعال'},{v:'e_inactive',ps:'غیر فعال',fa:'غیرفعال'},
  {v:'e_leave',ps:'رخصت',fa:'مرخصی'},{v:'e_other',ps:'نور',fa:'سایر'}
];
const EDU_OPTS=[
  {v:'eduBaccalaureate',ps:'بکلوریا',fa:'بکلوریا'},{v:'eduAssociate',ps:'فوق بکلوریا',fa:'فوق بکلوریا'},
  {v:'eduBachelor',ps:'لیسانس',fa:'لیسانس'},{v:'eduMaster',ps:'ماسټر',fa:'ماستر'}
];

const CFG={
  key:'teachers',
  titleKey:'navTeachers',
  icon:'gradcap',
  fields:[
    F('fullName',L('بشپړ نوم','نام کامل'),'text',{required:true}),
    F('fatherName',L('د پلار نوم','نام پدر')),
    F('grandfatherName',L('د نیکه نوم','نام پدربزرگ')),
    F('employeeId',L('د تذکرې نمبر','نمبر تذکره')),
    F('gender',L('جنسیت','جنسیت'),'select',{options:GENDER_OPTS,required:true}),
    F('dob',L('د زېږون نېټه','تاریخ تولد'),'date'),
    F('schoolId',L('ښوونځی','مدرسه'),'store',{store:'schools',labelKey:'name',required:true}),
    F('position',L('دنده','سمت')),
    F('subject',L('مضمون','مضمون'),{required:true}),
    F('specialization',L('تخصص','تخصص')),
    F('education',L('زده کړیزه درجه','مدرک تحصیلی'),'select',{options:EDU_OPTS}),
    F('profQual',L('مسلکي زده کړه','مدرک تخصصی')),
    F('experience',L('د تدریس تجربه (کال)','سابقه تدریس (سال)'),'number',{min:0,max:60}),
    F('appointmentDate',L('د مقررېدو نېټه','تاریخ انتصاب'),'date'),
    F('status',L('د کار حالت','وضعیت استخدام'),'select',{options:E_STATUS}),
    F('tashkilCode',L('تشکیل کوډ','کد تشکیل')),
    F('phone',L('تلیفون','تلفون'),'tel'),
    F('address',L('پته','آدرس')),
    F('photo',L('انځور','عکس'),'photo',{span:2,maxDim:300}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'_n',label:L('بشپړ نوم','نام'),cls:'cell-wide',render:r=>'<div class="cell-person">'+U.avatarHTML(r,36)+'<b>'+U.escapeHtml(r.fullName||'')+'</b></div>',cell:r=>r.fullName||''},
    {key:'school',label:L('ښوونځی','مدرسه'),cls:'cell-school',render:r=>U.escapeHtml(window.__schoolName?(window.__schoolName&&window.__schoolName[r.schoolId])||'':''),cell:r=>window.__schoolName?(window.__schoolName&&window.__schoolName[r.schoolId])||'':''},
    {key:'subject',label:L('مضمون','مضمون'),cls:'cell-subject',cell:r=>r.subject||''},
    {key:'gender',label:L('جنسیت','جنسیت'),render:r=>r.gender?U.badge('pg_'+r.gender):'',cell:r=>r.gender?U.statusLabel('pg_'+r.gender):''},
    {key:'education',label:L('زده کړه','تحصیلات'),render:r=>r.education?U.t(r.education):'',cell:r=>r.education?U.t(r.education):''},
    {key:'obs',label:L('څارنه','مشاهده'),render:r=>teacherObsDots(r.id),cell:r=>''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'e_active'),cell:r=>U.statusLabel(r.status||'e_active')}
  ],
  searchKeys:['fullName','fatherName','subject','phone','employeeId','specialization','tashkilCode'],
  filters:[
    {key:'gender',label:L('جنسیت','جنسیت'),type:'select',options:GENDER_OPTS},
    {key:'education',label:L('زده کړه','تحصیلات'),type:'select',options:EDU_OPTS},
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:E_STATUS},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolsel'},
    {key:'subject',label:L('مضمون','مضمون'),type:'text'}
  ],
  sort:{key:'fullName',dir:'asc'},
  print: printTeacher,
  beforeSave: async (rec)=>{
    // duplicate prevention: same employeeId in same school
    if(rec.employeeId){
      const all=await DB.getAll('teachers');
      const dup=all.find(x=>x.id!==rec.id && x.employeeId===rec.employeeId);
      if(dup) return U.t('invalidInput')+' — '+U.t('employeeId');
    }
    return null;
  }
};

let OBS_BY_TEACHER={};
async function loadObsMap(){
  const obs=await DB.getAll('observations');
  const m={};
  obs.forEach(o=>{ (m[o.teacherId]=m[o.teacherId]||[]).push(o); });
  OBS_BY_TEACHER=m;
}
function teacherObsDots(tid){
  const arr=(OBS_BY_TEACHER[tid]||[]);
  const max=Number(Settings.get().maxObsPerYear||4);
  return UI.obsDotsHTML(arr.slice().sort((a,b)=>a.observationNumber-b.observationNumber), max);
}

async function prep(){
  const opts=await optionsFromStore('schools','name');
  CFG.filters.forEach(f=>{ if(f.type==='schoolsel') f.options=opts.map(o=>({v:o.id,ps:o.label,fa:o.label})); });
}

register('teachers', {render: async (id, params)=>{
  Nav.setActive('teachers');
  await prep();
  await loadObsMap();
  const schools=await DB.getAll('schools');
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){ CRUD.openForm(CFG,{schoolId:(params&&params.school)||''}); return; }
  if(id) return renderTeacherPage(id);
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navTeachers')}]);
  await CRUD.renderList(CFG);
}});

/* ================= teacher profile + observation history ================= */
async function renderTeacherPage(id){
  const t=await DB.get('teachers',id);
  if(!t){ location.hash='#/teachers'; return; }
  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navTeachers'),route:'teachers'},{label:t.fullName}]);
  const schools=await DB.getAll('schools');
  const sch=schools.find(s=>s.id===t.schoolId);
  const obs=(OBS_BY_TEACHER[id]||[]).slice().sort((a,b)=>a.observationNumber-b.observationNumber);
  const maxObs=Number(Settings.get().maxObsPerYear||4);
  const year=Settings.get().academicYear;
  const obsYr=obs.filter(o=>String(o.academicYear)===String(year));

  const avg=obs.length?Math.round(obs.reduce((a,o)=>a+Number(o.percentage||0),0)/obs.length):0;
  const last=obs[obs.length-1];

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('gradcap')+'</div>'+
      '<div><h1>'+U.escapeHtml(t.fullName)+'</h1><div class="ph-sub">'+U.escapeHtml([sch?sch.name:'', t.subject].filter(Boolean).join(' — '))+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="tpPrint">'+U.icon('printer')+U.t('print')+'</button>'+
        '<button class="btn btn-outline" id="tpHistPrint">'+U.icon('file')+U.t('printHistory')+'</button>'+
        '<button class="btn btn-outline" id="tpEdit">'+U.icon('edit')+U.t('edit')+'</button>'+
        '<button class="btn btn-primary" id="tpNewObs">'+U.icon('eye')+U.t('newObs')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="grid-2 mb-3">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('detail')+'</h3></div><div class="card-body">'+
        UI.detailKV([
          {k:U.t('fatherName'),v:t.fatherName},{k:U.t('grandfatherName'),v:t.grandfatherName},
          {k:U.t('employeeId'),v:t.employeeId},{k:U.t('gender'),v:t.gender?U.statusLabel('pg_'+t.gender):''},
          {k:U.t('dateOfBirth'),v:t.dob?U.fmtDate(t.dob):''},
          {k:U.t('position'),v:t.position},{k:U.t('subject'),v:t.subject},
          {k:U.t('specialization'),v:t.specialization},{k:U.t('education'),v:t.education?U.t(t.education):''},
          {k:U.t('professionalQual'),v:t.profQual},{k:U.t('teachingExperience'),v:t.experience!==''&&t.experience!==undefined?U.num(t.experience):''},
          {k:U.t('appointmentDate'),v:t.appointmentDate?U.fmtDate(t.appointmentDate):''},
          {k:U.t('tashkilCode'),v:t.tashkilCode},{k:U.t('phone'),v:t.phone},
          {k:U.t('status'),v:U.badge(t.status||'e_active'),html:true},{k:U.t('address'),v:t.address,full:true},
          {k:U.t('notes'),v:t.notes,full:true}
        ])
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('obsProgress')+' — '+year+'</h3></div><div class="card-body">'+
        '<div class="flex mb-2" style="justify-content:center">'+UI.obsDotsHTML(obsYr, maxObs)+'</div>'+
        '<div class="stat-grid" style="grid-template-columns:1fr 1fr">'+
          '<div class="stat-card" style="cursor:default;--sc-bg:var(--primary-soft)"><div class="sc-icon">'+U.icon('eye')+'</div><div><div class="sc-num">'+U.num(obsYr.length)+'/'+maxObs+'</div><div class="sc-label">'+U.t('navObservations')+'</div></div></div>'+
          '<div class="stat-card" style="cursor:default;--sc-bg:'+(avg>=61?'var(--success-soft)':'var(--warning-soft)')+'"><div class="sc-icon">'+U.icon('trend')+'</div><div><div class="sc-num">'+(avg?U.num(avg)+'%':'—')+'</div><div class="sc-label">'+U.t('qualityLevel')+' ('+U.t('total')+')</div></div></div>'+
        '</div>'+
        (last?'<div class="mt-2 small muted">'+U.t('obsCompleted')+': '+U.fmtDate(last.date)+' — '+U.num(last.percentage||0)+'% '+Settings.qualityBadge(last.percentage||0)+'</div>':'')+
      '</div></div>'+
    '</div>'+
    '<div class="card"><div class="card-head"><h3>'+U.t('observationHistory')+' ('+U.num(obs.length)+')'+'</h3></div><div class="card-body">'+
      (obs.length?
        U.tableHTML(
          [
            {key:0,label:L('شمېره','شماره')},
            {key:1,label:L('نېټه','تاریخ')},
            {key:2,label:L('څارونکی','ناظر')},
            {key:3,label:L('مضمون','مضمون')},
            {key:4,label:L('ټولګی','کلاس')},
            {key:5,label:L('نمره','نمره')},
            {key:6,label:L('سلنه','درصد')},
            {key:7,label:L('کچه','کیفیت')},
            {key:8,label:L('ضعیف اړخونه','نقاط ضعف')},
            {key:9,label:L('وړاندیز','پیشنهاد')}
          ],
          obs.map(o=>({
            0:o.observationNumber,
            1:U.fmtDate(o.date),
            2:(window.__memberName||{})[o.observerId]||'',
            3:o.subject||'',
            4:o.className||'',
            5:(o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||''),
            6:(o.percentage!==undefined?U.num(o.percentage)+'%':''),
            7:Settings.qualityBadge(o.percentage||0),
            8:shorten(o.weaknesses,90),
            9:shorten(o.recommendations,90)
          })),
          (r,i)=>'<button class="icon-btn sm" data-ov="'+obs[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'
        )
      :U.emptyState('eye',U.t('noObs'),U.t('noDataSub'),'<button class="btn btn-primary" id="tpNewObs2">'+U.icon('eye')+U.t('newObs')+'</button>'))+
    '</div></div>';

  document.getElementById('tpEdit').addEventListener('click', ()=>CRUD.openForm(CFG,t));
  document.getElementById('tpPrint').addEventListener('click', ()=>printTeacher(t));
  document.getElementById('tpHistPrint').addEventListener('click', ()=>{ if(window.ObservationReports) ObservationReports.printTeacherHistory(t.id); });
  const newObs=()=>{ location.hash='#/observations/new?teacher='+id; };
  document.getElementById('tpNewObs').addEventListener('click', newObs);
  const n2=document.getElementById('tpNewObs2');
  if(n2) n2.addEventListener('click', newObs);
  view.querySelectorAll('[data-ov]').forEach(b=>{
    b.addEventListener('click', ()=>location.hash='#/observations/'+b.dataset.ov);
  });
}
function shorten(s,n){ if(!s) return ''; s=String(s); return s.length>n?s.slice(0,n-1)+'…':s; }

/* ================= print ================= */
async function printTeacher(t){
  const schools=await DB.getAll('schools');
  const members=await DB.getAll('members');
  const sch=schools.find(s=>s.id===t.schoolId);
  const obs=(OBS_BY_TEACHER[t.id]||[]).slice().sort((a,b)=>a.observationNumber-b.observationNumber);
  const byMember=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  const doc=await PrintDoc.officialDoc({
    seqType:'teacher',
    title: U.t('navTeachers')+' — '+U.t('official'),
    sub: t.fullName,
    meta:[{k:U.t('school'),v:sch?sch.name:''},{k:U.t('employeeId'),v:t.employeeId}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('fullName'),v:t.fullName},{k:U.t('fatherName'),v:t.fatherName},
        {k:U.t('grandfatherName'),v:t.grandfatherName},{k:U.t('employeeId'),v:t.employeeId},
        {k:U.t('gender'),v:t.gender?U.statusLabel('pg_'+t.gender):''},
        {k:U.t('dateOfBirth'),v:t.dob?U.fmtDate(t.dob):''},
        {k:U.t('school'),v:sch?sch.name:''},{k:U.t('position'),v:t.position},
        {k:U.t('subject'),v:t.subject},{k:U.t('specialization'),v:t.specialization},
        {k:U.t('education'),v:t.education?U.t(t.education):''},{k:U.t('professionalQual'),v:t.profQual},
        {k:U.t('teachingExperience'),v:t.experience},{k:U.t('appointmentDate'),v:t.appointmentDate?U.fmtDate(t.appointmentDate):''},
        {k:U.t('status'),v:U.statusLabel(t.status||'e_active')},{k:U.t('phone'),v:t.phone}
      ])},
      {heading:U.t('observationHistory'), html: obs.length?
        PrintDoc.table(
          [L('شمېره','شماره'),L('نېټه','تاریخ'),L('څارونکی','ناظر'),L('مضمون','مضمون'),L('نمره','نمره'),L('سلنه','درصد'),L('کچه','کیفیت'),L('ضعیف اړخونه','نقاط ضعف'),L('وړاندیز','پیشنهاد')],
          obs.map(o=>[o.observationNumber,U.fmtDate(o.date),byMember[o.observerId]||'',o.subject||'',
            (o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||''), (o.percentage||0)+'%',
            Settings.quality(o.percentage||0).ps, shorten(o.weaknesses,120), shorten(o.recommendations,120)]),
          {numCols:[0,5]}
        ):PrintDoc.para(U.t('noData'))}
    ],
    sigs:[U.t('headTeacher'),U.t('observer'),U.t('director')]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.TeachersModule={CFG, printTeacher, renderTeacherPage, loadObsMap, OBS_BY_TEACHER};
})();
