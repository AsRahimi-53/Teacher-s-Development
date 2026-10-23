/* =====================================================================
   observations.js — CORE: teacher teaching observations.
   4 observations per teacher per year (configurable), 0–4 scoring per
   criterion (configurable, max 25 criteria), quality levels, findings,
   history, statistics, print & export.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

let TEACHERS=[], MEMBERS=[], SCHOOLS=[];
let T_BY_ID={}, M_BY_ID={}, S_BY_ID={};

async function loadRefs(){
  [TEACHERS, MEMBERS, SCHOOLS] = await Promise.all([
    DB.getAll('teachers'), DB.getAll('members'), DB.getAll('schools')
  ]);
  T_BY_ID=Object.fromEntries(TEACHERS.map(t=>[t.id,t]));
  M_BY_ID=Object.fromEntries(MEMBERS.map(m=>[m.id,m]));
  S_BY_ID=Object.fromEntries(SCHOOLS.map(s=>[s.id,s]));
}

function yearList(){
  const s=Settings.get();
  const cur=Number(s.academicYear)||1405;
  const out=[];
  for(let y=cur;y>=cur-3;y--) out.push(String(y));
  return out;
}
function qualityOpts(){
  return (Settings.get().qualityLevels||[]).map(q=>({
    v:q.min+'-'+q.max, ps:q.ps, fa:q.fa, min:Number(q.min), max:Number(q.max)
  }));
}

const LIST_FILTERS={teacher:'',observer:'',school:'',year:'',quality:'',num:'',from:'',to:''};

register('observations', {render: async (id, params)=>{
  Nav.setActive('observations');
  await loadRefs();
  if(id==='new'){
    const rec={
      academicYear: Settings.get().academicYear,
      date: U.todayISO(),
      observationNumber: 1,
      teacherId: (params&&params.teacher)||'',
      observerId: (params&&params.observer)||''
    };
    return openForm(rec, {school:(params&&params.school)});
  }
  if(id){
    const rec=await DB.get('observations',id);
    if(rec) return openDetail(rec);
  }
  renderListPage();
}});

/* ================= LIST ================= */
async function renderListPage(){
  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navObservations')}]);
  const all=await DB.getAll('observations');
  const year=Settings.get().academicYear;
  const yrObs=all.filter(o=>String(o.academicYear)===String(year));

  // stats: teachers with n observations (current year)
  const perTeacher={};
  yrObs.forEach(o=>{ perTeacher[o.teacherId]=(perTeacher[o.teacherId]||0)+1; });
  const cnt=n=>Object.values(perTeacher).filter(x=>x===n).length;
  const maxObs=Number(Settings.get().maxObsPerYear||4);
  const noObs=Math.max(0, TEACHERS.length-Object.keys(perTeacher).length);
  const done4=cnt(maxObs);
  const completePct=TEACHERS.length?Math.round(done4/TEACHERS.length*100):0;

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('eye')+'</div>'+
      '<div><h1>'+U.t('navObservations')+'</h1><div class="ph-sub">'+U.t('academicYear')+' — '+year+' · '+U.t('obsTarget')+': 4 '+U.t('obsPerYear')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="obCompReport">'+U.icon('file')+U.t('obsCompletion')+' — '+U.t('print')+'</button>'+
        '<button class="btn btn-outline" id="obCompExcel">'+U.icon('download')+U.t('obsCompletion')+' — '+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-outline" id="obExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-primary" id="obAdd">'+U.icon('plus')+U.t('newObs')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stat-grid mb-3">'+
      statCard(cnt(1),'obs1')+statCard(cnt(2),'obs2')+statCard(cnt(3),'obs3')+
      statCard(done4,'obs4')+statCard(noObs,'obs0')+
    '</div>'+
    '<div class="card mb-3"><div class="card-body">'+
      '<div class="flex mb-1"><b class="small">'+U.t('obsCompletion')+' — '+year+'</b><span class="muted small grow"></span><b class="small">'+U.num(yrObs.length)+' / '+U.num(TEACHERS.length*maxObs)+'</b></div>'+
      UI.progressHTML(completePct)+
    '</div></div>'+
    '<div class="toolbar">'+
      '<select class="flt" id="ofTeacher"><option value="">'+U.t('teacherName')+': '+U.t('all')+'</option>'+
        TEACHERS.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName)).map(t=>'<option value="'+t.id+'"'+(LIST_FILTERS.teacher===t.id?' selected':'')+'>'+U.escapeHtml(t.fullName)+'</option>').join('')+'</select>'+
      '<select class="flt" id="ofObserver"><option value="">'+U.t('observerName')+': '+U.t('all')+'</option>'+
        MEMBERS.map(m=>'<option value="'+m.id+'"'+(LIST_FILTERS.observer===m.id?' selected':'')+'>'+U.escapeHtml(m.fullName)+'</option>').join('')+'</select>'+
      '<select class="flt" id="ofSchool"><option value="">'+U.t('school')+': '+U.t('all')+'</option>'+
        SCHOOLS.map(s=>'<option value="'+s.id+'"'+(LIST_FILTERS.school===s.id?' selected':'')+'>'+U.escapeHtml(s.name)+'</option>').join('')+'</select>'+
      '<select class="flt" id="ofYear"><option value="">'+U.t('year')+': '+U.t('all')+'</option>'+
        yearList().map(y=>'<option value="'+y+'"'+(String(LIST_FILTERS.year)===String(y)?' selected':'')+'>'+y+'</option>').join('')+'</select>'+
      '<select class="flt" id="ofQuality"><option value="">'+U.t('qualityLevel')+': '+U.t('all')+'</option>'+
        qualityOpts().map(q=>'<option value="'+q.v+'"'+(LIST_FILTERS.quality===q.v?' selected':'')+'>'+U.tv(q)+'</option>').join('')+'</select>'+
      '<select class="flt" id="ofNum"><option value="">'+U.t('observationNumber')+': '+U.t('all')+'</option>'+
        [1,2,3,4,5].map(n=>'<option value="'+n+'"'+(String(LIST_FILTERS.num)===String(n)?' selected':'')+'>'+n+'</option>').join('')+'</select>'+
      '<input type="date" class="flt flt-date" id="ofFrom" value="'+LIST_FILTERS.from+'" title="'+U.t('from')+'">'+
      '<input type="date" class="flt flt-date" id="ofTo" value="'+LIST_FILTERS.to+'" title="'+U.t('to')+'">'+
    '</div>'+
    '<div id="obTableBox"></div>';

  const renderTable=()=>{
    let rows=all.slice();
    if(LIST_FILTERS.teacher) rows=rows.filter(o=>o.teacherId===LIST_FILTERS.teacher);
    if(LIST_FILTERS.observer) rows=rows.filter(o=>o.observerId===LIST_FILTERS.observer);
    if(LIST_FILTERS.school) rows=rows.filter(o=>T_BY_ID[o.teacherId]&&T_BY_ID[o.teacherId].schoolId===LIST_FILTERS.school);
    if(LIST_FILTERS.year) rows=rows.filter(o=>String(o.academicYear)===String(LIST_FILTERS.year));
    if(LIST_FILTERS.quality){
      const [mn,mx]=LIST_FILTERS.quality.split('-').map(Number);
      rows=rows.filter(o=>Number(o.percentage||0)>=mn && Number(o.percentage||0)<=mx);
    }
    if(LIST_FILTERS.num) rows=rows.filter(o=>String(o.observationNumber)===LIST_FILTERS.num);
    if(LIST_FILTERS.from) rows=rows.filter(o=>o.date && o.date>=LIST_FILTERS.from);
    if(LIST_FILTERS.to) rows=rows.filter(o=>o.date && o.date<=LIST_FILTERS.to);
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const box=document.getElementById('obTableBox');
    if(!rows.length){ box.innerHTML=U.emptyState('eye',U.t('noResults'),U.t('noResultsSub')); return; }
    box.innerHTML=U.tableHTML(
      [
        {key:0,label:L('ښوونکی','معلم'),render:r=>r.t?U.avatarHTML(r.t,34)+' '+U.escapeHtml(r.t.fullName||''):''},
        {key:1,label:L('کال','سال'),cell:r=>r.y},
        {key:2,label:L('شمېره','شماره'),render:r=>'<b>'+r.n+'</b>'},
        {key:3,label:L('نېټه','تاریخ'),cell:r=>U.fmtDate(r.d)},
        {key:4,label:L('څارونکی','ناظر'),cell:r=>r.m},
        {key:5,label:L('مضمون','مضمون'),cell:r=>r.s},
        {key:6,label:L('نمره','نمره'),render:r=>'<b>'+r.sc+'</b>'},
        {key:7,label:L('سلنه','درصد'),cell:r=>r.pct+'%'},
        {key:8,label:L('کچه','کیفیت'),render:r=>Settings.qualityBadge(r.pctV)}
      ],
      rows.map(o=>({
        t:T_BY_ID[o.teacherId], y:o.academicYear, n:o.observationNumber, d:o.date,
        m:M_BY_ID[o.observerId]?M_BY_ID[o.observerId].fullName:'',
        s:o.subject||'',
        sc:(o.obtainedScore!==undefined?U.num(o.obtainedScore):'')+'/'+U.num(o.totalScore||0),
        pct:U.num(o.percentage||0), pctV:o.percentage||0
      })),
      (r,i)=>
        '<button class="icon-btn sm" data-ov="'+rows[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
        '<button class="icon-btn sm" data-oe="'+rows[i].id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
        '<button class="icon-btn sm" data-op="'+rows[i].id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
        '<button class="icon-btn sm danger" data-od="'+rows[i].id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>'
    );
    box.querySelectorAll('[data-ov]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('observations',b.dataset.ov); if(rec) openDetail(rec);
    }));
    box.querySelectorAll('[data-oe]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('observations',b.dataset.oe); if(rec) openForm(rec);
    }));
    box.querySelectorAll('[data-op]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('observations',b.dataset.op); if(rec) printObservation(rec);
    }));
    box.querySelectorAll('[data-od]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('observations',b.dataset.od);
      if(!rec) return;
      const ok=await UI.confirm({danger:true,title:U.t('delete'),msg:U.t('confirmDelete')+'<br><b>'+U.escapeHtml(T_BY_ID[rec.teacherId]?T_BY_ID[rec.teacherId].fullName:'')+'</b>',okLabel:U.t('delete')});
      if(ok){ await DB.del('observations',rec.id); U.toast(U.t('deleted'),'success'); renderListPage(); }
    }));
  };
  renderTable();

  const wire=(id,key)=>{
    document.getElementById(id).addEventListener('change', e=>{ LIST_FILTERS[key]=e.target.value; renderTable(); });
  };
  wire('ofTeacher','teacher'); wire('ofObserver','observer'); wire('ofSchool','school');
  wire('ofYear','year'); wire('ofQuality','quality'); wire('ofNum','num');
  wire('ofFrom','from'); wire('ofTo','to');

  document.getElementById('obAdd').addEventListener('click', ()=>openForm({
    academicYear:Settings.get().academicYear, date:U.todayISO(), observationNumber:1
  }));
  document.getElementById('obExport').addEventListener('click', async ()=>{
    exportObservations(all);
  });
  document.getElementById('obCompReport').addEventListener('click', ()=>{ if(window.ObservationReports) ObservationReports.completionReport(); });
  document.getElementById('obCompExcel').addEventListener('click', ()=>{ if(window.ObservationReports) ObservationReports.exportCompletion(); });
}

