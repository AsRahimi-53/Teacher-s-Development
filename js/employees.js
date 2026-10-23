/* =====================================================================
   employees.js — school administrative & support staff.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const GENDER_OPTS=[{v:'boys',ps:'نارینه',fa:'مرد'},{v:'girls',ps:'ښځینه',fa:'زن'}];
const POS_OPTS=[
  {v:'posPrincipal',ps:'مدیر',fa:'مدیر'},{v:'posDeputy',ps:'مرستیال مدیر',fa:'معاون'},
  {v:'posAdmin',ps:'اداري کارکوونکی',fa:'کارمند اداری'},{v:'posClerk',ps:'دفتردار',fa:'دفتردار'},
  {v:'posAccountant',ps:'حسابدار',fa:'حسابدار'},{v:'posLibrarian',ps:'د کتابتون مسوول',fa:'مسئول کتابخانه'},
  {v:'posLab',ps:'د لابراتوار کارکوونکی',fa:'کارمند آزمایشگاه'},{v:'posGuard',ps:'ساتونکی',fa:'نگهبان'},
  {v:'posAmir',ps:'آمر',fa:'آمر'},{v:'posTeachingOfficer',ps:'تدریسي مامور',fa:'مامور تدریسی'},
  {v:'posExecutiveOfficer',ps:'اجرائیه مامور',fa:'مامور اجرائیوی'},
  {v:'posCleaner',ps:'پاکوونکی',fa:'نظافتچی'},{v:'posOther',ps:'نور',fa:'سایر'}
];
const E_STATUS=[
  {v:'e_active',ps:'فعال',fa:'فعال'},{v:'e_inactive',ps:'غیر فعال',fa:'غیرفعال'},
  {v:'e_leave',ps:'رخصت',fa:'مرخصی'},{v:'e_resigned',ps:'استعفا',fa:'استعفا'},{v:'e_other',ps:'نور',fa:'سایر'}
];
const EDU_OPTS=[
  {v:'eduBaccalaureate',ps:'بکلوریا',fa:'بکلوریا'},{v:'eduAssociate',ps:'فوق بکلوریا',fa:'فوق بکلوریا'},
  {v:'eduBachelor',ps:'لیسانس',fa:'لیسانس'},{v:'eduMaster',ps:'ماسټر',fa:'ماستر'}
];

const CFG={
  key:'employees',
  titleKey:'navEmployees',
  icon:'briefcase',
  fields:[
    F('fullName',L('بشپړ نوم','نام کامل'),'text',{required:true}),
    F('fatherName',L('د پلار نوم','نام پدر')),
    F('employeeId',L('د تذکرې نمبر','نمبر تذکره')),
    F('tashkilCode',L('تشکیل کوډ','کد تشکیل')),
    F('position',L('دنده','سمت'),'select',{options:POS_OPTS,required:true}),
    F('schoolId',L('ښوونځی','مدرسه'),'store',{store:'schools',labelKey:'name',required:true}),
    F('gender',L('جنسیت','جنسیت'),'select',{options:GENDER_OPTS}),
    F('education',L('زده کړه','تحصیلات'),'select',{options:EDU_OPTS}),
    F('specialization',L('تخصص','تخصص')),
    F('appointmentDate',L('د مقررېدو نېټه','تاریخ انتصاب'),'date'),
    F('phone',L('تلیفون','تلفون'),'tel'),
    F('status',L('د کار حالت','وضعیت استخدام'),'select',{options:E_STATUS}),
    F('photo',L('انځور','عکس'),'photo',{span:2,maxDim:300}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'_n',label:L('بشپړ نوم','نام'),cls:'cell-wide',render:r=>'<div class="cell-person">'+U.avatarHTML(r,36)+'<b>'+U.escapeHtml(r.fullName||'')+'</b></div>',cell:r=>r.fullName||''},
    {key:'school',label:L('ښوونځی','مدرسه'),cls:'cell-school',render:async()=>'',cell:null},
    {key:'position',label:L('دنده','سمت'),render:r=>r.position?U.t(r.position):'',cell:r=>r.position?U.t(r.position):''},
    {key:'gender',label:L('جنسیت','جنسیت'),render:r=>r.gender?U.badge('pg_'+r.gender):'',cell:r=>r.gender?U.statusLabel('pg_'+r.gender):''},
    {key:'phone',label:L('تلیفون','تلفون'),cell:r=>r.phone||''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'e_active'),cell:r=>U.statusLabel(r.status||'e_active')}
  ],
  searchKeys:['fullName','fatherName','position','phone','employeeId','tashkilCode'],
  filters:[
    {key:'position',label:L('دنده','سمت'),type:'select',options:POS_OPTS},
    {key:'gender',label:L('جنسیت','جنسیت'),type:'select',options:GENDER_OPTS},
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:E_STATUS},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolsel'}
  ],
  sort:{key:'fullName',dir:'asc'},
  print: printEmployee
};

async function prep(){
  const opts=await optionsFromStore('schools','name');
  CFG.filters.forEach(f=>{ if(f.type==='schoolsel') f.options=opts.map(o=>({v:o.id,ps:o.label,fa:o.label})); });
  // school column needs school name: decorate
  CFG.tableCols[1].render=(r)=>(window.__schoolName&&window.__schoolName[r.schoolId])||'';
  CFG.tableCols[1].cell=(r)=>(window.__schoolName&&window.__schoolName[r.schoolId])||'';
}

register('employees', {render: async (id, params)=>{
  Nav.setActive('employees');
  await prep();
  const schools=await DB.getAll('schools');
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){ CRUD.openForm(CFG,{schoolId:(params&&params.school)||''}); return; }
  if(id){
    const rec=await DB.get('employees',id);
    if(rec) return CRUD.openDetail(CFG,rec);
  }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navEmployees')}]);
  await CRUD.renderList(CFG);
}});

async function printEmployee(e){
  const schools=await DB.getAll('schools');
  const sch=schools.find(s=>s.id===e.schoolId);
  const doc=await PrintDoc.officialDoc({
    seqType:'employee',
    title: U.t('navEmployees')+' — '+U.t('official'),
    sub: e.fullName,
    meta:[{k:U.t('school'),v:sch?sch.name:''},{k:U.t('employeeId'),v:e.employeeId}],
    sections:[{heading:U.t('detail'), html: PrintDoc.kv([
      {k:U.t('fullName'),v:e.fullName},{k:U.t('fatherName'),v:e.fatherName},
      {k:U.t('employeeId'),v:e.employeeId},{k:U.t('tashkilCode'),v:e.tashkilCode},{k:U.t('position'),v:e.position?U.t(e.position):''},
      {k:U.t('school'),v:sch?sch.name:''},{k:U.t('gender'),v:e.gender?U.statusLabel('pg_'+e.gender):''},
      {k:U.t('education'),v:e.education?U.t(e.education):''},{k:U.t('specialization'),v:e.specialization},
      {k:U.t('appointmentDate'),v:e.appointmentDate?U.fmtDate(e.appointmentDate):''},
      {k:U.t('phone'),v:e.phone},{k:U.t('status'),v:U.statusLabel(e.status||'e_active')},
      {k:U.t('notes'),v:e.notes,full:true}
    ])}],
    sigs:[U.t('headTeacher'),U.t('reviewedBy')]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.EmployeesModule={CFG, printEmployee};
})();
