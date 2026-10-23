/* =====================================================================
   tashkil.js — staffing establishment (read-only, auto-computed).
   Counts of registered TEACHERS (by subject) and EMPLOYEES (by position)
   per school are derived automatically from the registered records.
   There is NO manual add/edit part by design.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

/* core auto-computation — shared with reports, print and school profile */
async function compute(schoolId){
  const [schools, teachers, employees] = await Promise.all([
    DB.getAll('schools'), DB.getAll('teachers'), DB.getAll('employees')
  ]);
  const T = teachers.filter(t=>!schoolId || t.schoolId===schoolId);
  const E = employees.filter(e=>!schoolId || e.schoolId===schoolId);
  const bySubject = (arr)=>{ const m={}; arr.forEach(t=>{ const k=t.subject||'—'; m[k]=(m[k]||0)+1; }); return m; };
  const byPosition = (arr)=>{ const m={}; arr.forEach(e=>{ const k=e.position?U.t(e.position):'—'; m[k]=(m[k]||0)+1; }); return m; };

  const out = schools.filter(s=>!schoolId || s.id===schoolId).map(s=>{
    const tS = T.filter(t=>t.schoolId===s.id);
    const eS = E.filter(e=>e.schoolId===s.id);
    const tm = bySubject(tS), em = byPosition(eS);
    const rows = [];
    Object.keys(tm).sort((a,b)=>a.localeCompare(b,'ps')).forEach(k=>rows.push({schoolId:s.id, schoolName:s.name, name:k, kind:'teacher', count:tm[k]}));
    Object.keys(em).sort((a,b)=>a.localeCompare(b,'ps')).forEach(k=>rows.push({schoolId:s.id, schoolName:s.name, name:k, kind:'employee', count:em[k]}));
    return { schoolId:s.id, schoolName:s.name, rows, totalTeachers:tS.length, totalEmployees:eS.length, total:tS.length+eS.length };
  });
  const totalTeachers = T.length, totalEmployees = E.length;
  return { schools:out, totalTeachers, totalEmployees, total:totalTeachers+totalEmployees };
}

/* flat rows for table / excel / print */
function flatRows(c){
  const rows=[];
  c.schools.forEach(g=>{
    g.rows.forEach(r=>rows.push(r));
    rows.push({schoolId:g.schoolId, schoolName:g.schoolName, name:U.t('total'), kind:'subtotal', count:g.total, sub:g});
  });
  return rows;
}

const KIND = { teacher:()=>U.t('staffTeacherKind'), employee:()=>U.t('staffEmployeeKind'), subtotal:()=>'', none:()=>'—' };

const CFG={
  key:'tashkil',
  titleKey:'tashkilTitle',
  icon:'layers',
  tableCols:[
    {key:'schoolName',label:L('ښوونځی','مدرسه'),cell:r=>r.schoolName||''},
    {key:'name',label:L('دنده / مضمون','سمت / مضمون'),cell:r=>r.name||''},
    {key:'kind',label:L('ډول','نوع'),render:r=>KIND[r.kind]?KIND[r.kind]():'',cell:r=>KIND[r.kind]?KIND[r.kind]():(r.kind||'')},
    {key:'count',label:L('شمېر','تعداد'),render:r=>r.kind==='subtotal'?'<b>'+U.num(r.count)+'</b>':U.num(r.count),cell:r=>Number(r.count)}
  ],
  exportTotals: (rows)=>{
    const c=rows.reduce((a,r)=>{ if(r.sub){ a.t+=r.sub.totalTeachers; a.e+=r.sub.totalEmployees; } return a; },{t:0,e:0});
    return [U.t('total'),'',c.t,c.e,c.t+c.e];
  }
};

let STATE={school:''};

