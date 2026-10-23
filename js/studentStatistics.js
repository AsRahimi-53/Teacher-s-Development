/* =====================================================================
   studentStatistics.js — statistical student records ONLY.
   No student names, no individual profiles. One record per class:
     genderMode: boys | girls | mixed
     maleCount + femaleCount (mixed → both; single mode → the other is 0)
     total is computed automatically (never stored by hand).
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

/* جنسیتي ډول: هلکان / نجونې / ګډ */
const MODES=[
  {v:'boys',   ps:'هلکان', fa:'پسران'},
  {v:'girls',  ps:'نجونې',  fa:'دختران'},
  {v:'mixed',  ps:'ګډ',     fa:'مختلط'}
];

/* one grade can have several sections (شعبې): الف، ب، ج … */
const SECTION_LETTERS=['الف','ب','ج','د','ه','و','ز','ح','ط','ی'];
const SECTION_OPTS=SECTION_LETTERS.map(x=>({v:x,ps:x,fa:x}));
const secText=r=>r&&r.section?String(r.section):'';

const CFG={
  key:'studentStats',
  titleKey:'navStudents',
  icon:'chart',
  fields:[
    F('schoolId',L('ښوونځی','مدرسه'),'store',{store:'schools',labelKey:'name',required:true}),
    F('academicYear',L('تعلیمي کال','سال تحصیلی'),'year',{required:true}),
    F('className',L('ټولګی','کلاس'),'grade',{required:true}),
    F('section',L('شعبه','شعبه'),'select',{options:SECTION_OPTS}),
    F('studCounts',L('جنسیت او د زده کوونکو شمېرې','جنسیت و تعداد دانش‌آموزان'),'studCounts',{
      required:true, span:2, options:MODES,
      maleLabel:L('د هلکانو شمېر','تعداد پسران'),
      femaleLabel:L('د نجونو شمېر','تعداد دختران')
    }),
    F('notes',L('یادونه','یادداشت‌ها'),'textarea')
  ],
  tableCols:[
    {key:'school',label:L('ښوونځی','مدرسه'),cell:r=>window.__schoolName?(window.__schoolName&&window.__schoolName[r.schoolId])||'':''},
    {key:'academicYear',label:L('کال','سال'),cell:r=>r.academicYear||''},
    {key:'className',label:L('ټولګی','پایه'),render:r=>gradeLabel(r.className),cell:r=>gradeLabel(r.className)},
    {key:'section',label:L('شعبه','شعبه'),render:r=>secText(r)?'<span class="badge b-gray">'+U.escapeHtml(secText(r))+'</span>':'—',cell:r=>secText(r)},
    {key:'genderMode',label:L('جنسیت','جنسیت'),render:r=>r.genderMode?U.badge('g_'+r.genderMode):'',cell:r=>r.genderMode?U.statusLabel('g_'+r.genderMode):''},
    {key:'maleCount',label:L('هلکان','پسران'),render:r=>U.num(r.maleCount||0),cell:r=>Number(r.maleCount||0)},
    {key:'femaleCount',label:L('نجونې','دختران'),render:r=>U.num(r.femaleCount||0),cell:r=>Number(r.femaleCount||0)},
    {key:'_total',label:L('مجموعه','جمع'),render:r=>U.num((r.maleCount||0)+(r.femaleCount||0)),cell:r=>Number(r.maleCount||0)+Number(r.femaleCount||0)}
  ],
  searchKeys:['notes'],
  filters:[
    {key:'schoolId',label:L('ښوونځی','مدرسه'),type:'schoolsel'},
    {key:'className',label:L('ټولګی','پایه'),type:'gradesel'},
    {key:'genderMode',label:L('جنسیت','جنسیت'),type:'select',options:MODES},
    {key:'academicYear',label:L('کال','سال'),type:'yearsel'}
  ],
  sort:{key:'academicYear',dir:'desc'},
  print: printStats,
  beforeSave: async (rec, old)=>{
    if(!rec.schoolId||!rec.academicYear||!rec.className) return null;
    const all=await DB.getAll('studentStats');
    /* one record per class section (school + year + class + section) */
    const dup=all.find(x=>x.id!==rec.id && x.schoolId===rec.schoolId && String(x.academicYear)===String(rec.academicYear)
      && String(x.className)===String(rec.className) && String(x.section||'')===String(rec.section||''));
    if(dup) return U.t('dupStudentStat');
    return null;
  }
};

