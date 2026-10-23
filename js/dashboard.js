/* =====================================================================
   dashboard.js — main dashboard: 14 stat cards, quick actions,
   recent items, duties due, observation & plan progress, member summary.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const dashRender = async ()=>{
  Nav.setActive('dashboard');
  /* super admin sees the separate super dashboard instead */
  if(window.Cloud && Cloud.isSuper() && window.SuperDashboard){
    const viewS=document.getElementById('view');
    await SuperDashboard.render(viewS);
    return;
  }
  const view=document.getElementById('view');
  const s=Settings.get();
  const [members,schools,teachers,employees,studentStats,obs,ap,mp,duties,acts,pd,mon]=await Promise.all([
    DB.getAll('members'),DB.getAll('schools'),DB.getAll('teachers'),DB.getAll('employees'),
    DB.getAll('studentStats'),DB.getAll('observations'),
    DB.getAll('annualPlans'),DB.getAll('monthlyPlans'),DB.getAll('duties'),
    DB.getAll('activities'),DB.getAll('professionalDevelopment'),DB.getAll('monitoring')
  ]);
  const year=s.academicYear;
  const yrObs=obs.filter(o=>String(o.academicYear)===String(year));
  const perT={};
  yrObs.forEach(o=>{ perT[o.teacherId]=(perT[o.teacherId]||0)+1; });
  const fullT=Object.values(perT).filter(x=>x>=4).length;
  const obsPct=teachers.length?Math.round(fullT/teachers.length*100):0;
  const tt=(window.StudentStatsModule?StudentStatsModule.totals(studentStats):{t:0}).t;
  const totalStaff=teachers.length+employees.length;
  const subjectSet=new Set(teachers.map(t=>t.subject).filter(Boolean));
  const apDone=ap.filter(p=>p.status==='p_done').length;
  const apPct=ap.length?Math.round(ap.reduce((a,p)=>a+Number(p.completion||0),0)/ap.length):0;
  const today=U.todayISO();
  const sectionTxt=(window.currentLang()==='fa')?(s.sectionFa||s.section):(s.section||s.sectionFa);
  const dToday=duties.filter(x=>x.date===today||x.deadline===today);
  const dOver=duties.filter(x=>(x.status==='d_open'||x.status==='d_progress')&&x.deadline&&U.isOverdue(x.deadline));
  const dUp=duties.filter(x=>(x.status==='d_open'||x.status==='d_progress')&&x.deadline&&U.isUpcoming(x.deadline,7));
  const mRange=ReportGen.periodRange('month', today);            // current JALALI month
  const actsMonth=acts.filter(a=>a.date&&a.date>=mRange.start&&a.date<=mRange.end).length;
  const mActive=members.filter(m=>!m.status||m.status==='m_active').length;

  const recent=[
    ...acts.map(a=>({t:'activity',d:a.date,id:a.id,ty:'activities',title:a.title,who:(a.memberIds||[]).map(i=>members.find(m=>m.id===i)?.fullName).filter(Boolean).join('، ')})),
    ...obs.map(o=>({t:'observation',d:o.date,id:o.id,ty:'observations',title:(o.observationNumber||'')+' — '+U.t('navObservations'),who:(o.observerId?members.find(m=>m.id===o.observerId)?.fullName:'')})),
    ...mon.map(m=>({t:'monitoring',d:m.date,id:m.id,ty:'monitoring',title:m.purpose||U.t('navMonitoring'),who:(m.memberIds||[]).map(i=>members.find(x=>x.id===i)?.fullName).filter(Boolean).join('، ')}))
  ].filter(x=>x.d).sort((a,b)=>String(b.d).localeCompare(String(a.d))).slice(0,8);

  view.innerHTML=
    '<div class="official-band view-fade" id="dashBand">'+
      '<div class="ob-main">'+
        '<div class="ob-line">'+(s.district?U.escapeHtml(s.district):U.t('appName'))+'</div>'+
        (sectionTxt?('<div class="ob-sub">'+U.t('section')+': '+U.escapeHtml(sectionTxt)+'</div>'):'')+
        '<div class="ob-sub">'+U.t('todayDate')+': '+U.fmtDate(today)+'</div>'+
      '</div>'+
      '<div class="db-actions">'+
        '<button class="btn btn-light" id="qaMember">'+U.icon('plus')+U.t('newMember')+'</button>'+
        '<button class="btn btn-light" id="qaSchool">'+U.icon('plus')+U.t('newSchool')+'</button>'+
        '<button class="btn btn-light" id="qaObs">'+U.icon('eye')+U.t('newObservation')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      sc(members.length,U.t('navMembers'),'users',()=>'members')+
      sc(schools.length,U.t('navSchools'),'school',()=>'schools')+
      sc(teachers.length,U.t('navTeachers'),'gradcap',()=>'teachers')+
      sc(employees.length,U.t('navEmployees'),'userPlus',()=>'employees')+
      sc(tt,U.t('totalStudents'),'chart',()=>'students')+
      sc(totalStaff,U.t('totalStaff'),'layers',()=>'tashkil')+
      scFull(yrObs.length,obsPct,U.t('navObservations'),'eye',()=>'observations')+
      scFull(ap.length,apPct,U.t('navAnnualPlan'),'calendar',()=>'annualplan')+
      sc(duties.length,U.t('navDuties'),'checkSquare',()=>'duties')+
      sc(acts.length,U.t('navActivities'),'activity',()=>'activities')+
      sc(pd.length,U.t('navProfDev'),'book',()=>'profdev')+
      sc(mon.length,U.t('navMonitoring'),'clipboardCheck',()=>'monitoring')+
      sc(subjectSet.size,U.t('totalSubjects'),'book',()=>'teachers')+
      sc(mActive,U.t('activeMembers'),'shieldCheck',()=>'members')+
    '</div>'+
    '<div class="dash-cards">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('quickActions')+'</h3></div><div class="card-body">'+
        '<div class="qa-grid">'+
          qa('plus',U.t('newMember'),'members')+
          qa('plus',U.t('newSchool'),'schools')+
          qa('plus',U.t('newTeacher'),'teachers')+
          qa('plus',U.t('newEmployee'),'employees')+
          qa('eye',U.t('newObservation'),'observations/new')+
          qa('clipboardCheck',U.t('newMonitoring'),'monitoring')+
          qa('activity',U.t('newActivity'),'activities')+
          qa('calendar',U.t('newDuty'),'duties')+
          qa('book',U.t('newProfDev'),'profdev')+
          qa('database',U.t('navBackup'),'backup')+
        '</div>'+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('upcomingDuties')+' ('+U.num(dToday.length+dUp.length)+'</h3></div><div class="card-body">'+
        miniList(dToday.map(x=>({label:x.title,date:x.date===today?U.t('today'):U.fmtDate(x.date),route:'duties',warn:false}))
          .concat(dUp.map(x=>({label:x.title,date:U.fmtDate(x.deadline),route:'duties',warn:false}))),
        dOver.length?U.t('overdueAlert')+': <b class="strong" style="color:var(--danger)">'+U.num(dOver.length)+'</b>':'', dOver.map(x=>({label:x.title,date:U.fmtDate(x.deadline),route:'duties',warn:true}))
      )+'</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('recentActivities')+'</h3></div><div class="card-body">'+
        (recent.length? recent.map(r=>
          '<div class="mini-item" data-go="'+r.ty+'" style="cursor:pointer">'+
            '<span class="mi-ico" style="background:var(--info-soft);color:var(--info)">'+U.icon(r.t==='observation'?'eye':r.t==='monitoring'?'clipboardCheck':'activity')+'</span>'+
            '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(r.title||'—')+'</div><div class="mi-sub">'+U.fmtDate(r.d)+(r.who?' — '+U.escapeHtml(r.who):'')+'</div></div>'+
          '</div>'
        ).join('') : U.emptyState('list',U.t('noData')))+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('membersSummary')+'</h3></div><div class="card-body">'+
        (mActive? '<div class="small muted mb-1">'+mActive+' '+U.t('activeMembers')+' / '+members.length+'</div>':'')+
        (members.length? members.slice(0,8).map(m=>
          '<div class="mini-item" style="cursor:pointer" data-go="members/'+m.id+'">'+
            U.avatarHTML(m,36)+
            '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(m.fullName)+'</div><div class="mi-sub">'+(m.position?U.escapeHtml(m.position):'')+' · '+U.num(perTByMember(m.id,yrObs))+' '+U.t('navObservations')+'</div></div>'+
            '<span class="badge b-teal">'+(m.status&&m.status!=='m_active'?U.statusLabel(m.status):U.t('active'))+'</span>'+
          '</div>'
        ).join('') : U.emptyState('users',U.t('noData')))+
      '</div></div>'+
    '</div>';

  function perTByMember(mid,list){ return list.filter(o=>o.observerId===mid).length; }
  function sc(n,label,icon,go){
    return '<div class="stat-card" data-go="'+go()+'"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+U.num(n)+'</div><div class="sc-label">'+label+'</div></div></div>';
  }
  function scFull(n,pct,label,icon,go){
    return '<div class="stat-card" data-go="'+go()+'"><div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+U.num(n)+'</div><div class="sc-label">'+label+' — '+U.num(pct)+'%</div></div><div class="progress" style="margin-top:8px"><div class="bar" style="width:'+pct+'%"></div></div></div>';
  }
  function qa(icon,label,route){
    const [base,q]=route.split('?');
    return '<button class="qa-item" data-go="'+base+'" data-q="'+(q||'')+'"><span class="qa-ico">'+U.icon(icon)+'</span><span>'+label+'</span></button>';
  }
  function miniList(items, foot, warnItems){
    if(!items.length&&!warnItems) return U.emptyState('clock',U.t('noData'));
    let h=items.slice(0,6).map(it=>
      '<div class="mini-item" data-go="'+it.route+'" style="cursor:pointer"><span class="mi-ico" style="background:var(--primary-soft);color:var(--primary)">'+U.icon('checkSquare')+'</span>'+
      '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(it.label||'—')+'</div><div class="mi-sub">'+U.escapeHtml(it.date)+'</div></div></div>'
    ).join('');
    if(warnItems) h+=warnItems.slice(0,4).map(it=>
      '<div class="mini-item" data-go="'+it.route+'" style="cursor:pointer"><span class="mi-ico" style="background:var(--danger-soft);color:var(--danger)">'+U.icon('alert')+'</span>'+
      '<div class="mi-main"><div class="mi-title">'+U.escapeHtml(it.label||'—')+'</div><div class="mi-sub" style="color:var(--danger)">'+U.escapeHtml(it.date)+'</div></div></div>'
    ).join('');
    if(foot) h+='<div class="mt-1 small">'+foot+'</div>';
    return h;
  }

  /* wiring */
  view.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>{
    const go=el.dataset.go||'';
    const q=el.dataset.q||'';
    location.hash='#/'+go+(q?(q.indexOf('=')>-1?'?'+q:'?'+q):'');
  }));
  document.getElementById('qaMember').addEventListener('click', ()=>location.hash='#/members/new');
  document.getElementById('qaSchool').addEventListener('click', ()=>location.hash='#/schools/new');
  document.getElementById('qaObs').addEventListener('click', ()=>location.hash='#/observations/new');
};

register('dashboard', {render: dashRender});
/* legacy 'admin' route: super dashboard for the super admin,
   a "super admin only" notice for everyone else */
register('admin', {render: async ()=>{
  Nav.setActive('dashboard');
  const viewA=document.getElementById('view');
  if(window.Cloud && Cloud.isSuper() && window.SuperDashboard){
    await SuperDashboard.render(viewA);
  } else {
    viewA.innerHTML='<div class="view-fade"><div class="empty">'+U.icon('shield')+'<div>'+U.t('superOnly')+'</div></div></div>';
  }
}});

window.DashboardModule={};
})();
