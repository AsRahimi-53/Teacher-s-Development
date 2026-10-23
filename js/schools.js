/* =====================================================================
   schools.js — School management (replaces any madrasa module).
   Full profile page with tabs: basic info, employees, teachers,
   student statistics, tashkil, observations, activities, monitoring,
   problems, recommendations, reports, statistics + quick actions.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const GENDER_TYPES=[{v:'g_boys',ps:'هلکانو',fa:'پسرانه'},{v:'g_girls',ps:'نجونو',fa:'دخترانه'},{v:'g_mixed',ps:'ګډ',fa:'مختلط'}];
const SCHOOL_STATUS=[
  {v:'s_active',ps:'فعال',fa:'فعال'},{v:'s_inactive',ps:'غیر فعال',fa:'غیرفعال'},
  {v:'s_temp',ps:'موقتي بند',fa:'موقتاً بسته'},{v:'s_other',ps:'نور',fa:'سایر'}
];

const CFG={
  key:'schools',
  titleKey:'navSchools',
  subKey:'tashkilSub',
  icon:'school',
  fields:[
    F('name',L('د ښوونځي نوم','نام مدرسه'),'text',{required:true}),
    F('code',L('د ښوونځي کوډ','کد مدرسه'),{required:true}),
    F('village',L('کلی / سیمه','روستا / ناحیه')),
    F('level',L('تعلیمي کچه','سطح تحصیلی'),'settingsopt',{opts:()=>Settings.schoolLevels(),required:true}),
    F('ownership',L('د ملکیت / ادارې ډول','نوع مالکیت/اداره'),'settingsopt',{opts:()=>Settings.schoolOwnershipTypes(),required:true}),
    F('genderType',L('جنسیتي ډول','نوع جنسیت'),'select',{options:GENDER_TYPES,required:true}),
    F('status',L('حالت','وضعیت'),'select',{options:SCHOOL_STATUS,required:true}),
    F('establishedYear',L('د تاسیس کال','سال تأسیس'),'number'),
    F('principal',L('مدیر','مدیر')),
    F('phone',L('د اړیکې شمېره','شماره تماس'),'tel'),
    F('location',L('ځای','موقعیت')),
    F('address',L('پته','آدرس'),'text',{span:2}),
    F('lat',L('عرض جغرافي','عرض جغرافیایی')),
    F('lng',L('طول جغرافي','طول جغرافیایی')),
    F('photo',L('د ښوونځي انځور','عکس مدرسه'),'photo',{span:2,maxDim:560}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'_name',label:L('د ښوونځي نوم','نام مدرسه'),
      cls:'cell-wide',
      render:r=>'<div class="cell-person">'+U.avatarHTML(r,38)+'<div class="cell-strong">'+U.escapeHtml(r.name||'')+'</div></div>',
      cell:r=>r.name||''},
    {key:'code',label:L('د ښوونځي کوډ','کد مدرسه'),cls:'cell-code',
      render:r=>r.code?'<span class="code-chip">'+U.escapeHtml(r.code)+'</span>':'—',cell:r=>r.code||''},
    {key:'village',label:L('کلی / سیمه','روستا / ناحیه'),cls:'cell-nowrap',cell:r=>r.village||''},
    {key:'level',label:L('تعلیمي کچه','سطح تحصیلی'),render:r=>r.level?'<span class="badge b-teal">'+U.escapeHtml(U.tv(r.level))+'</span>':'',cell:r=>U.tv(r.level)||''},
    {key:'ownership',label:L('ملکیت / ادارې ډول','مالکیت / اداره'),render:r=>r.ownership?'<span class="badge b-blue">'+U.escapeHtml(U.tv(r.ownership))+'</span>':'',cell:r=>U.tv(r.ownership)||''},
    {key:'genderType',label:L('جنسیتي ډول','نوع جنسیت'),render:r=>r.genderType?U.badge(r.genderType):'',cell:r=>r.genderType?U.statusLabel(r.genderType):''},
    {key:'principal',label:L('مدیر','مدیر'),cell:r=>r.principal||''},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'s_active'),cell:r=>U.statusLabel(r.status||'s_active')}
  ],
  searchKeys:['name','code','village','principal'],
  filters:[
    {key:'level',label:L('تعلیمي کچه','سطح تحصیلی'),type:'storeopts',src:'levels'},
    {key:'ownership',label:L('ملکیت / ادارې ډول','مالکیت / اداره'),type:'storeopts',src:'ownership'},
    {key:'genderType',label:L('جنسیتي ډول','نوع جنسیت'),type:'select',options:GENDER_TYPES},
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:SCHOOL_STATUS}
  ],
  sort:{key:'name',dir:'asc'},
  print: printSchool
};

/* fix dynamic filters (school level + ownership from settings) */
async function prepFilters(){
  const levels=Settings.schoolLevels();
  const owns=Settings.schoolOwnershipTypes();
  CFG.filters.forEach(f=>{
    if(f.src==='levels'){ f.options=levels.map(t=>({v:t.ps, ps:t.ps, fa:t.fa})); }
    if(f.src==='ownership'){ f.options=owns.map(t=>({v:t.ps, ps:t.ps, fa:t.fa})); }
  });
  // match by localized value
  CFG.filters.forEach(f=>{
    if(f.key==='level'){ f.match=(r,v)=>U.tv(r.level)===v; }
    if(f.key==='ownership'){ f.match=(r,v)=>U.tv(r.ownership)===v; }
  });
}