function gradeLabel(g){
  const gr=(window.I18N&&I18N.grades)||[];
  const hit=gr.find(x=>x.v===String(g));
  return hit?U.tv(hit):String(g||'');
}

const ST={school:'',grade:'',mode:'',year:''};

register('students', {render: async (id, params)=>{
  Nav.setActive('students');
  await prepFilters();
  const schools=await DB.getAll('schools');
  window.__schoolName=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  const stats=await DB.getAll('studentStats');

  if(id==='new'){
    if(params&&params.school) ST.school=params.school;
    openForm();
    return;
  }

  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navStudents')}]);
  const s=Settings.get();
  ST.year = ST.year || s.academicYear;

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('chart')+'</div>'+
      '<div><h1>'+U.t('navStudents')+'</h1><div class="ph-sub">'+U.t('appSub')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="ssExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-outline" id="ssPrint">'+U.icon('printer')+U.t('print')+'</button>'+
        '<button class="btn btn-primary" id="ssAdd">'+U.icon('plus')+U.t('add')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="toolbar">'+
      '<select class="flt" id="fltSchool"><option value="">'+U.t('navSchools')+': '+U.t('all')+'</option>'+
        schools.map(x=>'<option value="'+x.id+'"'+(ST.school===x.id?' selected':'')+'>'+U.escapeHtml(x.name)+'</option>').join('')+'</select>'+
      '<select class="flt" id="fltGrade"><option value="">'+U.t('className')+': '+U.t('all')+'</option>'+
        I18N.grades.map(g=>'<option value="'+g.v+'"'+(ST.grade===g.v?' selected':'')+'>'+U.tv(g)+'</option>').join('')+'</select>'+
      '<select class="flt" id="fltMode"><option value="">'+U.t('genderMode')+': '+U.t('all')+'</option>'+
        MODES.map(g=>'<option value="'+g.v+'"'+(ST.mode===g.v?' selected':'')+'>'+U.tv(g)+'</option>').join('')+'</select>'+
      '<select class="flt" id="fltYear"><option value="">'+U.t('year')+': '+U.t('all')+'</option>'+
        [...new Set(stats.map(x=>x.academicYear).filter(Boolean))].sort().map(y=>'<option value="'+y+'"'+(String(ST.year)===String(y)?' selected':'')+'>'+y+'</option>').join('')+'</select>'+
    '</div>'+
    '<div id="ssBody"></div>';

  const render=async ()=>{
    ST.school=document.getElementById('fltSchool').value;
    ST.grade=document.getElementById('fltGrade').value;
    ST.mode=document.getElementById('fltMode').value;
    ST.year=document.getElementById('fltYear').value;

    let rows=stats.slice();
    if(ST.school) rows=rows.filter(r=>r.schoolId===ST.school);
    if(ST.year) rows=rows.filter(r=>String(r.academicYear)===String(ST.year));
    if(ST.grade) rows=rows.filter(r=>String(r.className)===ST.grade);
    if(ST.mode) rows=rows.filter(r=>r.genderMode===ST.mode);

    const T=StudentStatsModule.totals(rows);

    const body=document.getElementById('ssBody');
    body.innerHTML=
      '<div class="stat-grid mb-3">'+
        card(T.t,U.t('totalStudents'),'chart','primary')+
        card(T.m,U.t('totalBoys'),'male','info')+
        card(T.g,U.t('totalGirls'),'female','purple')+
        card((T.m+T.g?Math.round(T.m/(T.m+T.g)*100):0)+'%',U.t('boysPct'),'trend','success')+
        card((T.m+T.g?Math.round(T.g/(T.m+T.g)*100):0)+'%',U.t('girlsPct'),'trend','accent')+
      '</div>'+
      '<div class="grid-2 mb-3">'+
        bySchoolTable(rows, schools)+
        byGradeTable(rows)+
      '</div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('records')+' ('+U.num(rows.length)+')'+'</h3></div><div class="card-body flush" style="max-height:420px;overflow:auto">'+
        (rows.length?U.tableHTML(CFG.tableCols, rows, (r)=>
          '<button class="icon-btn sm" data-ew="'+r.id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
          '<button class="icon-btn sm" data-ev="'+r.id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
          '<button class="icon-btn sm" data-ep="'+r.id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
          '<button class="icon-btn sm danger" data-er="'+r.id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>'):
          U.emptyState('chart',U.t('noData'),U.t('noDataSub')))+'</div></div>';

    body.querySelectorAll('[data-ew]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('studentStats',b.dataset.ew);
      if(rec) CRUD.openDetail(CFG,rec);
    }));
    body.querySelectorAll('[data-ep]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('studentStats',b.dataset.ep);
      if(rec) printStats(rec);
    }));
    body.querySelectorAll('[data-ev]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('studentStats',b.dataset.ev);
      if(rec) openForm(rec);
    }));
    body.querySelectorAll('[data-er]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec=await DB.get('studentStats',b.dataset.er);
      if(!rec) return;
      const ok=await UI.confirm({danger:true,title:U.t('delete'),msg:U.t('confirmDelete'),okLabel:U.t('delete')});
      if(ok){ await DB.del('studentStats',rec.id); U.toast(U.t('deleted'),'success'); render(); }
    }));
  };

  ['fltSchool','fltGrade','fltMode','fltYear'].forEach(id=>document.getElementById(id).addEventListener('change', render));
  document.getElementById('ssAdd').addEventListener('click', ()=>openForm());
  document.getElementById('ssExport').addEventListener('click', async ()=>{
    exportStats(stats);
  });
  document.getElementById('ssPrint').addEventListener('click', async ()=>{
    await printStats({schoolId:ST.school, academicYear:ST.year});
  });
  render();
}});