register('tashkil', {render: async (id, params)=>{
  Nav.setActive('tashkil');
  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navTashkil')}]);
  const schools=await DB.getAll('schools');
  if(params && params.school) STATE.school=params.school;

  const c=await compute(STATE.school||null);
  const rows=flatRows(c);

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('layers')+'</div>'+
      '<div><h1>'+U.t('tashkilTitle')+'</h1><div class="ph-sub">'+U.t('tashkilSub')+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="tkExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-outline" id="tkPrint">'+U.icon('printer')+U.t('printAll')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="notice mb-3 small">'+U.icon('info')+' '+U.t('autoTashkilNote')+'</div>'+
    '<div class="stat-grid mb-3">'+
      statCard(c.totalTeachers,U.t('navTeachers'),'gradcap','primary')+
      statCard(c.totalEmployees,U.t('navEmployees'),'briefcase','success')+
      statCard(c.total,U.t('totalStaff'),'layers','warning')+
    '</div>'+
    '<div class="card mb-3"><div class="card-head"><h3>'+U.t('schoolTashkil')+'</h3></div><div class="card-body">'+
      '<div class="toolbar" style="margin-bottom:8px">'+
        '<select class="flt" id="tkSchool"><option value="">'+U.t('navSchools')+': '+U.t('all')+'</option>'+
        schools.map(s=>'<option value="'+s.id+'"'+(STATE.school===s.id?' selected':'')+'>'+U.escapeHtml(s.name)+'</option>').join('')+
        '</select>'+
      '</div>'+
    '</div></div>'+
    '<div class="card"><div class="card-head"><h3>'+U.t('records')+'</h3></div><div class="card-body flush" style="max-height:480px;overflow:auto">'+
      (rows.length?U.tableHTML(CFG.tableCols, rows, (r)=>
        '<button class="icon-btn sm" data-td="'+r.schoolId+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'
      ):U.emptyState('layers',U.t('noData'),U.t('noDataSub')))+
    '</div></div>';

  view.querySelectorAll('[data-td]').forEach(b=>b.addEventListener('click',()=>{ location.hash='#/schools/'+b.dataset.td; }));

  document.getElementById('tkSchool').addEventListener('change', async e=>{
    STATE.school=e.target.value;
    await window.App.route();
  });
  document.getElementById('tkExport').addEventListener('click', ()=>ExcelExport.exportList(CFG, rows));
  document.getElementById('tkPrint').addEventListener('click', async ()=>{
    const doc=await PrintDoc.officialDoc({
      seqType:'tashkil',
      title: U.t('tashkilTitle'),
      meta:[{k:U.t('navTeachers'),v:c.totalTeachers},{k:U.t('navEmployees'),v:c.totalEmployees},{k:U.t('totalStaff'),v:c.total}],
      sections:[{heading:U.t('summary'), html: PrintDoc.table(
        [L('ښوونځی','مدرسه'),L('دنده / مضمون','سمت / مضمون'),L('ډول','نوع'),L('شمېر','تعداد')],
        rows.map(r=>[r.schoolName||'', r.name||'', KIND[r.kind]?KIND[r.kind]():'', r.count]),
        {numCols:[3], totals:[U.t('total'),'','',c.total]}
      )}]
    });
    PrintDoc.preview(doc, U.t('print'));
  });
}});

/* per-school compute (used by schools profile tab + print + reports) */
async function forSchool(schoolId){
  const c=await compute(schoolId);
  const g=c.schools[0]||{schoolId, schoolName:'', rows:[], totalTeachers:0, totalEmployees:0, total:0};
  return g;
}

function statCard(n,label,icon,color){
  const map={primary:'var(--primary-soft)',success:'var(--success-soft)',danger:'var(--danger-soft)',warning:'var(--warning-soft)'};
  const fg={primary:'var(--primary)',success:'var(--success)',danger:'var(--danger)',warning:'var(--warning)'};
  return '<div class="stat-card" style="cursor:default;--sc-bg:'+map[color]+';--sc-fg:'+fg[color]+'">'+
    '<div class="sc-icon">'+U.icon(icon)+'</div><div><div class="sc-num">'+(typeof n==='number'?U.num(n):n)+'</div><div class="sc-label">'+label+'</div></div></div>';
}

window.TashkilModule={compute, forSchool, flatRows, CFG, KIND};
})();
