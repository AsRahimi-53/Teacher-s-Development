/* =====================================================================
   reports.js — report management: generate (by type + scope), list,
   view (rendered in current language), print, Excel export.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

register('reports', {render: async (id)=>{
  Nav.setActive('reports');
  if(id) return renderReportPage(id);
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navReports')}]);
  const view=document.getElementById('view');
  const rows=await DB.getAll('reports');
  rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('file')+'</div>'+
      '<div><h1>'+U.t('navReports')+'</h1><div class="ph-sub">'+U.t('appSub')+'</div></div>'+
      '<div class="ph-actions"><button class="btn btn-primary" id="rpNew">'+U.icon('plus')+U.t('generate')+'</button></div>'+
    '</div>'+
    '<div class="grid-2" style="grid-template-columns:380px 1fr">'+
      '<div class="card"><div class="card-head"><h3>'+U.t('generate')+'</h3></div><div class="card-body">'+
        '<div class="field mb-2"><label>'+U.t('reportType')+'</label>'+
          '<select id="rpType">'+Object.keys(ReportGen.types).map(k=>'<option value="'+k+'">'+U.t(ReportGen.types[k].title)+'</option>').join('')+'</select></div>'+
        '<div id="rpScope"></div>'+
        '<button class="btn btn-primary btn-block mt-2" id="rpGo">'+U.icon('file')+U.t('generate')+'</button>'+
      '</div></div>'+
      '<div class="card"><div class="card-head"><h3>'+U.t('navReports')+' ('+U.num(rows.length)+')'+'</h3></div><div class="card-body flush" style="max-height:70vh;overflow:auto">'+
        (rows.length?U.tableHTML(
          [{key:0,label:L('سرلیک','عنوان')},{key:1,label:L('ډول','نوع')},{key:2,label:L('نېټه','تاریخ')}],
          rows.map(r=>({0:r.title?U.tv(r.title):'',1:U.t(ReportGen.types[r.type]?ReportGen.types[r.type].title:'repDaily'),2:U.fmtDate(r.createdAt)})),
          (r,i)=>
            '<button class="icon-btn sm" data-rv="'+rows[i].id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
            '<button class="icon-btn sm" data-rp="'+rows[i].id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>'+
            '<button class="icon-btn sm" data-re="'+rows[i].id+'" title="'+U.t('export')+'">'+U.icon('download')+'</button>'+
            '<button class="icon-btn sm danger" data-rd="'+rows[i].id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>'
        ):U.emptyState('file',U.t('noData'),U.t('noDataSub')))+
      '</div></div>'+
    '</div>';

  const typeSel=document.getElementById('rpType');
  const scopeBox=document.getElementById('rpScope');
  function renderScope(){
    const ty=typeSel.value||'daily';
    const t=ReportGen.types[ty]||ReportGen.types.daily;
    let html='';
    const needPeriod=!!t.period && !['member','school','teacher','observation','activity','students','tashkil','plan','duty','profdev'].includes(ty);
    if(ty==='member'||ty==='teacher'||ty==='observation'||ty==='activity'||ty==='school'){
      html+=scopeSelect(ty);
    } else {
      if(t.memberIds!==undefined){}
      html+=msField('memberIds',U.t('selectMembers'),'members','fullName');
      html+=msField('schoolIds',U.t('selectSchools'),'schools','name');
      if(needPeriod) html+='<div class="field mb-2"><label>'+U.t('periodFrom')+'</label><input type="date" id="rpStart" value="'+U.todayISO()+'"></div>';
      if(ty==='students') html+='<div class="field mb-2"><label>'+U.t('academicYear')+'</label><input type="text" id="rpYear" value="'+Settings.get().academicYear+'"></div>';
    }
    scopeBox.innerHTML=html;
    wireMs();
  }
  function msField(key,label,store,labelKey){
    return '<div class="field mb-2" data-msf="'+key+'"><label>'+label+'</label></div>';
  }
  let msWidgets={};
  async function wireMs(){
    msWidgets={};
    scopeBox.querySelectorAll('[data-msf]').forEach(async box=>{
      const key=box.dataset.msf;
      const store = key==='memberIds'?'members':'schools';
      const opts=await optionsFromStore(store, store==='members'?'fullName':'name');
      const wrap=document.createElement('div');
      box.appendChild(wrap);
      msWidgets[key]=UI.multiSelect(wrap,{key, options:opts, selected:[], placeholder:U.t('noSelection')+' — '+U.t('entireDistrict')});
    });
  }
  function scopeSelect(ty){
    let store,labelKey;
    if(ty==='member'){ store='members'; labelKey='fullName'; }
    if(ty==='teacher'){ store='teachers'; labelKey='fullName'; }
    if(ty==='school'){ store='schools'; labelKey='name'; }
    if(ty==='observation'||ty==='activity'){ store= ty==='observation'?'observations':'activities'; labelKey=null; }
    const opts= store==='observations'||store==='activities' ? [] : null;
    return '<div class="field mb-2"><label>'+U.t('selectOne')+'</label><div id="rpOneBox"></div></div>';
  }

  typeSel.addEventListener('change', ()=>{ renderScope(); if(typeSel.value==='observation'||typeSel.value==='activity'||typeSel.value==='teacher'||typeSel.value==='member'||typeSel.value==='school') loadOneSel(typeSel.value); });
  async function loadOneSel(ty){
    const box=document.getElementById('rpOneBox');
    if(!box) return;
    let opts=[];
    if(ty==='member') opts=await optionsFromStore('members','fullName');
    if(ty==='teacher') opts=await optionsFromStore('teachers','fullName');
    if(ty==='school') opts=await optionsFromStore('schools','name');
    if(ty==='observation'){
      const obs=await DB.getAll('observations');
      const [T,M]=await Promise.all([DB.getAll('teachers'),DB.getAll('members')]);
      const tb=Object.fromEntries(T.map(x=>[x.id,x.fullName])), mb=Object.fromEntries(M.map(x=>[x.id,x.fullName]));
      opts=obs.map(o=>({id:o.id,label:(tb[o.teacherId]||{}).fullName||''+' #'+o.observationNumber+' — '+(mb[o.observerId]||{}).fullName||''}));
    }
    if(ty==='activity'){
      const acts=await DB.getAll('activities');
      opts=acts.map(a=>({id:a.id,label:a.title||''}));
    }
    box.innerHTML='<select class="flt" id="rpOne" style="width:100%;max-width:none"><option value="">'+U.t('selectOne')+'</option>'+
      opts.map(o=>'<option value="'+o.id+'">'+U.escapeHtml(o.label)+'</option>').join('')+'</select>';
  }
  renderScope();
  loadOneSel(typeSel.value);

  /* the top «generate» button just brings the form into view (it had no handler) */
  const rpNew=document.getElementById('rpNew');
  if(rpNew) rpNew.addEventListener('click', ()=>{
    typeSel.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>{ try{ typeSel.focus(); }catch(e){} }, 350);
  });

  document.getElementById('rpGo').addEventListener('click', async ()=>{
    const ty=typeSel.value;
    const scope={};
    const single=document.getElementById('rpOne');
    if(single&&single.value){
      if(ty==='member') scope.memberIds=[single.value];
      if(ty==='teacher') scope.teacherId=single.value;
      if(ty==='school') scope.schoolIds=[single.value];
      if(ty==='observation') scope.observationId=single.value;
      if(ty==='activity') scope.activityId=single.value;
    }
    if(!single){
      if(msWidgets.memberIds) scope.memberIds=msWidgets.memberIds._selected();
      if(msWidgets.schoolIds) scope.schoolIds=msWidgets.schoolIds._selected();
    }
    const st=document.getElementById('rpStart');
    if(st) scope.start=st.value;
    const yr=document.getElementById('rpYear');
    if(yr) scope.academicYear=yr.value;
    if(!scope.start) scope.start=U.todayISO();
    if(ty==='member'&&!scope.memberIds.length) return U.toast(U.t('fillRequired'),'error');
    if((ty==='teacher'||ty==='observation'||ty==='activity')&&!single?.value) return U.toast(U.t('fillRequired'),'error');
    if(ty==='school'&&!scope.schoolIds.length) return U.toast(U.t('fillRequired'),'error');

    U.toast(U.t('loading'),'info');
    try{
      const report=await ReportGen.build(ty, scope);
      await DB.put('reports',report);
      U.toast(U.t('saved'),'success');
      location.hash='#/reports/'+report.id;
    }catch(e){
      console.error(e);
      U.toast(e.message||U.t('error'),'error');
    }
  });

  view.querySelectorAll('[data-rv]').forEach(b=>b.addEventListener('click', ()=>location.hash='#/reports/'+b.dataset.rv));
  view.querySelectorAll('[data-rp]').forEach(b=>b.addEventListener('click', async ()=>{
    const r=await DB.get('reports',b.dataset.rp); if(r) ReportGen.printReport(r);
  }));
  view.querySelectorAll('[data-re]').forEach(b=>b.addEventListener('click', async ()=>{
    const r=await DB.get('reports',b.dataset.re); if(r) exportReport(r);
  }));
  view.querySelectorAll('[data-rd]').forEach(b=>b.addEventListener('click', async ()=>{
    const r=await DB.get('reports',b.dataset.rd);
    if(!r) return;
    const ok=await UI.confirm({danger:true,title:U.t('delete'),msg:U.t('confirmDelete'),okLabel:U.t('delete')});
    if(ok){ await DB.del('reports',r.id); U.toast(U.t('deleted'),'success'); Nav.go('reports'); }
  }));
}});