function statCard(n,numCls){
  const colors={obs1:'var(--info-soft)',obs2:'var(--warning-soft)',obs3:'var(--accent-soft)',obs4:'var(--success-soft)',obs0:'var(--danger-soft)'};
  const fgs={obs1:'var(--info)',obs2:'var(--warning)',obs3:'var(--accent)',obs4:'var(--success)',obs0:'var(--danger)'};
  const labels={obs1:U.t('obsWith1'),obs2:U.t('obsWith2'),obs3:U.t('obsWith3'),obs4:U.t('obsWith4'),obs0:U.t('obsWith0')};
  return '<div class="stat-card" style="cursor:default;--sc-bg:'+(colors[numCls]||'')+';--sc-fg:'+(fgs[numCls]||'')+'">'+
    '<div class="sc-icon">'+U.icon('eye')+'</div><div><div class="sc-num">'+U.num(n)+'</div><div class="sc-label">'+(labels[numCls]||'')+'</div></div></div>';
}

/* ================= FORM ================= */
async function openForm(rec, opts){
  opts=opts||{};
  const criteria=await Settings.criteria();
  const active=criteria.filter(c=>c.enabled);
  const isEdit=!!rec.id;
  const t=rec.teacherId?T_BY_ID[rec.teacherId]:null;

  const countFor=(tid,yr)=>{
    if(!tid) return 0;
    return DB.getAll('observations').then(all=>all.filter(o=>o.teacherId===tid&&String(o.academicYear)===String(yr)).length);
  };

  const teacherOpts=TEACHERS.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName)).map(x=>
    '<option value="'+x.id+'"'+(rec.teacherId===x.id?' selected':'')+'>'+U.escapeHtml(x.fullName)+(x.subject?' — '+U.escapeHtml(x.subject):'')+'</option>');
  const memberOpts=MEMBERS.map(x=>'<option value="'+x.id+'"'+(rec.observerId===x.id?' selected':'')+'>'+U.escapeHtml(x.fullName)+'</option>');

  let scores={};
  let comments={};
  if(rec.criteria){
    rec.criteria.forEach(c=>{ scores[c.id]=c.score; comments[c.id]=c.comment||''; });
  }

  const body=
    '<div class="section-title">'+U.icon('info')+U.t('detail')+'</div>'+
    '<div class="form-grid">'+
      F_('teacherId',L('ښوونکی','معلم'),
        '<select id="f_teacherId" name="teacherId"><option value="">'+U.t('selectOne')+'</option>'+teacherOpts.join('')+'</select>', true)+
      F_('academicYear',L('تعلیمي کال','سال تحصیلی'),
        '<select id="f_academicYear" name="academicYear">'+yearList().map(y=>'<option value="'+y+'"'+(String(rec.academicYear)===String(y)?' selected':'')+'>'+y+'</option>').join('')+'</select>', true)+
      F_('observationNumber',L('د څارنې شمېره','شماره مشاهده'),
        '<select id="f_observationNumber" name="observationNumber">'+[1,2,3,4].map(n=>'<option value="'+n+'"'+(String(rec.observationNumber)===String(n)?' selected':'')+'>'+n+'</option>').join('')+'</select>', true)+
      F_('date',L('نېټه','تاریخ'),'<input type="date" id="f_date" name="date" value="'+(rec.date||U.todayISO())+'">', true)+
      F_('observerId',L('څارونکی (علمي غړی)','مشاهدکننده (عضو علمی)'),
        '<select id="f_observerId" name="observerId"><option value="">'+U.t('selectOne')+'</option>'+memberOpts.join('')+'</select>', true)+
      F_('subject',L('مضمون','مضمون'),'<input type="text" id="f_subject" name="subject" value="'+U.escapeHtml(rec.subject||'')+'">')+
      F_('className',L('ټولګی','کلاس'),'<select id="f_className" name="className"><option value="">'+U.t('selectOne')+'</option>'+I18N.grades.map(g=>'<option value="'+g.v+'"'+(String(rec.className)===g.v?' selected':'')+'>'+U.tv(g)+'</option>').join('')+'</select>')+
      F_('section',L('شعبه','شعبه'),'<input type="text" id="f_section" name="section" value="'+U.escapeHtml(rec.section||'')+'">')+
      F_('topic',L('د درس موضوع','موضوع درس'),'<input type="text" id="f_topic" name="topic" value="'+U.escapeHtml(rec.topic||'')+'">', false, 2)+
      F_('duration',L('موده (دقیقې)','مدت (دقیقه)'),'<input type="number" id="f_duration" name="duration" value="'+U.escapeHtml(rec.duration||'45')+'" min="0">')+
    '</div>'+
    '<div id="obsWarnBox"></div>'+
    '<div class="section-title">'+U.icon('target')+U.t('scoring')+' <span class="muted small">('+(U.t('criterion')+' '+active.length+' × '+U.t('max')+' = '+active.reduce((a,c)=>a+Number(c.maxScore||0),0)+')')+'</span></div>'+
    '<div class="table-card" style="max-height:380px;overflow:auto">'+
      '<table class="score-table"><thead><tr>'+
        '<th style="width:30px">#</th><th>'+U.t('criterion')+'</th><th style="width:110px">'+U.t('score')+' (0–4)</th><th>'+U.t('comment')+'</th>'+
      '</tr></thead><tbody>'+
      active.map((c,i)=>
        '<tr><td class="num">'+(i+1)+'</td>'+
        '<td><div class="cell-strong">'+U.escapeHtml(U.tv(c))+'</div><div class="crit-max">'+U.t('max')+': '+c.maxScore+'</div></td>'+
        '<td><input type="number" min="0" max="'+c.maxScore+'" step="1" data-score="'+c.id+'" value="'+(scores[c.id]!==undefined?scores[c.id]:'')+'"></td>'+
        '<td><input type="text" data-comment="'+c.id+'" value="'+U.escapeHtml(comments[c.id]||'')+'" placeholder="'+U.t('comment')+'"></td></tr>'
      ).join('')+
      '</tbody></table>'+
    '</div>'+
    '<div class="score-total-bar">'+
      '<div class="stb-item"><div class="stb-num" id="stbObtained">0</div><div class="stb-lbl">'+U.t('obtained')+'</div></div>'+
      '<div class="stb-item"><div class="stb-num" id="stbTotal">0</div><div class="stb-lbl">'+U.t('totalScore')+'</div></div>'+
      '<div class="stb-item"><div class="stb-num" id="stbPct">0%</div><div class="stb-lbl">'+U.t('percentage')+'</div></div>'+
      '<div class="stb-item grow"></div>'+
      '<div class="stb-item"><div id="stbQ">'+Settings.qualityBadge(0)+'</div><div class="stb-lbl">'+U.t('qualityLevel')+'</div></div>'+
    '</div>'+
    '<div class="section-title">'+U.icon('file')+U.t('findings')+'</div>'+
    '<div class="form-grid">'+
      F_('strengths',L('قوي اړخونه','نقاط قوت'),'<textarea id="f_strengths" name="strengths" rows="2">'+U.escapeHtml(rec.strengths||'')+'</textarea>', false, 2)+
      F_('weaknesses',L('ضعیف اړخونه','نقاط ضعف'),'<textarea id="f_weaknesses" name="weaknesses" rows="2">'+U.escapeHtml(rec.weaknesses||'')+'</textarea>', false, 2)+
      F_('deficiencies',L('کمښتونه','کمبودها'),'<textarea id="f_deficiencies" name="deficiencies" rows="2">'+U.escapeHtml(rec.deficiencies||'')+'</textarea>', false, 2)+
      F_('problems',L('لیدل شوي ستونزې','مشکلات مشاهده‌شده'),'<textarea id="f_problems" name="problems" rows="2">'+U.escapeHtml(rec.problems||'')+'</textarea>', false, 2)+
      F_('recommendations',L('وړاندیزونه','پیشنهادها'),'<textarea id="f_recommendations" name="recommendations" rows="2">'+U.escapeHtml(rec.recommendations||'')+'</textarea>', false, 2)+
      F_('improvements',L('اړین ښه والی','بهبودهای مورد نیاز'),'<textarea id="f_improvements" name="improvements" rows="2">'+U.escapeHtml(rec.improvements||'')+'</textarea>', false, 2)+
      F_('followUpActions',L('تعقیب','پیگیری'),'<textarea id="f_followUpActions" name="followUpActions" rows="2">'+U.escapeHtml(rec.followUpActions||'')+'</textarea>')+
      F_('followUpDate',L('د تعقیب نېټه','تاریخ پیگیری'),'<input type="date" id="f_followUpDate" name="followUpDate" value="'+U.escapeHtml(rec.followUpDate||'')+'">')+
      F_('generalFindings',L('عمومي موندنې','یافته‌های عمومی'),'<textarea id="f_generalFindings" name="generalFindings" rows="2">'+U.escapeHtml(rec.generalFindings||'')+'</textarea>', false, 2)+
      F_('overallEvaluation',L('عمومي ارزونه','ارزیابی کلی'),'<textarea id="f_overallEvaluation" name="overallEvaluation" rows="2">'+U.escapeHtml(rec.overallEvaluation||'')+'</textarea>', false, 2)+
      F_('observerSignature',L('د څارونکي لاسلیک','امضای مشاهده‌کننده'),'<input type="text" id="f_observerSignature" name="observerSignature" value="'+U.escapeHtml(rec.observerSignature||'')+'" placeholder="'+U.t('signature')+'">')+
      F_('teacherSignature',L('د ښوونکي لاسلیک','امضای معلم'),'<input type="text" id="f_teacherSignature" name="teacherSignature" value="'+U.escapeHtml(rec.teacherSignature||'')+'" placeholder="'+U.t('signature')+'">')+
    '</div>';

  const m=UI.modal({
    title:(isEdit?U.t('editObs'):U.t('newObs')),
    sub:t? t.fullName:'',
    icon:'eye', size:'xl',
    body,
    foot:
      '<button type="button" class="btn btn-outline" data-a="cancel">'+U.t('cancel')+'</button>'+
      '<button type="button" class="btn btn-primary" data-a="save">'+U.icon('check')+U.t('save')+'</button>'
  });
  const root=m.body;

  const maxObs=Number(Settings.get().maxObsPerYear||4);
  const totalPossible=active.reduce((a,c)=>a+Number(c.maxScore||0),0);

  function recalc(){
    let obtained=0;
    active.forEach(c=>{
      const inp=root.querySelector('[data-score="'+c.id+'"]');
      let v=inp?Number(inp.value||0):0;
      v=Math.max(0,Math.min(Number(c.maxScore||4),Math.round(v)));
      obtained+=v;
    });
    const pctV=totalPossible?Math.round(obtained/totalPossible*1000)/10:0;
    root.querySelector('#stbObtained').textContent=U.num(obtained);
    root.querySelector('#stbTotal').textContent=U.num(totalPossible);
    root.querySelector('#stbPct').textContent=U.num(pctV)+'%';
    root.querySelector('#stbQ').innerHTML=Settings.qualityBadge(pctV);
    return {obtained,pctV,totalPossible};
  }
  root.querySelectorAll('[data-score]').forEach(i=>i.addEventListener('input', recalc));

  /* teacher → auto subject + obs number + warn if max reached */
  const tSel=root.querySelector('#f_teacherId');
  const nSel=root.querySelector('#f_observationNumber');
  const ySel=root.querySelector('#f_academicYear');
  async function onTeacher(){
    const tid=tSel.value, yr=ySel.value;
    const warn=root.querySelector('#obsWarnBox');
    if(!tid){ warn.innerHTML=''; return; }
    const t2=T_BY_ID[tid];
    if(t2 && t2.subject && !root.querySelector('#f_subject').value)
      root.querySelector('#f_subject').value=t2.subject;
    const n=await countFor(tid,yr);
    // auto next number
    const next=Math.min(n+1,4);
    nSel.value=String(next);
    if(n>=maxObs){
      warn.innerHTML='<div class="badge b-red" style="margin-top:12px;padding:8px 14px"><span class="dot"></span>'+U.icon('alert')+' '+U.t('maxObsWarn')+'</div>';
    } else if(n>0){
      warn.innerHTML='<div class="badge b-orange" style="margin-top:12px;padding:8px 14px"><span class="dot"></span>'+U.t('obsCompleted')+': '+U.num(n)+' / '+maxObs+'</div>';
    } else warn.innerHTML='';
  }
  tSel.addEventListener('change', onTeacher);
  ySel.addEventListener('change', onTeacher);
  recalc();
  if(rec.teacherId) onTeacher();

  const doSave=async ()=>{
    const tid=tSel.value, yr=ySel.value, num=Number(nSel.value), obsId=root.querySelector('#f_observerId').value;
    if(!tid) return U.toast(U.t('fillRequired'),'error');
    if(!obsId) return U.toast(U.t('fillRequired'),'error');
    if(!root.querySelector('#f_date').value) return U.toast(U.t('fillRequired'),'error');
    // validate scores
    let obtained=0; let okScores=true;
    const critSnapshot=[];
    active.forEach(c=>{
      const inp=root.querySelector('[data-score="'+c.id+'"]');
      const cinp=root.querySelector('[data-comment="'+c.id+'"]');
      let v=inp?Number(inp.value||0):0;
      if(isNaN(v)||v<0||v>Number(c.maxScore||4)){ okScores=false; inp.classList.add('invalid'); }
      else inp.classList.remove('invalid');
      v=Math.max(0,Math.min(Number(c.maxScore||4),Math.round(v)));
      obtained+=v;
      critSnapshot.push({id:c.id, ps:c.ps, fa:c.fa, maxScore:Number(c.maxScore||4), score:v, comment:cinp?cinp.value:''});
    });
    if(!okScores) return U.toast(U.t('invalidInput')+' — '+U.t('scoring'),'error');

    // 4th-observation guard
    const existN=await countFor(tid,yr);
    if(existN>=maxObs && !isEdit){
      const ok=await UI.confirm({
        warn:true, icon:'alert', title:U.t('maxObsReached'),
        msg:U.t('maxObsWarn')+'<br><b>'+U.escapeHtml(T_BY_ID[tid].fullName)+'</b>',
        okLabel:U.t('confirm')
      });
      if(!ok) return;
    }

    const gv=(k)=>{ const el=root.querySelector('[name="'+k+'"]'); return el?el.value:''; };
    const totalPossible=active.reduce((a,c)=>a+Number(c.maxScore||0),0);
    const pctV=totalPossible?Math.round(obtained/totalPossible*1000)/10:0;
    const now=new Date().toISOString();
    const out=Object.assign({}, rec||{}, {
      teacherId:tid, academicYear:yr, observationNumber:num,
      date:gv('date'), observerId:obsId,
      subject:gv('subject'), className:gv('className'), section:gv('section'),
      topic:gv('topic'), duration:gv('duration')?Number(gv('duration')):'',
      criteria:critSnapshot,
      obtainedScore:obtained, totalScore:totalPossible, percentage:pctV,
      strengths:gv('strengths'), weaknesses:gv('weaknesses'), deficiencies:gv('deficiencies'),
      problems:gv('problems'), recommendations:gv('recommendations'), improvements:gv('improvements'),
      followUpActions:gv('followUpActions'), followUpDate:gv('followUpDate'),
      generalFindings:gv('generalFindings'), overallEvaluation:gv('overallEvaluation'),
      observerSignature:gv('observerSignature'), teacherSignature:gv('teacherSignature'),
      updatedAt:now
    });
    out.id=out.id||U.uid();
    out.createdAt=out.createdAt||now;
    await DB.put('observations',out);
    U.toast(U.t(isEdit?'updated':'saved'),'success');
    m.close();
    window.App.refreshView();
  };
  m.el.querySelector('[data-a=save]').addEventListener('click', doSave);
  m.el.querySelector('[data-a=cancel]').addEventListener('click', ()=>m.close());
}

