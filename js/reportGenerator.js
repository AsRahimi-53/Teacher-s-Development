/* =====================================================================
   reportGenerator.js — builds structured reports from REAL saved data.
   Reports are language-neutral: headings/paragraphs stored as
   {ps, fa} pairs; rendered in current language at view/print/export.
   Each sections.push() is a single line so paren balance is explicit.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;
const L2 = U.L;

function gradeName(g){
  const hit=(window.I18N&&I18N.grades||[]).find(x=>x.v===String(g));
  return hit?U.tv(hit):String(g||'');
}
function periodNameKey(p){
  return p==='day'?'daily':p==='week'?'weekly':p==='month'?'monthly':p==='quarter'?'quarterly':'annual';
}

const ReportGen = {

  types: {
    daily:       {title:'repDaily',      icon:'calendar',     period:'day'},
    weekly:      {title:'repWeekly',     icon:'calendar',     period:'week'},
    monthly:     {title:'repMonthly',    icon:'calendar',     period:'month'},
    quarterly:   {title:'repQuarterly',  icon:'calendar',     period:'quarter'},
    annual:      {title:'repAnnual',     icon:'calendar',     period:'year'},
    member:      {title:'repMember',     icon:'user'},
    team:        {title:'repTeam',       icon:'users',        period:'month'},
    school:      {title:'repSchool',     icon:'school'},
    teacher:     {title:'repTeacher',    icon:'gradcap'},
    observation: {title:'repObservation',icon:'eye'},
    students:    {title:'repStudents',   icon:'chart'},
    tashkil:     {title:'repTashkil',    icon:'layers'},
    profdev:     {title:'repProfDev',    icon:'book'},
    monitoring:  {title:'repMonitoring', icon:'clipboardCheck', period:'month'},
    plan:        {title:'repPlan',       icon:'calendarCheck'},
    duty:        {title:'repDuty',       icon:'checkSquare'},
    activity:    {title:'repActivity',   icon:'activity'}
  },

  typeTitle(ty){ return L2(U.t(this.types[ty].title), U.t(this.types[ty].title)); },

  /* ALL periods follow the Jalali (Solar Hijri) calendar:
       week    = Saturday … Friday
       month   = 1st … last day of the Jalali month
       quarter = 3 Jalali months (Hamal–Jawza, Saratan–Sunbula, Mizan–Qaws, Jadi–Hoot)
       year    = 1 Hamal … last day of Hoot */
  periodRange(period, anchor){
    const J=window.JalaaliLib;
    const a = U.parseISO(anchor) || new Date();
    const iso=(jy,jm,jd)=>{ const g=J.toGregorian(jy,jm,jd); return g.gy+'-'+String(g.gm).padStart(2,'0')+'-'+String(g.gd).padStart(2,'0'); };
    const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const j=J.toJalaali(a.getFullYear(), a.getMonth()+1, a.getDate());
    if(period==='day'){ const t=isoD(a); return {start:t, end:t}; }
    if(period==='week'){
      const back=(a.getDay()+1)%7;                       // Sat=0 … Fri=6
      const s=new Date(a.getFullYear(),a.getMonth(),a.getDate()-back,12);
      const e=new Date(a.getFullYear(),a.getMonth(),a.getDate()-back+6,12);
      return {start:isoD(s), end:isoD(e)};
    }
    if(period==='month') return {start:iso(j.jy,j.jm,1), end:iso(j.jy,j.jm,J.jalaaliMonthLength(j.jy,j.jm))};
    if(period==='quarter'){
      const q=Math.floor((j.jm-1)/3)*3+1;
      return {start:iso(j.jy,q,1), end:iso(j.jy,q+2,J.jalaaliMonthLength(j.jy,q+2))};
    }
    if(period==='year') return {start:iso(j.jy,1,1), end:iso(j.jy,12,J.jalaaliMonthLength(j.jy,12))};
    return {start:isoD(a), end:isoD(a)};
  },

  inPeriod(dateISO, range){
    if(!dateISO) return false;
    if(!range) return true;
    return (!range.start || dateISO>=range.start) && (!range.end || dateISO<=range.end);
  },

  /* ================= build ================= */

  async build(type, scope){
    scope = scope||{};
    const data=await this.loadAll();
    const builders={
      daily:d=>this.periodReport(d,'day',scope),
      weekly:d=>this.periodReport(d,'week',scope),
      monthly:d=>this.periodReport(d,'month',scope),
      quarterly:d=>this.periodReport(d,'quarter',scope),
      annual:d=>this.periodReport(d,'year',scope),
      team:d=>this.periodReport(d,'month',Object.assign({},scope,{team:true})),
      member:d=>this.memberReport(d,scope),
      school:d=>this.schoolReport(d,scope),
      teacher:d=>this.teacherReport(d,scope),
      observation:d=>this.observationReport(d,scope),
      students:d=>this.studentsReport(d,scope),
      tashkil:d=>this.tashkilReport(d,scope),
      profdev:d=>this.profdevReport(d,scope),
      monitoring:d=>this.periodReport(d,'month',Object.assign({},scope,{only:'monitoring'})),
      plan:d=>this.planReport(d,scope),
      duty:d=>this.dutyReport(d,scope),
      activity:d=>this.activityReport(d,scope)
    };
    const report=await builders[type](data);
    report.id=U.uid();
    report.type=type;
    report.createdAt=new Date().toISOString();
    report.scope=scope;
    report.generatedLang=U.currentLang();
    return report;
  },

  async loadAll(){
    const [members,schools,teachers,employees,studentStats,obs,ap,mp,duties,acts,pd,mon]=await Promise.all([
      DB.getAll('members'),DB.getAll('schools'),DB.getAll('teachers'),DB.getAll('employees'),
      DB.getAll('studentStats'),DB.getAll('observations'),
      DB.getAll('annualPlans'),DB.getAll('monthlyPlans'),DB.getAll('duties'),
      DB.getAll('activities'),DB.getAll('professionalDevelopment'),DB.getAll('monitoring')
    ]);
    const byId=(arr)=>Object.fromEntries(arr.map(x=>[x.id,x]));
    return {
      members, schools, teachers, employees, studentStats, obs, ap, mp, duties, acts, pd, mon,
      M:byId(members), S:byId(schools), T:byId(teachers)
    };
  },

  /* ---------- section helpers ---------- */
  sec(heading, content){ return {heading:heading, content:content}; },
  para(t){ return {paras:[t]}; },
  tbl(caption, headers, rows, opts){ return {tables:[{caption:caption, headers:headers, rows:rows, opts:opts||{}}]}; },

  statusCell(key){
    const st=U.STATUS[key];
    if(!st) return '';
    return L2(st.ps, st.fa);
  },
  idsCell(ids, byId, labelKey){
    if(!ids||!ids.length) return L2('ټوله ولسوالۍ','کل ولسوالی');
    return (ids.map(i=>byId[i]?byId[i][labelKey]||'':'').filter(Boolean)).join('، ')||'—';
  },
  qualityCell(p){
    const q=Settings.quality(p);
    return L2(q.ps,q.fa);
  },
  scoreStr(o){
    return (o.obtainedScore!==undefined?o.obtainedScore:'')+'/'+(o.totalScore||0);
  },
  gradeOf(g){ return gradeName(g)||'—'; },

  intro(scope, periodText, d){
    /* periodText is a bilingual object {ps,fa} — never concatenate the object itself
       (it printed as «[object Object]») */
    const pp=(periodText && typeof periodText==='object') ? periodText : {ps:String(periodText||''),fa:String(periodText||'')};
    const s=Settings.get();
    const dist=s.district||'';
    const prov=s.province||'';
    return L2(
      'په '+(s.academicYear||'')+' تعلیمي کال کې، د '+prov+' ولایت د '+dist+' ولسوالۍ د ښوونکو مسلکي پراختیا مدیریت د علمي غړو لخوا په '+pp.ps+' موده کې لاندې کارونه ترسره شول. دا راپور د اصلي ثبت شوي معلوماتو پر بنسټ جوړ شوی دی.',
      'در سال تحصیلی '+(s.academicYear||'')+'، اعضای علمی مسئول توسعه شغلی معلمان ولسوالی '+dist+' در استان '+prov+' در دوره '+pp.fa+' کارهای زیر را انجام دادند. این گزارش بر اساس اطلاعات ثبت‌شده اصلی تهیه شده است.'
    );
  },

  /* ================= PERIOD REPORT ================= */
  async periodReport(d, period, scope){
    const s=Settings.get();
    const range=this.periodRange(period, scope.start || U.todayISO());
    const periodText=L2(U.fmtDate(range.start)+' تر '+U.fmtDate(range.end), U.fmtDate(range.start)+' تا '+U.fmtDate(range.end));

    const mFilter=arr=>!(scope.memberIds&&scope.memberIds.length) || (arr||[]).some(x=>scope.memberIds.includes(x));
    const sFilter=arr=>!(scope.schoolIds&&scope.schoolIds.length) || (arr||[]).some(x=>scope.schoolIds.includes(x));

    const acts=d.acts.filter(a=>this.inPeriod(a.date,range)&&mFilter(a.memberIds)&&sFilter(a.schoolIds));
    const obs=d.obs.filter(o=>this.inPeriod(o.date,range)&&mFilter([o.observerId])&&(!scope.schoolIds||scope.schoolIds.includes(d.T[o.teacherId]?d.T[o.teacherId].schoolId:'')));
    const mon=d.mon.filter(m=>this.inPeriod(m.date,range)&&mFilter(m.memberIds)&&sFilter(m.schoolIds));
    const pd=d.pd.filter(p=>this.inPeriod(p.date,range)&&mFilter(p.memberIds)&&sFilter(p.schoolIds));
    const dutyF=d.duties.filter(x=>((this.inPeriod(x.date,range)||this.inPeriod(x.deadline,range))&&mFilter(x.memberIds)&&sFilter(x.schoolIds)));
    const apF=d.ap.filter(x=>((this.inPeriod(x.startDate,range)||this.inPeriod(x.endDate,range)||this.inPeriod(x.updatedAt&&x.updatedAt.slice(0,10),range))&&mFilter(x.memberIds)));
    const mpF=d.mp.filter(x=>{
      /* monthly plans carry a JALALI year + month → compare in the Jalali calendar */
      const mm=x.month?Number(x.month):null;
      if(mm && range){
        const J=window.JalaaliLib;
        const jp=iso=>{ const d=U.parseISO(iso); return d?J.toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate()):null; };
        const a=jp(range.start), b=jp(range.end);
        const key=(y,m)=>Number(y)*100+Number(m);
        const k=key(x.year||(a?a.jy:0), mm);
        if(a && b && (k<key(a.jy,a.jm) || k>key(b.jy,b.jm))) return false;
      }
      return mFilter(x.memberIds);
    });
    const only = scope.only==='monitoring';

    const sections=[];
    sections.push(this.sec(L2('موده','دوره'), this.para(periodText)));
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(this.intro(scope,periodText,d))));

    if(!only && acts.length){
      const headers=[L2('د فعالیت سرلیک','عنوان فعالیت'),L2('نېټه','تاریخ'),L2('ډول','نوع'),L2('ځای','مکان'),L2('ښوونځي','مدارس'),L2('غړي','اعضا'),L2('حالت','وضعیت'),L2('پایلې','نتایج')];
      const rows=acts.map(a=>[a.title||'—',a.date?U.fmtDateNum(a.date):'—',a.type?this.statusCell(a.type):'—',a.location||'—',this.idsCell(a.schoolIds,d.S,'name'),this.idsCell(a.memberIds,d.M,'fullName'),this.statusCell(a.status||'a_planned'),(a.results||'').slice(0,200)]);
      sections.push(this.sec(L2('فعالیتونه ('+acts.length+')','فعالیت‌ها ('+acts.length+')'), this.tbl(null,headers,rows)));
    }
    if(!only && obs.length){
      const headers=[L2('ښوونکی','معلم'),L2('څارونکی','ناظر'),L2('نېټه','تاریخ'),L2('مضمون','مضمون'),L2('نمره','نمره'),L2('سلنه','درصد'),L2('کچه','کیفیت'),L2('پام وړ ضعیف اړخونه','نقاط ضعف مهم')];
      const rows=obs.map(o=>[d.T[o.teacherId]?d.T[o.teacherId].fullName:'—',d.M[o.observerId]?d.M[o.observerId].fullName:'—',U.fmtDateNum(o.date),o.subject||'—',this.scoreStr(o),(o.percentage||0)+'%',this.qualityCell(o.percentage||0),(o.weaknesses||'').slice(0,160)]);
      sections.push(this.sec(L2('د تدریس څارنې ('+obs.length+')','مشاهدات تدریس ('+obs.length+')'), this.tbl(null,headers,rows)));
    }
    if(!only && pd.length){
      const headers=[L2('پروګرام','برنامه'),L2('نېټه','تاریخ'),L2('ډول','نوع'),L2('روزونکی','مربی'),L2('ګډونوال','شرکت‌کننده'),L2('ښوونځي','مدارس')];
      const rows=pd.map(p=>[p.title||'—',p.date?U.fmtDateNum(p.date):'—',p.type?this.statusCell(p.type):'—',p.trainer||'—',Number(p.participants||0),this.idsCell(p.schoolIds,d.S,'name')]);
      sections.push(this.sec(L2('د مسلکي پراختیا پروګرامونه ('+pd.length+')','برنامه‌های توسعه شغلی ('+pd.length+')'), this.tbl(null,headers,rows)));
    }
    if(mon.length){
      const headers=[L2('ښوونځي','مدارس'),L2('نېټه','تاریخ'),L2('غړي','اعضا'),L2('موخه','هدف'),L2('موندنې','یافته‌ها'),L2('ستونزې','مسائل')];
      const rows=mon.map(m=>[this.idsCell(m.schoolIds,d.S,'name'),U.fmtDateNum(m.date),this.idsCell(m.memberIds,d.M,'fullName'),(m.purpose||'').slice(0,140),(m.findings||'').slice(0,140),(m.problems||'').slice(0,140)]);
      sections.push(this.sec(L2('د ښوونځیو څارنه ('+mon.length+')','پایش مدارس ('+mon.length+')'), this.tbl(null,headers,rows)));
    }
    if(dutyF.length){
      const headers=[L2('دنده','وظیفه'),L2('مسوول غړي','مسئولان'),L2('ښوونځي','مدارس'),L2('مهلت','مهلت'),L2('حالت','وضعیت'),L2('پایله','نتیجه')];
      const rows=dutyF.map(x=>[x.title||'—',this.idsCell(x.memberIds,d.M,'fullName'),this.idsCell(x.schoolIds,d.S,'name'),x.deadline?U.fmtDateNum(x.deadline):'—',this.statusCell(x.status||'d_open'),(x.result||'').slice(0,120)]);
      sections.push(this.sec(L2('دندې ('+dutyF.length+')','وظایف ('+dutyF.length+')'), this.tbl(null,headers,rows)));
    }
    if(!only && (apF.length||mpF.length)){
      const headers=[L2('پلان','برنامه'),L2('ډول','نوع'),L2('مسوول غړي','مسئولان'),L2('حالت','وضعیت'),L2('بشپړتیا','انجام')];
      const rows=[
        ...apF.map(x=>[x.title||'—',L2('کلنی','سالانه'),this.idsCell(x.memberIds,d.M,'fullName'),this.statusCell(x.status||'p_planned'),(x.completion||0)+'%']),
        ...mpF.map(x=>[x.activity||'—',L2('میاشتنی','ماهانه'),this.idsCell(x.memberIds,d.M,'fullName'),this.statusCell(x.status||'mp_planned'),'—'])
      ];
      sections.push(this.sec(L2('پلانونه','برنامه‌ها'), this.tbl(null,headers,rows)));
    }

    /* summary & analysis (from real data) */
    const ps=[]; const fa=[];
    ps.push('د دې مودې پر مهال ټول کارونه: فعالیتونه '+acts.length+'، د تدریس څارنې '+obs.length+'، د ښوونځیو څارنې '+mon.length+'، د پراختیا پروګرامونه '+pd.length+'، دندې '+dutyF.length+'.');
    fa.push('کارهای این دوره: فعالیت‌ها '+acts.length+'، مشاهده تدریس '+obs.length+'، پایش مدارس '+mon.length+'، برنامه‌های توسعه '+pd.length+'، وظایف '+dutyF.length+'.');
    if(obs.length){
      const avg=Math.round(obs.reduce((a,o)=>a+Number(o.percentage||0),0)/obs.length);
      const weak=obs.filter(o=>(o.percentage||0)<61).length;
      ps.push('د تدریس څارنې اوسط نمره '+avg+'٪ ده؛ '+weak+' څارنې ښه کچه ترلاسه نه کړې او پام اړین دی.');
      fa.push('میانگین امتیاز مشاهده '+avg+'٪ بود؛ '+weak+' مشاهده به سطح مطلوب نرسیده و نیاز به توجه دارد.');
    }
    sections.push(this.sec(L2('پایله','نتیجه'), this.para(L2(ps.join('\n'),fa.join('\n')))));
    const probs=[...acts,...mon,...pd].map(r=>r.problems).filter(Boolean).join('\n\n');
    if(probs) sections.push(this.sec(L2('ستونزې','مسائل'), this.para(L2(probs,probs))));
    const recs=[...acts,...mon,...pd].map(r=>r.recommendations).filter(Boolean).join('\n\n');
    if(recs) sections.push(this.sec(L2('وړاندیزونه','پیشنهادها'), this.para(L2(recs,recs))));

    const tt=this.typeTitle(scope.team?'team':periodNameKey(period));
    return {title:L2(tt.ps+' — '+(s.district||''), tt.fa+' — '+(s.district||'')), sections:sections};
  },

  /* ================= MEMBER REPORT ================= */
  async memberReport(d, scope){
    const m=(scope.memberIds&&scope.memberIds[0])?d.M[scope.memberIds[0]]:null;
    if(!m) return {title:L2('د علمي غړي راپور','گزارش عضو علمی'), sections:[this.sec(L2('معلومات','معلومات'),this.para(L2('غړی نه موندل شو','عضو یافت نشود')))]};
    const range=this.periodRange('month', scope.start||U.todayISO());
    const acts=d.acts.filter(a=>(a.memberIds||[]).includes(m.id)&&this.inPeriod(a.date,range));
    const obs=d.obs.filter(o=>o.observerId===m.id&&this.inPeriod(o.date,range));
    const mon=d.mon.filter(x=>(x.memberIds||[]).includes(m.id)&&this.inPeriod(x.date,range));
    const pd=d.pd.filter(x=>(x.memberIds||[]).includes(m.id)&&this.inPeriod(x.date,range));
    const duties=d.duties.filter(x=>(x.memberIds||[]).includes(m.id));
    const dDone=duties.filter(x=>x.status==='d_done').length;
    const dOver=duties.filter(x=>(x.status==='d_open'||x.status==='d_progress')&&x.deadline&&U.isOverdue(x.deadline)).length;

    const sections=[];
    sections.push(this.sec(L2('د غړي معلومات','اطلاعات عضو'), this.tbl(null,[L2('معلومات','معلومات'),L2('ارزښت','مقدار')],[[L2('بشپړ نوم','نام کامل'),m.fullName],[L2('دنده','سمت'),m.position||'—'],[L2('تلیفون','تلفن'),m.phone||'—'],[L2('د مقررېدو نېټه','تاریخ انتصاب'),m.appointmentDate?U.fmtDateNum(m.appointmentDate):'—']])));
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2('دا راپور د '+m.fullName+' لخوا د '+U.fmtDate(range.start)+' تر '+U.fmtDate(range.end)+' پورې د ترسره شویو کارونو څیړنه ده.','این گزارش بررسی کارهای انجام‌شده توسط '+m.fullName+' از '+U.fmtDate(range.start)+' تا '+U.fmtDate(range.end)+' است.'))));
    sections.push(this.sec(L2('احصایې','آمار'), this.para(L2('فعالیتونه: '+acts.length+' — د تدریس څارنې: '+obs.length+' — د ښوونځیو څارنه: '+mon.length+' — د پراختیا پروګرامونه: '+pd.length+' — دندې بشپړې: '+dDone+' — دندې وروسته شوي: '+dOver+'.','فعالیت‌ها: '+acts.length+' — مشاهده تدریس: '+obs.length+' — پایش: '+mon.length+' — برنامه‌های توسعه: '+pd.length+' — وظایف انجام‌شده: '+dDone+' — وظایف معوق: '+dOver+'.'))));
    if(acts.length){
      const headers=[L2('سرلیک','عنوان'),L2('نېټه','تاریخ'),L2('ډول','نوع'),L2('حالت','وضعیت'),L2('پایلې','نتایج')];
      const rows=acts.map(a=>[a.title||'—',a.date?U.fmtDateNum(a.date):'—',a.type?this.statusCell(a.type):'—',this.statusCell(a.status||'a_planned'),(a.results||'').slice(0,160)]);
      sections.push(this.sec(L2('فعالیتونه','فعالیت‌ها'), this.tbl(null,headers,rows)));
    }
    if(obs.length){
      const headers=[L2('ښوونکی','معلم'),L2('نېټه','تاریخ'),L2('نمره','نمره'),L2('سلنه','درصد'),L2('کچه','کیفیت')];
      const rows=obs.map(o=>[d.T[o.teacherId]?d.T[o.teacherId].fullName:'—',U.fmtDateNum(o.date),this.scoreStr(o),(o.percentage||0)+'%',this.qualityCell(o.percentage||0)]);
      sections.push(this.sec(L2('د تدریس څارنې','مشاهدات'), this.tbl(null,headers,rows)));
    }
    if(mon.length){
      const headers=[L2('ښوونځی','مدرسه'),L2('نېټه','تاریخ'),L2('موندنې','یافته‌ها')];
      const rows=mon.map(x=>[this.idsCell(x.schoolIds,d.S,'name'),U.fmtDateNum(x.date),(x.findings||'').slice(0,140)]);
      sections.push(this.sec(L2('د ښوونځیو څارنه','پایش'), this.tbl(null,headers,rows)));
    }
    if(duties.length){
      const headers=[L2('دنده','وظیفه'),L2('مهلت','مهلت'),L2('حالت','وضعیت')];
      const rows=duties.map(x=>[x.title||'—',x.deadline?U.fmtDateNum(x.deadline):'—',this.statusCell(x.status||'d_open')]);
      sections.push(this.sec(L2('دندې','وظایف'), this.tbl(null,headers,rows)));
    }
    return {title:L2('د علمي غړي راپور — '+m.fullName, 'گزارش عضو علمی — '+m.fullName), sections:sections};
  },

  /* ================= SCHOOL REPORT ================= */
  async schoolReport(d, scope){
    const sid=scope.schoolIds&&scope.schoolIds[0];
    const sch=sid?d.S[sid]:null;
    if(!sch) return {title:L2('د ښوونځي راپور','گزارش مدرسه'), sections:[this.sec(L2('معلومات','معلومات'),this.para(L2('ښوونځی نه موندل شو','مدرسه یافت نشود')))]};
    const teachers=d.teachers.filter(t=>t.schoolId===sid);
    const employees=d.employees.filter(e=>e.schoolId===sid);
    const stats=d.studentStats.filter(x=>x.schoolId===sid);
    const mon=d.mon.filter(m=>(m.schoolIds||[]).includes(sid));
    const acts=d.acts.filter(a=>(a.schoolIds||[]).includes(sid));
    const obs=d.obs.filter(o=>d.T[o.teacherId]&&d.T[o.teacherId].schoolId===sid);
    const tt=(window.StudentStatsModule?StudentStatsModule.totals(stats):{t:0}).t;
    const staffTotal=teachers.length+employees.length;

    const sections=[];
    sections.push(this.sec(L2('د ښوونځي معلومات','اطلاعات مدرسه'), this.tbl(null,[L2('معلومات','معلومات'),L2('ارزښت','مقدار')],[
      [L2('نوم','نام'),sch.name],[L2('کوډ','کد'),sch.code||'—'],
      [L2('کلی','روستا'),sch.village||'—'],[L2('تعلیمي کچه','سطح تحصیلی'),U.tv(sch.level)||'—'],
      [L2('ملکیت / ادارې ډول','مالکیت / اداره'),U.tv(sch.ownership)||'—'],
      [L2('جنسیتي ډول','نوع جنسیت'),sch.genderType?this.statusCell(sch.genderType):'—'],[L2('مدیر','مدیر'),sch.principal||'—'],
      [L2('تلیفون','تلفن'),sch.phone||'—'],[L2('د تاسیس کال','سال تأسیس'),sch.establishedYear||'—']
    ])));
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      'ښوونځی '+sch.name+' په '+(sch.village||'')+' کې د '+teachers.length+' ښوونکو، '+employees.length+' کارکوونکو او '+tt+' زده کوونکو سره کار کوي. د دې ښوونځي ټول کارکوونکي '+staffTotal+' دي.',
      'مدرسه '+sch.name+' در '+(sch.village||'')+' با '+teachers.length+' معلم، '+employees.length+' کارمند و '+tt+' دانش‌آموز فعالیت دارد. مجموع کارکنان این مدرسه '+staffTotal+' است.'))));
    if(teachers.length){
      const headers=[L2('نوم','نام'),L2('مضمون','مضمون'),L2('جنسیت','جنسیت'),L2('زده کړه','تحصیلات')];
      const rows=teachers.map(t=>[t.fullName,t.subject||'—',t.gender?this.statusCell('pg_'+t.gender):'—',t.education?U.t(t.education):'—']);
      sections.push(this.sec(L2('ښوونکي','معلمان'), this.tbl(null,headers,rows)));
    } else sections.push(this.sec(L2('ښوونکي','معلمان'), this.para(L2('ښوونکي نشته','بدون معلم'))));
    if(employees.length){
      const headers=[L2('نوم','نام'),L2('دنده','سمت'),L2('جنسیت','جنسیت')];
      const rows=employees.map(e=>[e.fullName,e.position?U.t(e.position):'—',e.gender?this.statusCell('pg_'+e.gender):'—']);
      sections.push(this.sec(L2('کارکوونکي','کارکنان'), this.tbl(null,headers,rows)));
    } else sections.push(this.sec(L2('کارکوونکي','کارکنان'), this.para(L2('کارکوونکي نشته','بدون کارمند'))));
    if(stats.length){
      const headers=[L2('ټولګی','پایه'),L2('کال','سال'),L2('جنسیت','جنسیت'),L2('هلکان','پسران'),L2('نجونې','دختران'),L2('مجموعه','جمع')];
      const rows=stats.map(x=>[this.gradeOf(x.className)+(x.section?' — '+x.section:''),x.academicYear||'—',x.genderMode?this.statusCell('g_'+x.genderMode):'—',Number(x.maleCount||0),Number(x.femaleCount||0),Number(x.maleCount||0)+Number(x.femaleCount||0)]);
      sections.push(this.sec(L2('د زده کوونکو احصایې','آمار دانش‌آموزان'), this.tbl(null,headers,rows,{numCols:[3,4,5]})));
    } else sections.push(this.sec(L2('د زده کوونکو احصایې','آمار دانش‌آموزان'), this.para(L2('احصایې نشته','بدون آمار'))));
    {
      const tm={}; teachers.forEach(t=>{ const k=t.subject||'—'; tm[k]=(tm[k]||0)+1; });
      const em={}; employees.forEach(e=>{ const k=e.position?U.t(e.position):'—'; em[k]=(em[k]||0)+1; });
      const trows=Object.keys(tm).sort((a,b)=>a.localeCompare(b,'ps')).map(k=>[k,U.t('staffTeacherKind'),tm[k]]);
      const erows=Object.keys(em).sort((a,b)=>a.localeCompare(b,'ps')).map(k=>[k,U.t('staffEmployeeKind'),em[k]]);
      const rows=trows.concat(erows).concat([[U.t('total'),'',staffTotal]]);
      sections.push(this.sec(L2('تشکیل','تأسیلات'), this.tbl(null,[L2('دنده / مضمون','سمت / مضمون'),L2('ډول','نوع'),L2('شمېر','تعداد')],rows,{numCols:[2]})));
    }
    if(obs.length){
      const headers=[L2('ښوونکی','معلم'),L2('نېټه','تاریخ'),L2('نمره','نمره'),L2('سلنه','درصد')];
      const rows=obs.map(o=>[d.T[o.teacherId]?d.T[o.teacherId].fullName:'—',U.fmtDateNum(o.date),this.scoreStr(o),(o.percentage||0)+'%']);
      sections.push(this.sec(L2('د تدریس څارنې','مشاهدات'), this.tbl(null,headers,rows)));
    } else sections.push(this.sec(L2('د تدریس څارنې','مشاهدات'), this.para(L2('څارنه نه ده شوې','مشاهده‌ای انجام نشده'))));
    if(mon.length||acts.length){
      const headers=[L2('نوم','عنوان'),L2('نېټه','تاریخ'),L2('ډول','نوع'),L2('حالت','وضعیت')];
      const rows=[
        ...mon.map(m2=>[m2.purpose||'—',U.fmtDateNum(m2.date),L2('څارنه','پایش'),this.statusCell(m2.status||'mng_done')]),
        ...acts.map(a=>[a.title||'—',a.date?U.fmtDateNum(a.date):'—',a.type?this.statusCell(a.type):'—',this.statusCell(a.status||'a_planned')])
      ];
      sections.push(this.sec(L2('څارنه او فعالیتونه','پایش و فعالیت‌ها'), this.tbl(null,headers,rows)));
    }
    return {title:L2('د ښوونځي راپور — '+sch.name,'گزارش مدرسه — '+sch.name), sections:sections};
  },

  /* ================= TEACHER REPORT ================= */
  async teacherReport(d, scope){
    const t=scope.teacherId?d.T[scope.teacherId]:null;
    if(!t) return {title:L2('د ښوونکي راپور','گزارش معلم'), sections:[this.sec(L2('معلومات','معلومات'),this.para(L2('ښوونکی نه موندل شو','معلم یافت نشود')))]};
    const obs=d.obs.filter(o=>o.teacherId===t.id).sort((a,b)=>(a.observationNumber||0)-(b.observationNumber||0));
    const sections=[];
    sections.push(this.sec(L2('د ښوونکي معلومات','اطلاعات معلم'), this.tbl(null,[L2('معلومات','معلومات'),L2('ارزښت','مقدار')],[
      [L2('بشپړ نوم','نام کامل'),t.fullName],[L2('د پلار نوم','نام پدر'),t.fatherName||'—'],
      [L2('ښوونځی','مدرسه'),d.S[t.schoolId]?d.S[t.schoolId].name:'—'],[L2('مضمون','مضمون'),t.subject||'—'],
      [L2('زده کړه','تحصیلات'),t.education?U.t(t.education):'—'],[L2('تجربه','سابقه'),t.experience!==''&&t.experience!==undefined?String(t.experience):'—'],
      [L2('د مقررېدو نېټه','تاریخ انتصاب'),t.appointmentDate?U.fmtDateNum(t.appointmentDate):'—']
    ])));
    if(obs.length){
      const headers=[L2('شمېره','شماره'),L2('نېټه','تاریخ'),L2('څارونکی','ناظر'),L2('مضمون','مضمون'),L2('نمره','نمره'),L2('سلنه','درصد'),L2('کچه','کیفیت')];
      const rows=obs.map(o=>[o.observationNumber,U.fmtDateNum(o.date),d.M[o.observerId]?d.M[o.observerId].fullName:'—',o.subject||'—',this.scoreStr(o),(o.percentage||0)+'%',this.qualityCell(o.percentage||0)]);
      sections.push(this.sec(L2('د څارنې تاریخ','تاریخچه مشاهده'), this.tbl(null,headers,rows)));
      const avg=Math.round(obs.reduce((a,o)=>a+Number(o.percentage||0),0)/obs.length);
      const last=obs[obs.length-1];
      sections.push(this.sec(L2('تحلیل','تحلیل'), this.para(L2(
        'دا ښوونکی ټولې '+obs.length+' څارنې ترسره کړې دي، اوسط نمره يې '+avg+'٪ ده. وروستۍ څارنه د '+U.fmtDate(last.date)+' په نېټه ترسره شوه.',
        'این معلم '+obs.length+' مشاهده انجام داده است و میانگین امتیاز '+avg+'٪ است. آخرین مشاهده در '+U.fmtDate(last.date)+' انجام شد.'))));
      const recs=obs.map(o=>o.recommendations).filter(Boolean).join('\n\n');
      if(recs) sections.push(this.sec(L2('وړاندیزونه','پیشنهادها'), this.para(L2(recs,recs))));
    } else {
      sections.push(this.sec(L2('د څارنې تاریخ','تاریخچه مشاهده'), this.para(L2('څارنه نه ده شوې','مشاهده‌ای انجام نشده'))));
    }
    return {title:L2('د ښوونکي راپور — '+t.fullName,'گزارش معلم — '+t.fullName), sections:sections};
  },

  /* ================= OBSERVATION REPORT ================= */
  async observationReport(d, scope){
    const o=scope.observationId?d.obs.find(x=>x.id===scope.observationId):null;
    if(!o) return {title:L2('د څارنې راپور','گزارش مشاهده'), sections:[this.sec(L2('معلومات','معلومات'),this.para(L2('څارنه نه موندل شوه','مشاهده یافت نشود')))]};
    const t=d.T[o.teacherId], m=d.M[o.observerId];
    const sections=[];
    sections.push(this.sec(L2('د څارنې معلومات','اطلاعات مشاهده'), this.tbl(null,[L2('معلومات','معلومات'),L2('ارزښت','مقدار')],[
      [L2('ښوونکی','معلم'),t?t.fullName:'—'],[L2('څارونکی','ناظر'),m?m.fullName:'—'],
      [L2('نېټه','تاریخ'),U.fmtDateNum(o.date)],[L2('د څارنې شمېره','شماره مشاهده'),o.observationNumber],
      [L2('تعلیمي کال','سال تحصیلی'),o.academicYear||'—'],[L2('مضمون','مضمون'),o.subject||'—'],
      [L2('ټولګی','کلاس'),this.gradeOf(o.className)],[L2('برخه','بخش'),o.section||'—'],
      [L2('د درس موضوع','موضوع درس'),o.topic||'—'],[L2('موده','مدت'),o.duration||'—']
    ])));
    const headers=[L2('#','#'),L2('معیار','معیار'),L2('اعظمي','حداکثر'),L2('اخیستل','کسب'),L2('څرګندونه','تبصره')];
    const rows=(o.criteria||[]).map((c,i)=>[i+1,U.tv(c),Number(c.maxScore||0),Number(c.score||0),c.comment||'']);
    sections.push(this.sec(L2('نمرې','نمره‌دهی'), this.tbl(null,headers,rows,{numCols:[0,2,3]})));
    sections.push(this.sec(L2('پایله','نتیجه‌گیری'), this.para(L2(
      'ټوله نمره: '+this.scoreStr(o)+' — د سلنې نمره: '+(o.percentage||0)+'٪ — کچه: '+Settings.quality(o.percentage||0).ps,
      'نمره کلی: '+this.scoreStr(o)+' — درصد: '+(o.percentage||0)+'٪ — کیفیت: '+Settings.quality(o.percentage||0).fa))));
    sections.push(this.sec(L2('قوي اړخونه','نقاط قوت'), this.para(L2(o.strengths||'—',o.strengths||'—'))));
    sections.push(this.sec(L2('ضعیف اړخونه','نقاط ضعف'), this.para(L2(o.weaknesses||'—',o.weaknesses||'—'))));
    sections.push(this.sec(L2('وړاندیزونه','پیشنهادها'), this.para(L2(o.recommendations||'—',o.recommendations||'—'))));
    sections.push(this.sec(L2('عمومي موندنې','یافته‌های عمومی'), this.para(L2(o.generalFindings||'—',o.generalFindings||'—'))));
    return {title:L2('د څارنې راپور — '+(t?t.fullName:'')+' ('+(o.observationNumber||'')+')','گزارش مشاهده — '+(t?t.fullName:'')+' ('+(o.observationNumber||'')+')'), sections:sections};
  },

  /* ================= STUDENTS REPORT ================= */
  async studentsReport(d, scope){
    const year=scope.academicYear||Settings.get().academicYear;
    const sF=d.studentStats.filter(x=>(!scope.schoolIds||scope.schoolIds.includes(x.schoolId))&&(!year||String(x.academicYear)===String(year)));
    const sTot=(window.StudentStatsModule?StudentStatsModule.totals(sF):{m:0,g:0,t:0});
    const tt=sTot.t, tb=sTot.m, tg=sTot.g;
    const bySchool={};
    sF.forEach(x=>{
      bySchool[x.schoolId]=bySchool[x.schoolId]||{b:0,g:0};
      bySchool[x.schoolId].b+=Number(x.maleCount||0);
      bySchool[x.schoolId].g+=Number(x.femaleCount||0);
    });
    const rows=Object.keys(bySchool).map(sid=>[d.S[sid]?d.S[sid].name:'—',bySchool[sid].b,bySchool[sid].g,bySchool[sid].b+bySchool[sid].g]);
    const sections=[];
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      'په '+year+' تعلیمي کال کې ټول زده کوونکي '+tt+' دي، له دې څخه '+tb+' هلکان او '+tg+' نجونې دي.',
      'در سال تحصیلی '+year+' مجموع دانش‌آموزان '+tt+' است که از آن '+tb+' پسر و '+tg+' دختر می‌باشد.'))));
    if(rows.length){
      sections.push(this.sec(L2('د ښوونځیو له مخې','بر اساس مدرسه'), this.tbl(null,[L2('ښوونځی','مدرسه'),L2('هلکان','پسران'),L2('نجونې','دختران'),L2('ټول','جمع')],rows,{numCols:[1,2,3]})));
    } else {
      sections.push(this.sec(L2('د ښوونځیو له مخې','بر اساس مدرسه'), this.para(L2('معلومات نشته','داده‌ای موجود نیست'))));
    }
    return {title:L2('د زده کوونکو احصایې راپور — '+year,'گزارش آمار دانش‌آموزان — '+year), sections:sections};
  },

  /* ================= TASHKIL REPORT (auto-computed from teachers+employees) ================= */
  async tashkilReport(d, scope){
    const T=d.teachers.filter(t=>!scope.schoolIds||scope.schoolIds.includes(t.schoolId));
    const E=d.employees.filter(e=>!scope.schoolIds||scope.schoolIds.includes(e.schoolId));
    const bySchool={};
    d.schools.filter(sch=>!scope.schoolIds||scope.schoolIds.includes(sch.id)).forEach(sch=>{
      const tc=T.filter(t=>t.schoolId===sch.id).length;
      const ec=E.filter(e=>e.schoolId===sch.id).length;
      bySchool[sch.name]=[tc,ec,tc+ec];
    });
    const rows=Object.keys(bySchool).map(name=>[name,bySchool[name][0],bySchool[name][1],bySchool[name][2]]);
    const totalT=T.length, totalE=E.length;
    const sections=[];
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      U.t('autoTashkilNote')+' د ښوونکو شمېر: '+totalT+'، د کارکوونکو شمېر: '+totalE+'، او ټول کارکوونکي: '+(totalT+totalE)+' دي.',
      'مجموع معلمان: '+totalT+'، مجموع کارکنان: '+totalE+' و کل کارکنان: '+(totalT+totalE)+' است. این آمار به‌صورت خودکار محاسبه می‌شود.'))));
    if(rows.length){
      rows.push([L2('ټول','مجموع'),totalT,totalE,totalT+totalE]);
      sections.push(this.sec(L2('د ښوونځیو له مخې','بر اساس مدرسه'), this.tbl(null,[L2('ښوونځی','مدرسه'),L2('ښوونکي','معلمان'),L2('کارکوونکي','کارکنان'),L2('ټول','مجموع')],rows,{numCols:[1,2,3]})));
    } else {
      sections.push(this.sec(L2('د ښوونځیو له مخې','بر اساس مدرسه'), this.para(L2('معلومات نشته','داده‌ای موجود نیست'))));
    }
    return {title:L2('د تشکیل راپور','گزارش تأسیلات'), sections:sections};
  },

  /* ================= PROFESSIONAL DEVELOPMENT REPORT ================= */
  async profdevReport(d, scope){
    const pF=d.pd.filter(p=>(!scope.memberIds||scope.memberIds.some(m2=>(p.memberIds||[]).includes(m2)))&&(!scope.schoolIds||scope.schoolIds.some(s2=>(p.schoolIds||[]).includes(s2))));
    const tp=U.sum(pF,p=>Number(p.participants||0));
    const tm=U.sum(pF,p=>Number(p.maleCount||0));
    const tf=U.sum(pF,p=>Number(p.femaleCount||0));
    const sections=[];
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      'په دې موده کې '+pF.length+' د مسلکي پراختیا پروګرامونه ترسره شول، ټول ګډونوال '+tp+' دي ('+tm+' هلکان، '+tf+' نجونې).',
      'در این دوره '+pF.length+' برنامه توسعه شغلی اجرا شد؛ مجموع شرکت‌کنندگان '+tp+' است ('+tm+' پسر، '+tf+' دختر).'))));
    if(pF.length){
      const headers=[L2('پروګرام','برنامه'),L2('نېټه','تاریخ'),L2('ډول','نوع'),L2('روزونکی','مربی'),L2('ګډونوال','شرکت‌کننده'),L2('ښوونځي','مدارس'),L2('پایلې','نتایج')];
      const rows=pF.map(p=>[p.title||'—',p.date?U.fmtDateNum(p.date):'—',p.type?this.statusCell(p.type):'—',p.trainer||'—',Number(p.participants||0),this.idsCell(p.schoolIds,d.S,'name'),(p.results||'').slice(0,140)]);
      sections.push(this.sec(L2('پروګرامونه','برنامه‌ها'), this.tbl(null,headers,rows)));
    }
    const recs=pF.map(p=>p.recommendations).filter(Boolean).join('\n\n');
    if(recs) sections.push(this.sec(L2('وړاندیزونه','پیشنهادها'), this.para(L2(recs,recs))));
    return {title:L2('د مسلکي پراختیا راپور','گزارش توسعه شغلی'), sections:sections};
  },

  /* ================= PLAN REPORT ================= */
  async planReport(d, scope){
    const pF=d.ap.filter(p=>(!scope.memberIds||scope.memberIds.some(m2=>(p.memberIds||[]).includes(m2))));
    const done=pF.filter(p=>p.status==='p_done').length;
    const prog=pF.filter(p=>p.status==='p_inprogress').length;
    const avg=pF.length?Math.round(pF.reduce((a,p)=>a+Number(p.completion||0),0)/pF.length):0;
    const sections=[];
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      'ټول کلني پلانونه '+pF.length+' دي؛ بشپړ شوي '+done+'، روان '+prog+'، اوسط بشپړتیا '+avg+'٪.',
      'مجموع برنامه‌های سالانه '+pF.length+' است؛ انجام شده '+done+'، در حال اجرا '+prog+'، میانگین انجام '+avg+'٪.'))));
    if(pF.length){
      const headers=[L2('پلان','برنامه'),L2('مسوول غړي','مسئولان'),L2('ښوونځي','مدارس'),L2('د پیل نېټه','شروع'),L2('د پای نېټه','پایان'),L2('حالت','وضعیت'),L2('بشپړتیا','انجام')];
      const rows=pF.map(p=>[p.title||'—',this.idsCell(p.memberIds,d.M,'fullName'),this.idsCell(p.schoolIds,d.S,'name'),p.startDate?U.fmtDateNum(p.startDate):'—',p.endDate?U.fmtDateNum(p.endDate):'—',this.statusCell(p.status||'p_planned'),(p.completion||0)+'%']);
      sections.push(this.sec(L2('پلانونه','برنامه‌ها'), this.tbl(null,headers,rows)));
    }
    const notes=pF.map(p=>p.notes).filter(Boolean).join('\n\n');
    if(notes) sections.push(this.sec(L2('یادونه','یادداشت'), this.para(L2(notes,notes))));
    return {title:L2('د پلان پرمختګ راپور','گزارش پیشرفت برنامه'), sections:sections};
  },

  /* ================= DUTY REPORT ================= */
  async dutyReport(d, scope){
    const dutyF=d.duties.filter(p=>(!scope.memberIds||scope.memberIds.some(m2=>(p.memberIds||[]).includes(m2))));
    const done=dutyF.filter(p=>p.status==='d_done').length;
    const overdue=dutyF.filter(p=>(p.status==='d_open'||p.status==='d_progress')&&p.deadline&&U.isOverdue(p.deadline)).length;
    const sections=[];
    sections.push(this.sec(L2('لنډیز','مقدمه'), this.para(L2(
      'ټولې دندې '+dutyF.length+' دي؛ بشپړې '+done+'، وروسته شوې '+overdue+'.',
      'مجموع وظایف '+dutyF.length+' است؛ انجام شده '+done+'، معوق '+overdue+'.'))));
    if(dutyF.length){
      const headers=[L2('دنده','وظیفه'),L2('مسوول غړي','مسئولان'),L2('ښوونځي','مدارس'),L2('مهلت','مهلت'),L2('حالت','وضعیت'),L2('پایله','نتیجه')];
      const rows=dutyF.map(p=>[p.title||'—',this.idsCell(p.memberIds,d.M,'fullName'),this.idsCell(p.schoolIds,d.S,'name'),p.deadline?U.fmtDateNum(p.deadline):'—',this.statusCell(p.status||'d_open'),(p.result||'').slice(0,120)]);
      sections.push(this.sec(L2('دندې','وظایف'), this.tbl(null,headers,rows)));
    }
    return {title:L2('د دندو راپور','گزارش وظایف'), sections:sections};
  },

  /* ================= ACTIVITY REPORT ================= */
  async activityReport(d, scope){
    const a=scope.activityId?d.acts.find(x=>x.id===scope.activityId):null;
    if(!a) return {title:L2('د فعالیت راپور','گزارش فعالیت'), sections:[this.sec(L2('معلومات','معلومات'),this.para(L2('فعالیت نه موندل شول','فعالیت یافت نشد')))]};
    const sections=[];
    sections.push(this.sec(L2('د فعالیت معلومات','اطلاعات فعالیت'), this.tbl(null,[L2('معلومات','معلومات'),L2('ارزښت','مقدار')],[
      [L2('سرلیک','عنوان'),a.title||'—'],[L2('ډول','نوع'),a.type?this.statusCell(a.type):'—'],
      [L2('نېټه','تاریخ'),a.date?U.fmtDateNum(a.date):'—'],[L2('ځای','مکان'),a.location||'—'],
      [L2('ښوونځي','مدارس'),this.idsCell(a.schoolIds,d.S,'name')],[L2('غړي','اعضا'),this.idsCell(a.memberIds,d.M,'fullName')],
      [L2('ګډونوال','شرکت‌کننده'),a.participants?Number(a.participants):'—'],[L2('حالت','وضعیت'),this.statusCell(a.status||'a_planned')]
    ])));
    sections.push(this.sec(L2('توضیح','توضیح'), this.para(L2(a.description||'—',a.description||'—'))));
    sections.push(this.sec(L2('پایلې','نتایج'), this.para(L2(a.results||'—',a.results||'—'))));
    sections.push(this.sec(L2('ستونزې','مسائل'), this.para(L2(a.problems||'—',a.problems||'—'))));
    sections.push(this.sec(L2('وړاندیزونه','پیشنهادها'), this.para(L2(a.recommendations||'—',a.recommendations||'—'))));
    sections.push(this.sec(L2('یادونه','یادداشت'), this.para(L2(a.notes||'—',a.notes||'—'))));
    return {title:L2('د فعالیت راپور — '+(a.title||''),'گزارش فعالیت — '+(a.title||'')), sections:sections};
  }
};