async function renderReportPage(id){
  const r=await DB.get('reports',id);
  if(!r){ location.hash='#/reports'; return; }
  const view=document.getElementById('view');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navReports'),route:'reports'},{label:U.tv(r.title)}]);
  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('file')+'</div>'+
      '<div><h1>'+U.escapeHtml(U.tv(r.title))+'</h1><div class="ph-sub">'+U.t(ReportGen.types[r.type]?ReportGen.types[r.type].title:'')+' · '+U.fmtDate(r.createdAt)+'</div></div>'+
      '<div class="ph-actions">'+
        '<button class="btn btn-outline" id="rvExport">'+U.icon('download')+U.t('exportExcel')+'</button>'+
        '<button class="btn btn-primary" id="rvPrint">'+U.icon('printer')+U.t('print')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="card report-view"><div class="card-body" id="rvBody"></div></div>';
  document.getElementById('rvBody').innerHTML=ReportGen.render(r);
  document.getElementById('rvPrint').addEventListener('click', ()=>ReportGen.printReport(r));
  document.getElementById('rvExport').addEventListener('click', ()=>exportReport(r));
}

/* ---------------- excel export of report ---------------- */
function exportReport(r){
  const aoa=[];
  const s=Settings.get();
  aoa.push([U.currentLang()==='fa'?'امارت اسلامی افغانستان':'د افغانستان اسلامي امارت']);
  aoa.push([((U.currentLang()==='fa'?'استان':'ولایت')+(s.province?' '+s.province:''))+' — '+((U.currentLang()==='fa'?'ولسوالی':'ولسوالۍ')+(s.district?' '+s.district:''))]);
  aoa.push([U.tv(r.title)]);
  aoa.push([U.t('reportType')+': '+U.t(ReportGen.types[r.type]?ReportGen.types[r.type].title:''), U.t('documentDate')+': '+U.fmtDate(U.todayISO())]);
  aoa.push([]);
  (r.sections||[]).forEach((sec,i)=>{
    aoa.push([(i+1)+'. '+U.tv(sec.heading)]);
    const c=sec.content||{};
    (c.paras||[]).forEach(p=>{ aoa.push([String(U.tv(p)).replace(/%%/g,'%')]); });
    (c.tables||[]).forEach(tb=>{
      aoa.push((tb.headers||[]).map(h=>U.tv(h)));
      (tb.rows||[]).forEach(row=>aoa.push(row.map(cell=>{
        if(cell===null||cell===undefined||cell==='') return '—';
        if(typeof cell==='number') return cell;
        if(typeof cell==='object') return String(U.tv(cell)).replace(/%%/g,'%');
        return String(cell).replace(/%%/g,'%');
      })));
      if(tb.totals) aoa.push(tb.totals.map(cell=> typeof cell==='number'?cell:(typeof cell==='object'?U.tv(cell):String(cell??'—'))));
    });
    aoa.push([]);
  });
  const headers=(r.sections&&r.sections[0]&&r.sections[0].content&&r.sections[0].content.tables&&r.sections[0].content.tables[0])?(r.sections[0].content.tables[0].headers.map(h=>String(U.tv(h)).length)):14;
  ExcelExport.exportWorkbook('report',[
    {name:String(U.tv(r.title)).slice(0,28), aoa, opts:{widths:Array.from({length:8},()=>({wch:22}))}}
  ]);
}

window.ReportsModule={renderReportPage, exportReport};
})();