function F_(key,label,inputHTML,req,span){
  return '<div class="field'+(span===2?' fspan2':'')+'"><label>'+U.escapeHtml(U.tv(label))+(req?'<span class="req">*</span>':'')+'</label>'+inputHTML+'</div>';
}

/* ================= DETAIL ================= */
async function openDetail(rec){
  const t=T_BY_ID[rec.teacherId], mbr=M_BY_ID[rec.observerId];
  const q=Settings.quality(rec.percentage||0);
  const critRows=(rec.criteria||[]).map((c,i)=>{
    const ratio=c.maxScore?c.score/c.maxScore:0;
    const lab= ratio>=0.99? U.t('q_high') : ratio>=0.6? U.t('q_good') : ratio>=0.4? U.t('q_mid') : U.t('q_low');
    return [i+1, U.tv(c), U.num(c.maxScore), U.num(c.score), lab, c.comment||''];
  });
  const body=
    '<div class="detail-head">'+
      '<div class="score-ring" style="--p:'+(rec.percentage||0)+';--c:'+(q.color==='red'?'var(--danger)':q.color==='orange'?'var(--warning)':q.color==='green'?'var(--success)':'var(--info)')+'">'+
        '<div><div class="sr-num">'+U.num(rec.percentage||0)+'%</div><div class="sr-pct">'+U.num(rec.obtainedScore||0)+'/'+U.num(rec.totalScore||0)+'</div></div>'+
      '</div>'+
      '<div><h2>'+U.escapeHtml(t?t.fullName:'')+'</h2>'+
      '<div class="dh-sub">'+U.icon('calendar')+' '+U.fmtDate(rec.date)+' · '+U.t('observationNumber')+': <b>'+rec.observationNumber+'</b> · '+U.t('academicYear')+': '+(rec.academicYear||'')+'</div>'+
      '<div class="mt-1">'+Settings.qualityBadge(rec.percentage||0)+' <span class="muted small">'+(mbr?'— '+U.escapeHtml(mbr.fullName):'')+'</span></div></div>'+
    '</div>'+
    '<div class="section-title">'+U.icon('info')+U.t('detail')+'</div>'+
    UI.detailKV([
      {k:U.t('teachingSubject'),v:rec.subject},{k:U.t('className'),v:gradeLabel(rec.className)},
      {k:U.t('sectionName'),v:rec.section},{k:U.t('lessonTopic'),v:rec.topic},
      {k:U.t('duration'),v:rec.duration?U.num(rec.duration):''},{k:U.t('observer'),v:mbr?mbr.fullName:''},
      {k:U.t('school'),v:t&&t.schoolId&&S_BY_ID[t.schoolId]?S_BY_ID[t.schoolId].name:''}
    ])+
    '<div class="section-title">'+U.icon('target')+U.t('scoring')+'</div>'+
    '<div class="table-card" style="max-height:300px;overflow:auto">'+
      U.tableHTML(
        [{key:0,label:L('#','#')},{key:1,label:L('معیار','معیار')},{key:2,label:L('اعظمي','حداکثر')},{key:3,label:L('اخیستل','کسب')},{key:4,label:L('کچه','کیفیت')},{key:5,label:L('څرګندونه','تبصره')}],
        critRows.map((r,i)=>({0:r[0],1:r[1],2:r[2],3:r[3],4:r[4],5:r[5]})),
        ()=>''
      )+'</div>'+
    '<div class="section-title">'+U.icon('file')+U.t('findings')+'</div>'+
    UI.detailKV([
      {k:U.t('strengths'),v:rec.strengths,full:true},{k:U.t('weaknesses'),v:rec.weaknesses,full:true},
      {k:U.t('deficiencies'),v:rec.deficiencies,full:true},{k:U.t('problems'),v:rec.problems,full:true},
      {k:U.t('recommendations'),v:rec.recommendations,full:true},{k:U.t('requiredImprovements'),v:rec.improvements,full:true},
      {k:U.t('followUp'),v:rec.followUpActions,full:true},{k:U.t('followUpDate'),v:rec.followUpDate?U.fmtDate(rec.followUpDate):''},
      {k:U.t('generalFindings'),v:rec.generalFindings,full:true},{k:U.t('overallEvaluation'),v:rec.overallEvaluation,full:true}
    ]);
  UI.modal({
    title:U.t('viewObs')+' — '+(t?t.fullName:''),
    icon:'eye', size:'lg', body,
    foot:
      '<button type="button" class="btn btn-outline" data-a="print">'+U.icon('printer')+U.t('print')+'</button>'+
      '<button type="button" class="btn btn-outline" data-a="edit">'+U.icon('edit')+U.t('edit')+'</button>'+
      '<button type="button" class="btn btn-danger-soft" data-a="del">'+U.icon('trash')+U.t('delete')+'</button>'
  });
  const mm=document.querySelector('#modal-root .modal-overlay:last-child');
  mm.querySelector('[data-a=print]').addEventListener('click', ()=>printObservation(rec));
  mm.querySelector('[data-a=edit]').addEventListener('click', ()=>{ mm.remove(); openForm(rec); });
  mm.querySelector('[data-a=del]').addEventListener('click', async ()=>{
    const ok=await UI.confirm({danger:true,title:U.t('delete'),msg:U.t('confirmDelete'),okLabel:U.t('delete')});
    if(ok){ await DB.del('observations',rec.id); U.toast(U.t('deleted'),'success'); mm.remove(); window.App.refreshView(); }
  });
}

