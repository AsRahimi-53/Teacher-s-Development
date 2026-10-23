/* =====================================================================
   statistics.js — district statistics & analysis (teachers, students,
   tashkil, observations) with filters and Excel export.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const GENDER_OPTS=[{v:'boys',ps:'نارینه',fa:'مرد'},{v:'girls',ps:'ښځینه',fa:'زن'}];
const ST={gender:'',subject:'',school:'',year:''};

register('statistics', {render: async ()=>{
  Nav.setActive('statistics');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navStatistics')}]);
  const view=document.getElementById('view');
  const [teachers,schools,stats,employees,obs,members]=await Promise.all([
    DB.getAll('teachers'),DB.getAll('schools'),DB.getAll('studentStats'),
    DB.getAll('employees'),DB.getAll('observations'),DB.getAll('members')
  ]);
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  window.__memberName=Object.fromEntries(members.map(m=>[m.id,m.fullName]));
  const bySchool=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  const byTeacher=Object.fromEntries(teachers.map(t=>[t.id,t]));
  const year=Settings.get().academicYear;
  const tFiltered=()=>teachers.filter(t=>{
    if(ST.gender&&t.gender!==ST.gender) return false;
    if(ST.subject&&t.subject!==ST.subject) return false;
    if(ST.school&&t.schoolId!==ST.school) return false;
    return true;
  });

  const sss=stats.filter(s=>!ST.school||s.schoolId===ST.school);
  const sTot=window.StudentStatsModule?StudentStatsModule.totals(sss):{m:0,g:0,t:0};
  const totalS=sTot.t;
  const totalB=sTot.m;
  const totalG=sTot.g;
  const totalStaff=teachers.length+employees.length;
  const yrObs=obs.filter(o=>String(o.academicYear)===String(year));
  const perT={};
  yrObs.forEach(o=>{ perT[o.teacherId]=(perT[o.teacherId]||0)+1; });
  const c4=Object.values(perT).filter(x=>x>=4).length;
  const c3=Object.values(perT).filter(x=>x===3).length;
  const c2=Object.values(perT).filter(x=>x===2).length;
  const c1=Object.values(perT).filter(x=>x===1).length;
  const c0=Math.max(0,teachers.length-Object.keys(perT).length);

  const subjects=[...new Set(teachers.map(t=>t.subject).filter(Boolean))].sort();

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('pie')+'</div>'+
      '<div><h1>'+U.t('statsTitle')+'</h1><div class="ph-sub">'+U.t('appSub')+'</div></div>'+
      '<div class="ph-actions"><button class="btn btn-outline" id="stExport">'+U.icon('download')+U.t('exportExcel')+'</button></div>'+
    '</div>'+
    '<div class="toolbar">'+
      '<select class="flt" id="stGender"><option value="">'+U.t('gender')+': '+U.t('all')+'</option>'+GENDER_OPTS.map(g=>'<option value="'+g.v+'">'+U.tv(g)+'</option>').join('')+'</select>'+
      '<select class="flt" id="stSubject"><option value="">'+U.t('subject')+': '+U.t('all')+'</option>'+subjects.map(s=>'<option value="'+U.escapeHtml(s)+'">'+U.escapeHtml(s)+'</option>').join('')+'</select>'+
      '<select class="flt" id="stSchool"><option value="">'+U.t('school')+': '+U.t('all')+'</option>'+schools.map(s=>'<option value="'+s.id+'">'+U.escapeHtml(s.name)+'</option>').join('')+'</select>'+
    '</div>'+
    '<div id="stBody"></div>';

  const hbar=(items, max, colors)=>{
    if(!items.length) return U.emptyState('chart',U.t('noData'));
    const mx=max||Math.max(...items.map(i=>i[1]),1);
    return '<div class="hbar-chart">'+items.map(i=>{
      const w=mx?Math.round(i[1]/mx*100):0;
      const c=(colors&&colors[i[0]])||'var(--primary)';
      return '<div class="hbar-row"><div class="hb-label">'+U.escapeHtml(i[0])+'</div>'+
        '<div class="hbar-track"><div class="hbar-seg" style="width:'+w+'%;background:'+c+'"></div></div>'+
        '<div class="hb-val">'+U.num(i[1])+'</div></div>';
    }).join('')+'</div>';
  };

  const render=()=>{
    const t2=tFiltered();
    const tB=t2.filter(t=>t.gender==='boys').length;
    const tG=t2.filter(t=>t.gender==='girls').length;

    const bySub=groupByCount(t2,t=>t.subject||'—');
    const byQ=groupByCount(t2,t=>t.education?U.t(t.education):'—');
    const bySt=groupByCount(t2,t=>t.status?U.statusLabel(t.status):'—');
    const byPos=groupByCount(t2,t=>t.position||'—');
    const byExp=[
      [U.t('expLess1'),t2.filter(t=>Number(t.experience||0)<1).length],
      [U.t('exp1to5'),t2.filter(t=>{const e=Number(t.experience||0);return e>=1&&e<5;}).length],
      [U.t('exp5to10'),t2.filter(t=>{const e=Number(t.experience||0);return e>=5&&e<10;}).length],
      [U.t('exp10plus'),t2.filter(t=>Number(t.experience||0)>=10).length]
    ];
    const bySchS=Object.keys(bySchool).map(sid=>[bySchool[sid], t2.filter(t=>t.schoolId===sid).length]).sort((a,b)=>b[1]-a[1]).slice(0,10);

    // students
    const sF=sss.filter(s=>!ST.school||s.schoolId===ST.school);
    const sF2=window.StudentStatsModule?StudentStatsModule.totals(sF):{m:0,g:0,t:0};
    const tS=sF2.t;
    const tB2=sF2.m;
    const tG2=sF2.g;
    const bySchStud=Object.keys(bySchool).map(sid=>{
      const rs=sF.filter(s=>s.schoolId===sid);
      return [bySchool[sid], window.StudentStatsModule?StudentStatsModule.totals(rs).t:0];
    }).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const byGrade=(()=>{
      const m={};
      sF.forEach(s=>{ m[s.className]=(m[s.className]||0)+Number(s.maleCount||0)+Number(s.femaleCount||0); });
      return Object.keys(m).sort((a,b)=>Number(a)-Number(b)).map(g=>[gradeName(g),m[g]]);
    })();

    document.getElementById('stBody').innerHTML=
      '<div class="stat-grid mb-3">'+
        card(t2.length,U.t('totalTeachers'),'gradcap')+card(tB,U.t('totalBoys'),'male')+card(tG,U.t('totalGirls'),'female')+
        card(tS,U.t('totalStudents'),'chart')+card(totalStaff,U.t('totalStaff'),'layers')+card(employees.length,U.t('navEmployees'),'briefcase')+
        card(yrObs.length,U.t('totalObservations'),'eye')+card(members.length,U.t('totalMembers'),'users')+
      '</div>'+
      '<div class="grid-2 mb-3">'+
        sec(U.t('teachersByGender'), donutHTML(tB,tG,U.t('male'),U.t('female')) +
          '<div class="mt-2 small muted">'+U.t('boysPct')+': <b>'+(tB+tG?Math.round(tB/(tB+tG)*100):0)+'%</b> · '+U.t('girlsPct')+': <b>'+(tB+tG?Math.round(tG/(tB+tG)*100):0)+'%</b></div>')+
        sec(U.t('teachersBySubject'), hbar(bySub.slice(0,10))) +
      '</div>'+
      '<div class="grid-2 mb-3">'+
        sec(U.t('teachersByQual'), hbar(byQ.slice(0,8))) +
        sec(U.t('teachersByStatus'), hbar(bySt)) +
      '</div>'+
      '<div class="grid-2 mb-3">'+
        sec(U.t('teachersByExp'), hbar(byExp)) +
        sec(U.t('teachersByPos'), hbar(byPos.slice(0,8))) +
      '</div>'+
      '<div class="grid-2 mb-3">'+
        sec(U.t('teachersBySchool'), hbar(bySchS)) +
        sec(U.t('studentsBySchool'), hbar(bySchStud,'')) +
      '</div>'+
      '<div class="grid-2 mb-3">'+
        sec(U.t('studentsByGrade'), hbar(byGrade)) +
        sec(U.t('studentsByGender'), donutHTML(tB2,tG2) +
          '<div class="mt-2 small muted">'+U.t('boysPct')+': <b>'+(tB2+tG2?Math.round(tB2/(tB2+tG2)*100):0)+'%</b> · '+U.t('girlsPct')+': <b>'+(tB2+tG2?Math.round(tG2/(tB2+tG2)*100):0)+'%</b></div>') +
      '</div>'+
      '<div class="grid-2">'+
        sec(U.t('obsCompletion')+' — '+year,
          '<div class="stat-grid" style="grid-template-columns:repeat(5,1fr)">'+
            card2(c4,'4')+card2(c3,'3')+card2(c2,'2')+card2(c1,'1')+card2(c0,'0')+
          '</div>'+
          '<div class="mt-2">'+UI.progressHTML(teachers.length?Math.round(c4/teachers.length*100):0)+'</div>') +
        sec(U.t('tashkilSummary'),
          '<div class="stat-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:8px">'+
            card(teachers.length,U.t('navTeachers'),'gradcap')+card(employees.length,U.t('navEmployees'),'briefcase')+card(totalStaff,U.t('totalStaff'),'layers')+
          '</div>'+
          '<div class="small muted mb-1">'+U.t('autoTashkilNote')+'</div>'+
          hbar(Object.keys(bySchool).map(sid=>{
            const st=teachers.filter(t=>t.schoolId===sid).length + employees.filter(e=>e.schoolId===sid).length;
            return [bySchool[sid], st];
          }).sort((a,b)=>b[1]-a[1]).slice(0,10))) +
      '</div>';
  };
  render();

  document.getElementById('stGender').addEventListener('change', e=>{ ST.gender=e.target.value; render(); });
  document.getElementById('stSubject').addEventListener('change', e=>{ ST.subject=e.target.value; render(); });
  document.getElementById('stSchool').addEventListener('change', e=>{ ST.school=e.target.value; render(); });
  document.getElementById('stExport').addEventListener('click', ()=>{
    ExcelExport.exportWorkbook('statistics',[
      {name:U.t('navTeachers'), aoa:[
        [U.t('navTeachers')],[U.t('appSub')],[],
        [U.t('fullName'),U.t('school'),U.t('gender'),U.t('subject'),U.t('education'),U.t('status')],
        ...teachers.map(t=>[t.fullName, bySchool[t.schoolId]||'', t.gender?U.statusLabel('pg_'+t.gender):'', t.subject||'', t.education?U.t(t.education):'', t.status?U.statusLabel(t.status):''])
      ]},
      {name:U.t('navStudents'), aoa:[
        [U.t('navStudents')],[],
        [U.t('school'),U.t('className'),U.t('genderMode'),U.t('maleCount'),U.t('femaleCount'),U.t('autoTotal')],
        ...stats.map(s=>[bySchool[s.schoolId]||'', gradeName(s.className), s.genderMode?U.statusLabel('g_'+s.genderMode):'', Number(s.maleCount||0), Number(s.femaleCount||0), Number(s.maleCount||0)+Number(s.femaleCount||0)])
      ]},
      {name:U.t('navObservations'), aoa:[
        [U.t('navObservations')],[],
        [U.t('teacherName'),U.t('year'),U.t('observationNumber'),U.t('date'),U.t('score'),U.t('percentage')],
        ...obs.map(o=>[byTeacher[o.teacherId]?byTeacher[o.teacherId].fullName:'', o.academicYear||'', o.observationNumber||'', U.fmtDate(o.date)||'', Number(o.obtainedScore||0), Number(o.percentage||0)])
      ]}
    ]);
  });
}});

function groupByCount(arr, f){
  const m={};
  arr.forEach(x=>{ const k=f(x); m[k]=(m[k]||0)+1; });
  return Object.keys(m).map(k=>[k,m[k]]).sort((a,b)=>b[1]-a[1]);
}
function gradeName(g){
  const hit=(I18N.grades||[]).find(x=>x.v===String(g));
  return hit?U.tv(hit):String(g||'');
}
function card(n,label,icon){
  return '<div class="stat-card" style="cursor:default"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+U.num(n)+'</div><div class="sc-label">'+label+'</div></div></div>';
}
function card2(n,label){
  return '<div class="stat-card" style="cursor:default;--sc-bg:var(--primary-soft)"><div class="sc-icon">'+U.icon('eye')+'</div><div><div class="sc-num">'+U.num(n)+'</div><div class="sc-label">'+(label==='0'?U.t('obsWith0'):U.t('obsWith'+label))+'</div></div></div>';
}
function sec(title,html){
  return '<div class="card"><div class="card-head"><h3>'+title+'</h3></div><div class="card-body">'+html+'</div></div>';
}
function donutHTML(a,b,la,lb){
  const t=a+b;
  const pA=t?a/t*100:0;
  return '<div class="donut-wrap"><div class="donut" data-center="'+U.num(t)+'" style="background:conic-gradient(var(--info) '+pA+'%, var(--purple) '+pA+'% 100%)"></div>'+
    '<div class="donut-legend">'+
      '<div class="dl"><span class="sw" style="background:var(--info)"></span>'+(la||U.t('boys'))+'<b>'+U.num(a)+' ('+U.num(pct2(a,t))+'%)</b></div>'+
      '<div class="dl"><span class="sw" style="background:var(--purple)"></span>'+(lb||U.t('girls'))+'<b>'+U.num(b)+' ('+U.num(pct2(b,t))+'%)</b></div>'+
    '</div></div>';
}
function pct2(a,b){ return b?Math.round(a/b*1000)/10:0; }
function donut(x){ return ''; }

window.StatisticsModule={};
})();