register('schools', {render: async (id)=>{
  Nav.setActive('schools');
  await prepFilters();
  if(id==='new'){ CRUD.openForm(CFG,{}); return; }
  if(id) await renderProfile(id);
  else {
    Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navSchools')}]);
    await CRUD.renderList(CFG);
  }
}});

/* ================= PROFILE PAGE ================= */
const TABS=[
  {key:'basic',   label:L('بنسټیز معلومات','اطلاعات پایه'),      icon:'info'},
  {key:'staff',   label:L('کارکوونکي','کارکنان'),               icon:'briefcase'},
  {key:'teachers',label:L('ښوونکي','معلمان'),                   icon:'gradcap'},
  {key:'students',label:L('د زده کوونکو احصایې','آمار دانش‌آموزان'),icon:'chart'},
  {key:'tashkil', label:L('تشکیل','تأسیسات'),                   icon:'layers'},
  {key:'obs',     label:L('د تدریس څارنه','مشاهده تدریس'),       icon:'eye'},
  {key:'acts',    label:L('فعالیتونه','فعالیت‌ها'),             icon:'activity'},
  {key:'mon',     label:L('څارنه','پایش'),                       icon:'clipboardCheck'},
  {key:'problems',label:L('ستونزې او موندنې','مسائل و یافته‌ها'),icon:'alert'},
  {key:'reports', label:L('راپورونه','گزارش‌ها'),                icon:'file'},
  {key:'stats',   label:L('احصایې','آمار'),                      icon:'pie'}
];

let PROFILE={id:null, tab:'basic'};