function gradeLabel(g){
  const hit=(window.I18N&&I18N.grades||[]).find(x=>x.v===String(g));
  return hit?U.tv(hit):String(g||'');
}

/* ================= PRINT ================= */
async function printObservation(rec){
  const t=T_BY_ID[rec.teacherId], mbr=M_BY_ID[rec.observerId];
  const q=Settings.quality(rec.percentage||0);
  const lang=U.currentLang();
  const doc=await PrintDoc.officialDoc({
    seqType:'observation',
    title: U.t('navObservations')+' — '+U.t('official'),
    sub: (t?t.fullName:'')+' — '+U.t('observationNumber')+' '+rec.observationNumber,
    meta:[{k:U.t('documentDate'),v:U.fmtDate(rec.date)},{k:U.t('academicYear'),v:rec.academicYear},
          {k:U.t('totalScore'),v:(rec.obtainedScore!==undefined?rec.obtainedScore:'')+'/'+(rec.totalScore||0)},
          {k:U.t('percentage'),v:(rec.percentage||0)+'%'},{k:U.t('qualityLevel'),v:lang==='fa'?q.fa:q.ps}],
    sections:[
      {heading:U.t('detail'), html: PrintDoc.kv([
        {k:U.t('teacherName'),v:t?t.fullName:''},{k:U.t('observerName'),v:mbr?mbr.fullName:''},
        {k:U.t('teachingSubject'),v:rec.subject},{k:U.t('className'),v:gradeLabel(rec.className)},
        {k:U.t('sectionName'),v:rec.section},{k:U.t('lessonTopic'),v:rec.topic},
        {k:U.t('duration'),v:rec.duration?U.num(rec.duration):''},
        {k:U.t('school'),v:t&&t.schoolId&&S_BY_ID[t.schoolId]?S_BY_ID[t.schoolId].name:''}
      ])},
      {heading:U.t('scoring'), html: PrintDoc.table(
        [L('#','#'),L('معیار','معیار'),L('اعظمي','حداکثر'),L('اخیستل','کسب'),L('څرګندونه','تبصره')],
        (rec.criteria||[]).map((c,i)=>[i+1,U.tv(c),c.maxScore,c.score,c.comment||'']),
        {numCols:[0,2,3], totals:[U.t('total'),'','',U.sum(rec.criteria||[],c=>Number(c.score||0)),'']}
      )},
      {heading:U.t('findings'), html: PrintDoc.kv([
        {k:U.t('strengths'),v:rec.strengths,full:true},{k:U.t('weaknesses'),v:rec.weaknesses,full:true},
        {k:U.t('deficiencies'),v:rec.deficiencies,full:true},{k:U.t('problems'),v:rec.problems,full:true},
        {k:U.t('recommendations'),v:rec.recommendations,full:true},{k:U.t('requiredImprovements'),v:rec.improvements,full:true},
        {k:U.t('followUp'),v:rec.followUpActions,full:true},{k:U.t('followUpDate'),v:rec.followUpDate?U.fmtDate(rec.followUpDate):''},
        {k:U.t('generalFindings'),v:rec.generalFindings,full:true},{k:U.t('overallEvaluation'),v:rec.overallEvaluation,full:true},
        {k:U.t('totalScore'),v:(rec.obtainedScore!==undefined?rec.obtainedScore:'')+'/'+(rec.totalScore||0)+' — '+(rec.percentage||0)+'%'},
        {k:U.t('qualityLevel'),v:lang==='fa'?q.fa:q.ps}
      ])},
      {heading:U.t('signature'), html: PrintDoc.kv([
        {k:U.t('observerSignature'),v:rec.observerSignature||'———'},
        {k:U.t('teacherSignature'),v:rec.teacherSignature||'———'}
      ])}
    ],
    sigs:[U.t('observer'),U.t('headTeacher'),U.t('director')]
  });
  PrintDoc.preview(doc, U.t('print'));
}

