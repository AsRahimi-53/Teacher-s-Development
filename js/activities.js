/* =====================================================================
   activities.js — district activities (monitoring, training, seminars,
   workshops, meetings, consultations, support, coordination,
   assessment, observation...).
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const TYPES=[
  {v:'actMonitoring',ps:'څارنه',fa:'پایش'},{v:'actObservation',ps:'د تدریس څارنه',fa:'مشاهده تدریس'},
  {v:'actTraining',ps:'د ښوونکو لوستونه',fa:'کارگاه معلمان'},{v:'actSeminar',ps:'سمینار',fa:'سمینار'},
  {v:'actWorkshop',ps:'ورکشاپ',fa:'کارگاه'},{v:'actMeeting',ps:'غونډه',fa:'جلسه'},
  {v:'actConsultation',ps:'مشوره',fa:'مشاوره'},{v:'actSupport',ps:'د زده کړې ملاتړ',fa:'حمایت آموزشی'},
  {v:'actCoordination',ps:'همغږي',fa:'هماهنگی'},{v:'actAssessment',ps:'ارزونه',fa:'ارزیابی'},
  {v:'actOther',ps:'نور',fa:'سایر'}
];
const STATUS=[
  {v:'a_planned',ps:'پلان شوې',fa:'برنامه‌ریزی شده'},{v:'a_done',ps:'بشپړه',fa:'انجام شده'},
  {v:'a_delayed',ps:'ځنډېدلې',fa:'تأخیری'},{v:'a_cancelled',ps:'لغوه شوې',fa:'لغوشده'}
];

const CFG={
  key:'activities',
  titleKey:'navActivities',
  icon:'activity',
  fields:[
    F('title',L('د فعالیت سرلیک','عنوان فعالیت'),'text',{required:true,span:2}),
    F('type',L('د فعالیت ډول','نوع فعالیت'),'select',{options:TYPES,required:true}),
    F('date',L('نېټه','تاریخ'),'date',{required:true}),
    F('location',L('ځای','مکان')),
    F('schoolIds',L('ښوونځي','مدارس'),'msStore',{store:'schools',labelKey:'name'}),
    F('memberIds',L('علمي غړي','اعضای علمی'),'msStore',{store:'members',labelKey:'fullName',subKey:'position'}),
    F('participants',L('د ګډونوالو شمېر','تعداد شرکت‌کنندگان'),'number',{min:0}),
    F('description',L('توضیح','توضیح'),'textarea',{span:2}),
    F('results',L('پایلې','نتایج'),'textarea',{span:2}),
    F('problems',L('ستونزې','مسائل'),'textarea',{span:2}),
    F('recommendations',L('وړاندیزونه','پیشنهادها'),'textarea',{span:2}),
    F('status',L('حالت','وضعیت'),'select',{options:STATUS}),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea',{span:2})
  ],
  tableCols:[
    {key:'title',label:L('سرلیک','عنوان'),render:r=>'<b>'+U.escapeHtml(r.title||'')+'</b>',cell:r=>r.title||''},
    {key:'type',label:L('ډول','نوع'),render:r=>r.type?('<span class="badge b-blue">'+U.t(r.type)+'</span>'): '',cell:r=>r.type?U.t(r.type):''},
    {key:'date',label:L('نېټه','تاریخ'),render:r=>r.date?U.fmtDate(r.date):'',cell:r=>r.date?U.fmtDate(r.date):''},
    {key:'location',label:L('ځای','مکان'),cell:r=>r.location||''},
    {key:'schoolIds',label:L('ښوونځي','مدارس'),render:r=>actScope(r.schoolIds),cell:r=>actScopeText(r.schoolIds)},
    {key:'memberIds',label:L('غړي','اعضای'),render:r=>actMembers(r.memberIds),cell:r=>actMembersText(r.memberIds)},
    {key:'status',label:L('حالت','وضعیت'),render:r=>U.badge(r.status||'a_planned'),cell:r=>U.statusLabel(r.status||'a_planned')}
  ],
  searchKeys:['title','location','description'],
  filters:[
    {key:'type',label:L('ډول','نوع'),type:'select',options:TYPES},
    {key:'status',label:L('حالت','وضعیت'),type:'select',options:STATUS},
    {key:'memberId',label:L('غړی','عضو'),type:'memberflt',match:(r,v)=>(r.memberIds||[]).includes(v)},
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolflt',match:(r,v)=>(r.schoolIds||[]).includes(v)}
  ],
  sort:{key:'date',dir:'desc'},
  print: printActivity
};

function actScope(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireDistrict')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function actScopeText(ids){
  if(!ids||!ids.length) return U.t('entireDistrict');
  return (ids.map(i=>(window.__schoolName||{})[i]).filter(Boolean)).join(', ');
}
function actMembers(ids){
  if(!ids||!ids.length) return '<span class="badge b-teal">'+U.t('entireTeam')+'</span>';
  return '<span class="small">'+U.escapeHtml(ids.map(i=>(window.__memberName||{})[i]).filter(Boolean).join('، '))+'</span>';
}
function actMembersText(ids){
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

register('activities', {render: async (id, params)=>{
  Nav.setActive('activities');
  await prep();
  const [members,schools]=await Promise.all([DB.getAll('members'),DB.getAll('schools')]);
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  if(id==='new'){
    CRUD.openForm(CFG, {date:U.todayISO(), schoolIds:(params&&params.school)?[params.school]:[]});
    return;
  }
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navActivities')}]);
  await CRUD.renderList(CFG);
}});

async function printActivity(a){
  const doc=await PrintDoc.officialDoc({
    seqType:'activity',
    title: U.t('navActivities')+' — '+U.t('official'),
    sub: a.title,
    meta:[{k:U.t('activityType'),v:a.type?U.t(a.type):''},{k:U.t('documentDate'),v:a.date?U.fmtDate(a.date):''},
          {k:U.t('status'),v:U.statusLabel(a.status||'a_planned')}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('activityTitle'),v:a.title,full:true},{k:U.t('activityType'),v:a.type?U.t(a.type):''},
        {k:U.t('date'),v:a.date?U.fmtDate(a.date):''},{k:U.t('location2'),v:a.location},
        {k:U.t('schoolIds'),v:actScopeText(a.schoolIds),full:true},
        {k:U.t('memberIds'),v:actMembersText(a.memberIds),full:true},
        {k:U.t('participantCount'),v:a.participants?U.num(a.participants):''}
      ])},
      {heading:U.t('description'), html: PrintDoc.para(a.description||'')},
      {heading:U.t('results'), html: PrintDoc.para(a.results||'')},
      {heading:U.t('problems'), html: PrintDoc.para(a.problems||'')},
      {heading:U.t('recommendations'), html: PrintDoc.para(a.recommendations||'')},
      {heading:U.t('status')+' / '+U.t('notes'), html: PrintDoc.kv([
        {k:U.t('status'),v:U.statusLabel(a.status||'a_planned')},{k:U.t('notes'),v:a.notes,full:true}
      ])}
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

window.ActivitiesModule={CFG, TYPES, printActivity};
})();