async function renderProfile(id){
  const s=await DB.getAll('schools');
  const school=s.find(x=>x.id===id);
  if(!school){ location.hash='#/schools'; return; }
  PROFILE={id, tab:PROFILE.tab||'basic'};
  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navSchools'),route:'schools'},{label:school.name}]);

  const teachers=(await DB.getAll('teachers')).filter(t=>t.schoolId===id);
  const employees=(await DB.getAll('employees')).filter(e=>e.schoolId===id);
  const stats=(await DB.getAll('studentStats')).filter(x=>x.schoolId===id);
  const totalStudents=window.StudentStatsModule?StudentStatsModule.totals(stats).t:0;

  view.innerHTML =
    '<div class="official-band">'+
      '<div class="ob-logo">'+(school.photo?'<img src="'+school.photo+'" alt="">':U.icon('school'))+'</div>'+
      '<div class="ob-main">'+
        '<div class="ob-line">'+U.escapeHtml(school.name)+' <span class="badge b-gray">'+U.escapeHtml(school.code||'')+'</span> '+U.badge(school.status||'s_active')+'</div>'+
        '<div class="ob-sub">'+[school.village, school.level?U.tv(school.level):'', school.ownership?U.tv(school.ownership):'', school.genderType?U.statusLabel(school.genderType):''].filter(Boolean).join(' — ')+'</div>'+
      '</div>'+
      '<div class="ob-year">'+U.t('academicYear')+' — '+(Settings.get().academicYear||'')+'</div>'+
    '</div>'+
    '<div class="card mb-3"><div class="card-body">'+
      '<div class="qa-grid">'+
        qa('eye',U.t('newObs'),'#/observations/new?school='+id)+
        qa('clipboardCheck',U.t('navMonitoring'),'#/monitoring/new?school='+id)+
        qa('activity',U.t('navActivities'),'#/activities/new?school='+id)+
        qa('book',U.t('navProfDev'),'#/profdev/new?school='+id)+
        qa('gradcap',U.t('navTeachers'),'#/teachers/new?school='+id)+
        qa('briefcase',U.t('navEmployees'),'#/employees/new?school='+id)+
        qa('chart',U.t('navStudents'),'#/students/new?school='+id)+
        qa('layers',U.t('navTashkil'),'#/tashkil?school='+id)+
      '</div>'+
    '</div></div>'+
    '<div class="tabs" id="schoolTabs">'+
      TABS.map(t=>'<button class="tab'+(PROFILE.tab===t.key?' active':'')+'" data-tab="'+t.key+'">'+U.icon(t.icon)+U.tv(t.label)+'</button>').join('')+
    '</div>'+
    '<div id="schoolTabContent"></div>';

  view.querySelectorAll('#schoolTabs .tab').forEach(b=>{
    b.addEventListener('click', ()=>{ PROFILE.tab=b.dataset.tab; view.querySelectorAll('#schoolTabs .tab').forEach(x=>x.classList.toggle('active',x===b)); renderTabContent(); });
  });
  view.querySelectorAll('.qa-item').forEach(q=>{
    q.addEventListener('click', ()=>{ location.hash=q.dataset.go; });
  });
  renderTabContent();
}

function qa(icon,label,go){
  return '<div class="qa-item" data-go="'+go+'"><div class="qa-ico">'+U.icon(icon)+'</div><span>'+label+'</span></div>';
}