function card(n,label,icon,color){
  const map={primary:'var(--primary-soft)',info:'var(--info-soft)',purple:'var(--purple-soft)',success:'var(--success-soft)',accent:'var(--accent-soft)'};
  const fg={primary:'var(--primary)',info:'var(--info)',purple:'var(--purple)',success:'var(--success)',accent:'var(--accent)'};
  return '<div class="stat-card" style="cursor:default;--sc-bg:'+map[color]+';--sc-fg:'+fg[color]+'">'+
    '<div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+(typeof n==='string'?U.pDigits?U.pDigits(n):n:U.num(n))+'</div><div class="sc-label">'+label+'</div></div></div>';
}

function bySchoolTable(rows, schools){
  const m={};
  rows.forEach(r=>{
    m[r.schoolId]=m[r.schoolId]||{b:0,g:0};
    m[r.schoolId].b+=Number(r.maleCount||0);
    m[r.schoolId].g+=Number(r.femaleCount||0);
  });
  const data=Object.keys(m).map(id=>({id, b:m[id].b, g:m[id].g}));
  const tb=U.sum(data,d=>d.b), tg=U.sum(data,d=>d.g), tt=tb+tg;
  return '<div class="card"><div class="card-head"><h3>'+U.t('studentsBySchool')+'</h3></div><div class="card-body">'+
    (data.length?U.tableHTML(
      [{key:0,label:L('ښوونځی','مدرسه')},{key:1,label:L('هلکان','پسران')},{key:2,label:L('نجونې','دختران')},{key:3,label:L('مجموعه','جمع')}],
      data.map((d,i)=>({0:(window.__schoolName&&window.__schoolName[d.id])||'',1:U.num(d.b),2:U.num(d.g),3:U.num(d.b+d.g)})),
      ()=>''
    )+'<div class="divider"></div><div class="flex strong">'+
      '<span>'+U.t('total')+'</span><span class="grow"></span>'+U.num(tb)+' / '+U.num(tg)+' / '+U.num(tt)+'</div>'
    :U.emptyState('school',U.t('noData')))+
  '</div></div>';
}

function byGradeTable(rows){
  const m={};
  rows.forEach(r=>{
    m[r.className]=m[r.className]||{b:0,g:0};
    m[r.className].b+=Number(r.maleCount||0);
    m[r.className].g+=Number(r.femaleCount||0);
  });
  const data=Object.keys(m).sort((a,b)=>Number(a)-Number(b)).map(g=>[
    gradeLabel(g), U.num(m[g].b), U.num(m[g].g), U.num(m[g].b+m[g].g)
  ]);
  return '<div class="card"><div class="card-head"><h3>'+U.t('studentsByGrade')+'</h3></div><div class="card-body">'+
    (data.length?U.tableHTML(
      [{key:0,label:L('ټولګی','پایه')},{key:1,label:L('هلکان','پسران')},{key:2,label:L('نجونې','دختران')},{key:3,label:L('مجموعه','جمع')}],
      data.map((r,i)=>({0:r[0],1:r[1],2:r[2],3:r[3]})),
      ()=>''
    ):U.emptyState('chart',U.t('noData')))+
  '</div></div>';
}