/* ================= rendering ================= */
ReportGen.tvL=function(v, lang){
  lang=lang||U.currentLang();
  if(v===null||v===undefined||v==='') return '';
  if(typeof v==='object'&&(v.ps!==undefined||v.fa!==undefined)) return v[lang]||v.ps||v.fa||'';
  return String(v);
};
ReportGen.cellV=function(c, lang){
  if(c===null||c===undefined||c==='') return '—';
  if(typeof c==='number') return U.num(c);
  if(typeof c==='object') return String(this.tvL(c, lang));
  return String(c);
};
ReportGen.render=function(report, lang){
  lang=lang||U.currentLang();
  const self=this;
  const sections=(report.sections||[]).map(function(sec,i){
    let inner='';
    const c=sec.content||{};
    (c.paras||[]).forEach(function(p){ inner+='<p>'+U.escapeHtml(self.tvL(p,lang)).replace(/\n/g,'<br>')+'</p>'; });
    (c.tables||[]).forEach(function(tb){
      if(tb.caption) inner+='<p class="strong small">'+U.escapeHtml(self.tvL(tb.caption,lang))+'</p>';
      inner+='<div class="table-wrap"><table class="data"><thead><tr>'+
        (tb.headers||[]).map(function(h){ return '<th>'+U.escapeHtml(self.tvL(h,lang))+'</th>'; }).join('')+'</tr></thead><tbody>'+
        (tb.rows||[]).map(function(r){ return '<tr>'+r.map(function(cell){ return '<td>'+U.escapeHtml(self.cellV(cell,lang))+'</td>'; }).join('')+'</tr>'; }).join('')+
        '</tbody></table></div>';
    });
    return '<div class="rv-section"><h4><span class="rv-no">'+(i+1)+'</span>'+U.escapeHtml(self.tvL(sec.heading,lang))+'</h4>'+inner+'</div>';
  }).join('');
  return sections;
};

/* print a report (A4 official) */
ReportGen.renderSecForPrint=function(sec){
  const self=this;
  let html='';
  const c=sec.content||{};
  (c.paras||[]).forEach(function(p){ html+='<p>'+U.escapeHtml(U.tv(p)).replace(/\n/g,'<br>')+'</p>'; });
  (c.tables||[]).forEach(function(tb){
    const opts=Object.assign({}, tb.opts||{});
    html+=PrintDoc.table(tb.headers||[], (tb.rows||[]).map(function(r){ return r.map(function(cell){ return self.cellV(cell); }); }), opts);
  });
  return html;
};
ReportGen.printReport=async function(report){
  const doc=await PrintDoc.officialDoc({
    seqType:'report',
    title: U.tv(report.title),
    meta:[{k:U.t('reportType'),v:U.t(ReportGen.types[report.type]?ReportGen.types[report.type].title:'repDaily')},
          {k:U.t('generatedAt'),v:U.fmtDate(report.createdAt)}],
    sections: (report.sections||[]).map(function(sec){
      return {heading: U.tv(sec.heading), html: ReportGen.renderSecForPrint(sec)};
    })
  });
  PrintDoc.preview(doc, U.t('print'));
};

window.ReportGen = ReportGen;
})();