/* ================= EXPORT ================= */
function exportObservations(rows){
  const headers=[
    L('ښوونکی','معلم'),L('کال','سال'),L('شمېره','شماره'),L('نېټه','تاریخ'),L('څارونکی','ناظر'),
    L('مضمون','مضمون'),L('ټولګی','کلاس'),L('اخیستل','کسب'),L('ټوله','کل'),L('سلنه','درصد'),L('کچه','کیفیت')
  ];
  const data=rows.map(o=>{
    const q=Settings.quality(o.percentage||0);
    return [
      T_BY_ID[o.teacherId]?T_BY_ID[o.teacherId].fullName:'',
      o.academicYear||'', o.observationNumber||'', o.date?U.fmtDateNum(o.date):'',
      M_BY_ID[o.observerId]?M_BY_ID[o.observerId].fullName:'',
      o.subject||'', o.className||'',
      Number(o.obtainedScore||0), Number(o.totalScore||0), Number(o.percentage||0),
      U.currentLang()==='fa'?q.fa:q.ps
    ];
  });
  ExcelExport.exportTable(U.t('navObservations'), headers.map(h=>U.tv(h)), data, {file:'observations'});
}

window.ObservationsModule={openForm, openDetail, printObservation, exportObservations, loadRefs,
  getRefs:()=>({T_BY_ID,M_BY_ID,S_BY_ID,TEACHERS,MEMBERS,SCHOOLS})};
})();