async function prepFilters(){
  const opts=await optionsFromStore('schools','name');
  CFG.filters.forEach(f=>{
    if(f.type==='schoolsel') f.options=opts.map(o=>({v:o.id,ps:o.label,fa:o.label}));
    if(f.type==='gradesel') f.options=I18N.grades.map(g=>({v:g.v,ps:g.ps,fa:g.fa}));
  });
}

function openForm(rec){
  CRUD.openForm(CFG, rec||{academicYear:Settings.get().academicYear, schoolId:ST.school, className:ST.grade, genderMode:'mixed', maleCount:0, femaleCount:0});
}

/* ---------------- excel ---------------- */
function exportStats(rows){
  const schools=window.__schoolName||{};
  const headers=[L('ښوونځی','مدرسه'),L('کال','سال'),L('ټولګی','پایه'),L('شعبه','شعبه'),L('جنسیت','جنسیت'),L('هلکان','پسران'),L('نجونې','دختران'),L('مجموعه','جمع')];
  const T=StudentStatsModule.totals(rows);
  const data=rows.map(r=>[schools[r.schoolId]||'', r.academicYear||'', gradeLabel(r.className), secText(r),
    r.genderMode?U.statusLabel('g_'+r.genderMode):'', Number(r.maleCount||0), Number(r.femaleCount||0),
    Number(r.maleCount||0)+Number(r.femaleCount||0)]);
  ExcelExport.exportTable(U.t('navStudents'), headers.map(h=>U.tv(h)), data, {
    totals:[U.t('total'),'','','','',T.m,T.g,T.t], file:'students'
  });
}

/* ---------------- print ---------------- */
async function printStats(rec){
  const rows=await DB.getAll('studentStats');
  const schools=await DB.getAll('schools');
  const bySchool=Object.fromEntries(schools.map(s=>[s.id,s.name]));
  const schoolId=rec&&rec.schoolId;
  const year=rec&&rec.academicYear;
  let f=rows.slice();
  if(schoolId) f=f.filter(r=>r.schoolId===schoolId);
  if(year) f=f.filter(r=>String(r.academicYear)===String(year));
  const T=StudentStatsModule.totals(f);

  const groups={};
  f.forEach(r=>{ groups[r.schoolId]=groups[r.schoolId]||{}; });
  const sections=Object.keys(groups).map(sid=>{
    const rs=f.filter(r=>r.schoolId===sid);
    const keys=[...new Set(rs.map(r=>r.className+'||'+(r.section||'')))].sort((a,b)=>{
      const [ga,sa]=a.split('||'), [gb,sb]=b.split('||');
      return (Number(ga)-Number(gb)) || sa.localeCompare(sb);
    });
    const rows2=keys.map(k=>{
      const [g,sec]=k.split('||');
      const grp=rs.filter(r=>r.className===g && (r.section||'')===sec);
      const b=grp.reduce((a,r)=>a+Number(r.maleCount||0),0);
      const gi=grp.reduce((a,r)=>a+Number(r.femaleCount||0),0);
      return [gradeLabel(g)+(sec?' — '+sec:''), b, gi, b+gi];
    });
    return {heading:(bySchool[sid]||''), html: PrintDoc.table(
      [L('ټولګی','پایه'),L('هلکان','پسران'),L('نجونې','دختران'),L('مجموعه','جمع')], rows2,
      {numCols:[1,2,3], totals:[U.t('total'), U.sum(rows2,r=>r[1]), U.sum(rows2,r=>r[2]), U.sum(rows2,r=>r[3])]})};
  });
  const doc=await PrintDoc.officialDoc({
    seqType:'students',
    title: U.t('navStudents')+' — '+U.t('report'),
    meta:[{k:U.t('totalStudents'),v:T.t},{k:U.t('totalBoys'),v:T.m},{k:U.t('totalGirls'),v:T.g}],
    sections
  });
  PrintDoc.preview(doc, U.t('print'));
}

/* shared aggregation helper: {m: boys, g: girls, t: total} */
window.StudentStatsModule={
  CFG, MODES, printStats, exportStats,
  totals(rows){
    const t=(rows||[]).reduce((a,r)=>{
      a.m+=Number(r.maleCount||0);
      a.g+=Number(r.femaleCount||0);
      return a;
    },{m:0,g:0});
    return {m:t.m, g:t.g, t:t.m+t.g};
  }
};
})();
