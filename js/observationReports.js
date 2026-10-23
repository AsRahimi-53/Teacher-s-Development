/* =====================================================================
   observationReports.js — observation history & completion reports.
   Teacher observation-history document, district-wide completion
   analysis (4/3/2/1/0 observations), Excel export.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

/* print a teacher's full observation history */
async function printTeacherHistory(teacherId){
  await ObservationsModule.loadRefs();
  const {T_BY_ID,M_BY_ID,S_BY_ID}=ObservationsModule.getRefs();
  const t=T_BY_ID[teacherId];
  if(!t) return;
  const all=await DB.getAll('observations');
  const obs=all.filter(o=>o.teacherId===teacherId).sort((a,b)=>a.observationNumber-b.observationNumber || String(a.date).localeCompare(String(b.date)));
  const year=Settings.get().academicYear;
  const yrObs=obs.filter(o=>String(o.academicYear)===String(year));

  const body=obs.length?
    PrintDoc.table(
      [L('شمېره','شماره'),L('کال','سال'),L('نېټه','تاریخ'),L('څارونکی','مشاهدکننده'),L('مضمون','مضمون'),
       L('ټولګی','کلاس'),L('نمره','نمره'),L('سلنه','درصد'),L('کچه','کیفیت'),
       L('ضعیف اړخونه','نقاط ضعف'),L('وړاندیز','پیشنهاد')],
      obs.map(o=>[
        o.observationNumber, o.academicYear||'', U.fmtDate(o.date),
        M_BY_ID[o.observerId]?M_BY_ID[o.observerId].fullName:'',
        o.subject||'', o.className||'',
        (o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||0),
        (o.percentage||0)+'%', Settings.quality(o.percentage||0).ps,
        (o.weaknesses||'').slice(0,120), (o.recommendations||'').slice(0,120)
      ]),
      {numCols:[0,5,6]}
    ):PrintDoc.para(U.t('noData'));

  const doc=await PrintDoc.officialDoc({
    seqType:'obshist',
    title: U.t('observationHistory')+' — '+U.t('official'),
    sub: t.fullName,
    meta:[{k:U.t('school'),v:t.schoolId&&S_BY_ID[t.schoolId]?S_BY_ID[t.schoolId].name:''},
          {k:U.t('navObservations')+' — '+year, v:yrObs.length+' / 4'}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('fullName'),v:t.fullName},{k:U.t('fatherName'),v:t.fatherName},
        {k:U.t('subject'),v:t.subject},{k:U.t('education'),v:t.education?U.t(t.education):''},
        {k:U.t('phone'),v:t.phone},{k:U.t('position'),v:t.position}
      ])},
      {heading:U.t('observationHistory'), html: body}
    ],
    sigs:[U.t('observer'),U.t('headTeacher'),U.t('director')]
  });
  PrintDoc.preview(doc, U.t('print'));
}

/* district-wide completion analysis (screen + print + excel) */
async function completionReport(){
  await ObservationsModule.loadRefs();
  const {TEACHERS,S_BY_ID}=ObservationsModule.getRefs();
  const all=await DB.getAll('observations');
  const year=Settings.get().academicYear;
  const yrObs=all.filter(o=>String(o.academicYear)===String(year));
  const per={};
  yrObs.forEach(o=>{ per[o.teacherId]=(per[o.teacherId]||0)+1; });
  const maxObs=4;
  const groups={4:[],3:[],2:[],1:[],0:[]};
  TEACHERS.forEach(t=>{
    const n=per[t.id]||0;
    const key=Math.min(n,maxObs);
    groups[key].push({t, n});
  });

  const doc=await PrintDoc.officialDoc({
    seqType:'obscomp',
    title: U.t('obsCompletion')+' — '+year,
    meta:[{k:U.t('totalTeachers'),v:TEACHERS.length},{k:U.t('navObservations'),v:yrObs.length}],
    sections:[
      {heading:U.t('summary'), html: PrintDoc.table(
        [L('د څارنې شمېره','تعداد مشاهدات'),L('د ښوونکو شمېر','تعداد معلمان'),L('سلنه','درصد')],
        [4,3,2,1,0].map(k=>[k, groups[k].length, TEACHERS.length?Math.round(groups[k].length/TEACHERS.length*100):0+'%']),
        {numCols:[1,2]}
      )},
      ...[4,3,2,1,0].map(k=>({
        heading: (k===0?U.t('obsWith0'):U.t('obsWith'+k)),
        html: groups[k].length? PrintDoc.table(
          [L('نوم','نام'),L('ښوونځی','مدرسه'),L('مضمون','مضمون'),L('څارنې','مشاهدات')],
          groups[k].slice(0,60).map(x=>[x.t.fullName, x.t.schoolId&&S_BY_ID[x.t.schoolId]?S_BY_ID[x.t.schoolId].name:'', x.t.subject||'', x.n]),
          {numCols:[3]}
        ):PrintDoc.para(U.t('none'))
      }))
    ]
  });
  PrintDoc.preview(doc, U.t('print'));
}

function exportCompletion(){
  ObservationsModule.loadRefs().then(async ()=>{
    const {TEACHERS,S_BY_ID}=ObservationsModule.getRefs();
    const all=await DB.getAll('observations');
    const year=Settings.get().academicYear;
    const yrObs=all.filter(o=>String(o.academicYear)===String(year));
    const per={};
    yrObs.forEach(o=>{ per[o.teacherId]=(per[o.teacherId]||0)+1; });
    const rows=TEACHERS.map(t=>[
      t.fullName, t.schoolId&&S_BY_ID[t.schoolId]?S_BY_ID[t.schoolId].name:'', t.subject||'', per[t.id]||0
    ]);
    ExcelExport.exportTable(U.t('obsCompletion')+' — '+year,
      [U.t('teacherName'),U.t('school'),U.t('subject'),U.t('navObservations')].map(x=>U.tv(x)),
      rows, {file:'observation_completion'});
  });
}

window.ObservationReports={printTeacherHistory, completionReport, exportCompletion};
})();