async function renderTabContent(){
  const box=document.getElementById('schoolTabContent');
  if(!box) return;
  const id=PROFILE.id;
  const schools=await DB.getAll('schools');
  const school=schools.find(x=>x.id===id);
  if(!school) return;
  const teachers=(await DB.getAll('teachers')).filter(t=>t.schoolId===id);
  const employees=(await DB.getAll('employees')).filter(e=>e.schoolId===id);
  const stats=(await DB.getAll('studentStats')).filter(x=>x.schoolId===id);
  const tash=await window.TashkilModule.forSchool(id);
  const members=await DB.getAll('members');
  const byMember=Object.fromEntries(members.map(m=>[m.id,m]));
  const byTeacher=Object.fromEntries(teachers.map(t=>[t.id,t]));
  const allObs=await DB.getAll('observations');
  const sObs=allObs.filter(o=>byTeacher[o.teacherId]);
  const acts=(await DB.getAll('activities')).filter(a=>(a.schoolIds||[]).includes(id));
  const pd=(await DB.getAll('professionalDevelopment')).filter(a=>(a.schoolIds||[]).includes(id));
  const mon=(await DB.getAll('monitoring')).filter(m=>(m.schoolIds||[]).includes(id));
  const duties=(await DB.getAll('duties')).filter(m=>(m.schoolIds||[]).includes(id));
  const reports=(await DB.getAll('reports')).filter(r=>(r.scope&&r.scope.schoolIds||[]).includes(id));

  let html='';
  switch(PROFILE.tab){
    case 'basic': {
      html='<div class="card"><div class="card-body">'+
        '<div class="flex mb-2" style="align-items:flex-start">'+
          (school.photo?'<img src="'+school.photo+'" style="width:120px;height:120px;object-fit:cover;border-radius:12px" alt="">':'')+
          '<div class="grow">'+UI.detailKV([
            {k:U.t('schoolName'),v:school.name},{k:U.t('schoolCode'),v:school.code},
            {k:U.t('village'),v:school.village},
            {k:U.t('schoolLevel'),v:U.tv(school.level)},
            {k:U.t('ownership'),v:U.tv(school.ownership)},
            {k:U.t('genderType'),v:school.genderType?U.statusLabel(school.genderType):''},
            {k:U.t('status'),v:U.badge(school.status||'s_active'),html:true},
            {k:U.t('establishedYear'),v:school.establishedYear},{k:U.t('principal'),v:school.principal},
            {k:U.t('contactNumber'),v:school.phone},{k:U.t('location'),v:school.location},
            {k:U.t('lat'),v:school.lat},{k:U.t('lng'),v:school.lng},
            {k:U.t('address'),v:school.address,full:true},
            {k:U.t('notes'),v:school.notes,full:true}
          ])+'</div>'+
        '</div>'+
        '<div class="flex mt-2">'+
          '<button class="btn btn-outline btn-sm" data-act="edit">'+U.icon('edit')+U.t('edit')+'</button>'+
          '<button class="btn btn-outline btn-sm" data-act="print">'+U.icon('printer')+U.t('print')+'</button>'+
        '</div>'+
      '</div></div>';
      break;
    }
    case 'staff': {
      const cols=[
        {key:'_n',label:L('بشپړ نوم','نام'),render:r=>U.avatarHTML(r,36)+' '+U.escapeHtml(r.fullName||'')},
        {key:'position',label:L('دنده','سمت'),render:r=>r.position?U.t(r.position):''},
        {key:'gender',label:L('جنسیت','جنسیت'),render:r=>r.gender?U.badge('pg_'+r.gender):''},
        {key:'phone',label:L('تلیفون','تلفون')},
        {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'e_active')}
      ];
      html=tableOrEmpty('staff',cols,employees,'briefcase');
      break;
    }
    case 'teachers': {
      const cols=[
        {key:'_n',label:L('بشپړ نوم','نام'),render:r=>U.avatarHTML(r,36)+' '+U.escapeHtml(r.fullName||'')},
        {key:'subject',label:L('مضمون','مضمون')},
        {key:'gender',label:L('جنسیت','جنسیت'),render:r=>r.gender?U.badge('pg_'+r.gender):''},
        {key:'education',label:L('زده کړه','تحصیلات'),render:r=>r.education?U.t(r.education):''},
        {key:'phone',label:L('تلیفون','تلفون')},
        {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'e_active')}
      ];
      html=tableOrEmpty('teachers',cols,teachers,'gradcap');
      break;
    }
    case 'students': {
      const years=[...new Set(stats.map(s=>s.academicYear))];
      const yr=years.includes(Settings.get().academicYear)?Settings.get().academicYear:(years[0]||Settings.get().academicYear);
      const cur=stats.filter(s=>String(s.academicYear)===String(yr));
      const grades=[...new Set(cur.map(s=>s.className))].sort((a,b)=>Number(a)-Number(b));
      const rows=grades.map(g=>{
        const b=cur.filter(s=>s.className===g).reduce((a,s)=>a+Number(s.maleCount||0),0);
        const gi=cur.filter(s=>s.className===g).reduce((a,s)=>a+Number(s.femaleCount||0),0);
        return [g, b, gi, b+gi];
      });
      const tb=U.sum(rows,r=>r[1]), tg=U.sum(rows,r=>r[2]), tt=tb+tg;
      html='<div class="card mb-2"><div class="card-head"><h3>'+U.t('navStudents')+'</h3>'+
        '<div class="ch-actions"><select class="flt" id="stYear" style="max-width:120px">'+years.map(y=>'<option'+(String(y)===String(yr)?' selected':'')+'>'+y+'</option>').join('')+'</select></div></div>'+
        '<div class="card-body">'+
          '<div class="stat-grid mb-2" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">'+
            miniStat(tt,U.t('totalStudents'),'chart')+miniStat(tb,U.t('totalBoys'),'male')+miniStat(tg,U.t('totalGirls'),'female')+
          '</div>'+
          (rows.length?PrintDoc.table(
            [L('ټولګی','پایه'),L('هلکان','پسران'),L('نجونې','دختران'),L('ټول','جمع')],
            rows.map(r=>[I18N.grades[Number(r[0])-1]?U.tv(I18N.grades[Number(r[0])-1]):r[0], U.num(r[1]), U.num(r[2]), U.num(r[3])]),
            {numCols:[1,2,3], totals:[U.t('total'), U.num(tb), U.num(tg), U.num(tt)]}
          ) : U.emptyState('chart',U.t('noData')))+
        '</div></div>';
      break;
    }
    case 'tashkil': {
      const rows=tash.rows.map(r=>({0:r.schoolName||'',1:r.name||'',2:r.kind==='teacher'?U.t('staffTeacherKind'):(r.kind==='employee'?U.t('staffEmployeeKind'):''),3:r.count}));
      rows.push({0:school.name,1:U.t('total'),2:'',3:tash.total});
      html='<div class="card"><div class="card-head"><h3>'+U.t('tashkilTitle')+'</h3></div><div class="card-body">'+
        '<div class="notice mb-2 small">'+U.icon('info')+' '+U.t('autoTashkilNote')+'</div>'+
        '<div class="stat-grid mb-2" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">'+
          miniStat(tash.totalTeachers,U.t('navTeachers'),'gradcap')+miniStat(tash.totalEmployees,U.t('navEmployees'),'briefcase')+miniStat(tash.total,U.t('totalStaff'),'layers')
        '</div>'+
        (rows.length?U.tableHTML(
          [{key:0,label:L('ښوونځی','مدرسه')},{key:1,label:L('دنده / مضمون','سمت / مضمون')},{key:2,label:L('ډول','نوع')},{key:3,label:L('شمېر','تعداد'),render:r=>r[1]===U.t('total')?'<b>'+U.num(r[3])+'</b>':U.num(r[3])}],
          rows.map((r,i)=>({0:r[0],1:r[1],2:r[2],3:r[3]})),
          ()=>''
        ):U.emptyState('layers',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'obs': {
      const rows=sObs.map(o=>[
        byTeacher[o.teacherId]?byTeacher[o.teacherId].fullName:'',
        o.observationNumber, U.fmtDate(o.date), byMember[o.observerId]?byMember[o.observerId].fullName:'',
        (o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||''),
        (o.percentage!==undefined?o.percentage+'%':''),
        Settings.quality(o.percentage).ps
      ]);
      html='<div class="card"><div class="card-head"><h3>'+U.t('navObservations')+' ('+U.num(sObs.length)+')'+'</h3></div><div class="card-body">'+
        (sObs.length?U.tableHTML(
          [{key:0,label:L('ښوونکی','معلم')},{key:1,label:L('شمېره','شماره')},{key:2,label:L('نېټه','تاریخ')},{key:3,label:L('څارونکی','ناظر')},{key:4,label:L('نمره','نمره')},{key:5,label:L('سلنه','درصد')},{key:6,label:L('کچه','کیفیت')}],
          rows.map((r,i)=>({0:r[0],1:r[1],2:r[2],3:r[3],4:r[4],5:r[5],6:r[6]})),
          ()=>''
        ):U.emptyState('eye',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'acts': {
      const all=[...acts.map(a=>({d:a.date,title:a.title,type:U.t('navActivities'),st:a.status})),
                 ...pd.map(a=>({d:a.date,title:a.title,type:U.t('navProfDev'),st:a.status}))];
      all.sort((a,b)=>String(b.d||'').localeCompare(String(a.d||'')));
      html='<div class="card"><div class="card-head"><h3>'+U.t('navActivities')+' ('+U.num(all.length)+')'+'</h3></div><div class="card-body">'+
        (all.length?
          '<div class="mini-list">'+all.slice(0,30).map(x=>
            '<div class="mini-item"><div class="mi-ico" style="background:var(--primary-soft);color:var(--primary)">'+U.icon('activity')+'</div>'+
            '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(x.title||'')+'</div><div class="mi-sub">'+U.escapeHtml(x.type)+' — '+U.fmtDate(x.d)+'</div></div>'+U.badge(x.status||'a_planned')+'</div>'
          ).join('')+'</div>'
        :U.emptyState('activity',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'mon': {
      const rows=mon.map(m=>[
        U.fmtDate(m.date),
        (m.memberIds||[]).map(x=>byMember[x]?byMember[x].fullName:'').filter(Boolean).join('، '),
        m.purpose||'',
        U.badge(m.status||'mng_done')
      ]);
      html='<div class="card"><div class="card-head"><h3>'+U.t('navMonitoring')+' ('+U.num(mon.length)+')'+'</h3></div><div class="card-body">'+
        (mon.length?U.tableHTML(
          [{key:0,label:L('نېټه','تاریخ')},{key:1,label:L('غړي','اعضا')},{key:2,label:L('موخه','هدف')},{key:3,label:L('حالت','وضعیت')}],
          rows.map((r,i)=>({0:r[0],1:r[1],2:r[2],3:r[3]})),
          (r,i)=>'<button class="icon-btn sm" data-mview="'+mon[i].id+'">'+U.icon('eye')+'</button>'
        ):U.emptyState('clipboardCheck',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'problems': {
      const items=[];
      mon.forEach(m=>{
        if(m.problems) items.push({src:U.fmtDate(m.date), text:m.problems, kind:U.t('problems'), cls:'danger'});
        if(m.findings) items.push({src:U.fmtDate(m.date), text:m.findings, kind:U.t('findings'), cls:'warning'});
        if(m.recommendations) items.push({src:U.fmtDate(m.date), text:m.recommendations, kind:U.t('recommendations'), cls:'info'});
      });
      html='<div class="card"><div class="card-head"><h3>'+U.t('problems')+' / '+U.t('recommendations')+'</h3></div><div class="card-body">'+
        (items.length?
          items.map(i=>'<div class="mb-2"><span class="badge b-'+i.cls+'">'+U.escapeHtml(i.kind)+'</span> <span class="muted small">'+i.src+'</span><p class="small mt-1">'+U.escapeHtml(i.text)+'</p></div>').join('')
        :U.emptyState('alert',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'reports': {
      html='<div class="card"><div class="card-head"><h3>'+U.t('navReports')+' ('+U.num(reports.length)+')'+'</h3></div><div class="card-body">'+
        (reports.length?U.tableHTML(
          [{key:0,label:L('نوم','نام')},{key:1,label:L('نېټه','تاریخ')},{key:2,label:L('ډول','نوع')}],
          reports.map(r=>({0:r.title||'',1:U.fmtDate(r.createdAt),2:U.t('rep'+(r.type||'').replace(/^[a-z]/,c=>c.toUpperCase()))})),
          (r,i)=>'<button class="icon-btn sm" data-rpt="'+reports[i].id+'">'+U.icon('eye')+'</button>'
        ):U.emptyState('file',U.t('noData')))+
      '</div></div>';
      break;
    }
    case 'stats': {
      const tb=teachers.filter(t=>t.gender==='boys').length;
      const tg=teachers.filter(t=>t.gender==='girls').length;
      const sst=window.StudentStatsModule?StudentStatsModule.totals(stats).t:0;
      const full=sObs.length?Math.round(sObs.filter(o=>Number(o.percentage)>=61).length/sObs.length*100):0;
      html='<div class="grid-2">'+
        '<div class="card"><div class="card-head"><h3>'+U.t('schoolStats')+'</h3></div><div class="card-body">'+
          '<div class="stat-grid" style="grid-template-columns:1fr 1fr">'+
            miniStat(teachers.length,U.t('totalTeachers'),'gradcap')+
            miniStat(employees.length,U.t('totalEmployees'),'briefcase')+
            miniStat(sst,U.t('totalStudents'),'chart')+
            miniStat(tash.total,U.t('totalStaff'),'layers')+
          '</div>'+
        '</div></div>'+
        '<div class="card"><div class="card-head"><h3>'+U.t('analysis')+'</h3></div><div class="card-body">'+
          '<div class="mb-2"><div class="flex mb-1"><span class="small">'+U.t('teachersByGender')+'</span><span class="small strong">'+U.num(tb)+' / '+U.num(tg)+'</span></div>'+
          '<div class="progress"><div class="bar" style="width:'+((tb+tg)?Math.round(tb/(tb+tg)*100):0)+'%"></div></div></div>'+
          '<div><div class="flex mb-1"><span class="small">'+U.t('teachingQuality')+'</span><span class="small strong">'+U.num(full)+'%</span></div>'+
          '<div class="progress"><div class="bar" style="width:'+full+'%"></div></div></div>'+
        '</div></div>'+
      '</div>';
      break;
    }
  }
  box.innerHTML=html;

  /* wire tab buttons */
  const editBtn=box.querySelector('[data-act=edit]');
  if(editBtn) editBtn.addEventListener('click', ()=>CRUD.openForm(CFG,school));
  const printBtn=box.querySelector('[data-act=print]');
  if(printBtn) printBtn.addEventListener('click', ()=>printSchool(school));
  const ysel=box.querySelector('#stYear');
  if(ysel) ysel.addEventListener('change', renderTabContent);
  box.querySelectorAll('[data-mview]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const rec=await DB.get('monitoring',b.dataset.mview);
      if(rec) MonitoringModule.view(rec);
    });
  });
  box.querySelectorAll('[data-rpt]').forEach(b=>{
    b.addEventListener('click', ()=>location.hash='#/reports/'+b.dataset.rpt);
  });
}

function tableOrEmpty(kind,cols,rows,icon){
  if(!rows.length) return '<div class="card"><div class="card-body">'+U.emptyState(icon,U.t('noData'))+'</div></div>';
  return '<div class="card"><div class="card-body flush" style="max-height:480px;overflow:auto">'+
    U.tableHTML(cols,rows,()=>{})+'</div></div>';
}
function miniStat(n,label,icon){
  return '<div class="stat-card" style="cursor:default"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+(typeof n==='number'?U.num(n):n)+'</div><div class="sc-label">'+label+'</div></div></div>';
}

/* ================= PRINT ================= */
async function printSchool(s){
  const teachers=(await DB.getAll('teachers')).filter(t=>t.schoolId===s.id);
  const employees=(await DB.getAll('employees')).filter(e=>e.schoolId===s.id);
  const stats=(await DB.getAll('studentStats')).filter(x=>x.schoolId===s.id);
  const tash=await window.TashkilModule.forSchool(s.id);
  const mon=(await DB.getAll('monitoring')).filter(m=>(m.schoolIds||[]).includes(s.id));
  const sections=[
    {heading:U.t('detail'), html: PrintDoc.kv([
      {k:U.t('schoolName'),v:s.name},{k:U.t('schoolCode'),v:s.code},
      {k:U.t('village'),v:s.village},
      {k:U.t('schoolLevel'),v:U.tv(s.level)},
      {k:U.t('ownership'),v:U.tv(s.ownership)},
      {k:U.t('genderType'),v:s.genderType?U.statusLabel(s.genderType):''},
      {k:U.t('establishedYear'),v:s.establishedYear},{k:U.t('principal'),v:s.principal},
      {k:U.t('contactNumber'),v:s.phone},{k:U.t('status'),v:U.statusLabel(s.status||'s_active')},
      {k:U.t('address'),v:s.address,full:true}
    ])},
    {heading:U.t('navTeachers')+' ('+teachers.length+')', html: teachers.length?
      PrintDoc.table([L('نوم','نام'),L('مضمون','مضمون'),L('جنسیت','جنسیت'),L('زده کړه','تحصیلات')],
        teachers.map(t=>[t.fullName,t.subject||'',t.gender?U.statusLabel('pg_'+t.gender):'',t.education?U.t(t.education):'']),
        {}):PrintDoc.para(U.t('noData'))},
    {heading:U.t('navEmployees')+' ('+employees.length+')', html: employees.length?
      PrintDoc.table([L('نوم','نام'),L('دنده','سمت'),L('جنسیت','جنسیت')],
        employees.map(e=>[e.fullName,e.position?U.t(e.position):'',e.gender?U.statusLabel('pg_'+e.gender):'']),{}):PrintDoc.para(U.t('noData'))},
    {heading:U.t('navStudents'), html: stats.length?
      (()=>{
        const cur=stats.filter(x=>String(x.academicYear)===String(Settings.get().academicYear));
        const grades=[...new Set(cur.map(x=>x.className))].sort((a,b)=>Number(a)-Number(b));
        const rows=grades.map(g=>{
          const b=cur.filter(x=>x.className===g).reduce((a,x)=>a+Number(x.maleCount||0),0);
          const gi=cur.filter(x=>x.className===g).reduce((a,x)=>a+Number(x.femaleCount||0),0);
          return [I18N.grades[Number(g)-1]?U.tv(I18N.grades[Number(g)-1]):g, b, gi, b+gi];
        });
        return PrintDoc.table([L('ټولګی','پایه'),L('هلکان','پسران'),L('نجونې','دختران'),L('ټول','جمع')],rows,
          {numCols:[1,2,3], totals:[U.t('total'), ...[U.sum(cur,x=>Number(x.maleCount||0)), U.sum(cur,x=>Number(x.femaleCount||0)), U.sum(cur,x=>Number(x.maleCount||0)+Number(x.femaleCount||0))].map(n=>U.num(n))]});
      })()
      :PrintDoc.para(U.t('noData'))},
    {heading:U.t('tashkilTitle'), html: (tash.rows.length?
      PrintDoc.table([L('دنده / مضمون','سمت / مضمون'),L('ډول','نوع'),L('شمېر','تعداد')],
        tash.rows.map(r=>[r.name||'', r.kind==='teacher'?U.t('staffTeacherKind'):U.t('staffEmployeeKind'), r.count]).concat([[U.t('total'),'',tash.total]]),
        {numCols:[2], totals:[U.t('total'),'',tash.total].map(x=>U.num(x))}):PrintDoc.para(U.t('noData')))},
    {heading:U.t('navMonitoring')+' ('+mon.length+')', html: mon.length?
      PrintDoc.table([L('نېټه','تاریخ'),L('موخه','هدف'),L('موندنې','یافته‌ها')],
        mon.map(m=>[U.fmtDate(m.date),m.purpose||'',(m.findings||'').slice(0,140)]),{}):PrintDoc.para(U.t('noData'))}
  ];
  const doc=await PrintDoc.officialDoc({
    seqType:'school',
    title: U.t('navSchools')+' — '+U.t('official'),
    sub: s.name,
    meta:[{k:U.t('schoolCode'),v:s.code},{k:U.t('principal'),v:s.principal}],
    sections,
    sigs:[U.t('headTeacher'),U.t('reviewedBy'),U.t('director')]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.SchoolsModule={CFG, printSchool, renderProfile};
})();
