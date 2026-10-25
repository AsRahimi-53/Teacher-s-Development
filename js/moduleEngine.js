/* =====================================================================
   moduleEngine.js — generic CRUD engine.
   Each module registers a config (fields, table cols, filters); the
   engine renders list page, search/filter toolbar, table, form modal,
   detail modal, delete, print & export wiring.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

/* module state (per-page search/filter, in-memory only) */
const STATE = {};

async function optionsFromStore(store, labelKey, subKey, filter){
  const rows = await DB.getAll(store);
  let out = rows.filter(r=>!filter || filter(r));
  return out.map(r=>({
    id: r.id,
    label: r[labelKey] || r.fullName || r.name || r.title || r.id,
    sub: subKey ? (r[subKey]||'') : ''
  }));
}

const CRUD = {
  state(key){ return STATE[key] || (STATE[key]={search:'', filters:{}}); },

  /* ---------- page scaffold ---------- */
  pageHead(cfg, count, actionsHTML){
    return '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon(cfg.icon)+'</div>'+
      '<div><h1>'+U.t(cfg.titleKey)+'</h1>'+(cfg.subKey?'<div class="ph-sub">'+U.t(cfg.subKey)+'</div>':'')+'</div>'+
      '<div class="count-chip"><b>'+U.num(count)+'</b> '+U.t('records')+'</div>'+
      '<div class="ph-actions">'+(actionsHTML||'')+'</div>'+
    '</div>';
  },

  headerButtons(cfg, extra){
    return (extra||'') +
      '<button class="btn btn-outline" data-act="exportAll">'+U.icon('download')+U.t('exportExcel')+'</button>'+
      '<button class="btn btn-outline" data-act="printAll">'+U.icon('printer')+U.t('printAll')+'</button>'+
      '<button class="btn btn-primary" data-act="add">'+U.icon('plus')+U.t('add')+'</button>';
  },

  /* ---------- toolbar ---------- */
  toolbarHTML(cfg){
    const st=this.state(cfg.key);
    let html='<div class="toolbar" id="toolbar_'+cfg.key+'">'+
      '<div class="tb-grow"><span class="tb-icon">'+U.icon('search')+'</span>'+
      '<input type="search" id="ts_'+cfg.key+'" value="'+U.escapeHtml(st.search)+'" placeholder="'+U.t('searchPh')+'"></div>';
    (cfg.filters||[]).forEach(f=>{
      const val=st.filters[f.key]||'';
      if(f.type==='date'){
        html+='<input type="date" class="flt flt-date" data-fkey="'+f.key+'" value="'+U.escapeHtml(val)+'" title="'+U.escapeHtml(U.tv(f.label))+'">';
      } else {
        html+='<select class="flt" data-fkey="'+f.key+'"><option value="">'+U.escapeHtml(U.tv(f.label))+': '+U.t('all')+'</option>'+
          (f.options||[]).map(o=>'<option value="'+U.escapeHtml(String(o.v))+'"'+(String(val)===String(o.v)?' selected':'')+'>'+U.escapeHtml(U.tv(o))+'</option>').join('')+
        '</select>';
      }
    });
    html+='</div>';
    return html;
  },

  wireToolbar(cfg, onRefilter){
    const st=this.state(cfg.key);
    const ts=document.getElementById('ts_'+cfg.key);
    if(ts) ts.addEventListener('input', U.debounce(()=>{ st.search=ts.value; onRefilter(); },200));
    document.querySelectorAll('#toolbar_'+cfg.key+' [data-fkey]').forEach(el=>{
      el.addEventListener('change', ()=>{ st.filters[el.dataset.fkey]=el.value; onRefilter(); });
    });
  },

  /* ---------- filtering ---------- */
  applyFilters(cfg, rows){
    const st=this.state(cfg.key);
    const q=st.search.trim().toLowerCase();
    let out=rows;
    if(q){
      const keys=cfg.searchKeys||[];
      out=out.filter(r=>keys.some(k=>String(r[k]||'').toLowerCase().includes(q)));
    }
    (cfg.filters||[]).forEach(f=>{
      const v=st.filters[f.key];
      if(v===undefined||v==='') return;
      out=out.filter(r=>{
        if(f.match) return f.match(r,v);
        return String(r[f.key])===String(v);
      });
    });
    if(cfg.sort) out=U.sortBy(out,cfg.sort.key,cfg.sort.dir||'asc');
    return out;
  },

  /* ---------- list page ---------- */
  async renderList(cfg){
    const view=document.getElementById('view');
    const all=await DB.getAll(cfg.key);
    window.__cacheAll = window.__cacheAll || {};
    window.__cacheAll[cfg.key]=all;
    const rows=this.applyFilters(cfg,all);
    const head=this.pageHead(cfg, all.length,
      this.headerButtons(cfg));
    view.innerHTML = head + this.toolbarHTML(cfg) + '<div id="tablebox_'+cfg.key+'"></div>';
    this.wireToolbar(cfg, ()=>this.renderTable(cfg));
    this.renderTable(cfg);

    view.querySelectorAll('[data-act]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const act=b.dataset.act;
        if(act==='add') this.openForm(cfg,null);
        if(act==='exportAll'){
          const r2=this.applyFilters(cfg, await DB.getAll(cfg.key));
          window.ExcelExport.exportList(cfg,r2);
        }
        if(act==='printAll'){
          const r2=this.applyFilters(cfg, await DB.getAll(cfg.key));
          window.PrintDoc.printTableDoc(cfg,r2);
        }
      });
    });
  },

  /* render a full list (toolbar + table + its own header row) into a
     given container — used for tabbed module pages */
  async renderTab(cfg, mount){
    const all=await DB.getAll(cfg.key);
    window.__cacheAll = window.__cacheAll || {};
    window.__cacheAll[cfg.key]=all;
    mount.innerHTML=
      '<div class="card mb-3"><div class="card-head"><h3>'+U.t(cfg.titleKey)+
        '</h3><span class="count-chip"><b>'+U.num(all.length)+'</b> '+U.t('records')+'</span>'+
      '<div class="ph-actions" style="margin-inline-start:auto">'+this.headerButtons(cfg)+'</div></div>'
      +'<div class="card-body">'+this.toolbarHTML(cfg)+'<div id="tablebox_'+cfg.key+'"></div></div></div>';
    this.wireToolbar(cfg, ()=>this.renderTable(cfg));
    mount.querySelectorAll('[data-act]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const act=b.dataset.act;
        if(act==='add') this.openForm(cfg,null);
        if(act==='exportAll'){
          const r2=this.applyFilters(cfg, await DB.getAll(cfg.key));
          window.ExcelExport.exportList(cfg,r2);
        }
        if(act==='printAll'){
          const r2=this.applyFilters(cfg, await DB.getAll(cfg.key));
          window.PrintDoc.printTableDoc(cfg,r2);
        }
      });
    });
    this.renderTable(cfg);
  },

  renderTable(cfg){
    const box=document.getElementById('tablebox_'+cfg.key);
    if(!box) return;
    const st=this.state(cfg.key);
    const q=st.search.trim().toLowerCase();
    let rows=[];
    if(q) box.innerHTML='<div class="spinner"></div>';
    // rows are computed in renderList; recompute here from cached all
    const all=window.__cacheAll && window.__cacheAll[cfg.key] ? window.__cacheAll[cfg.key] : [];
    rows=this.applyFilters(cfg,all);
    if(!rows.length){
      const any=st.search || Object.values(st.filters).some(v=>v);
      box.innerHTML = any
        ? U.emptyState('search', U.t('noResults'), U.t('noResultsSub'))
        : U.emptyState(cfg.icon, U.t('noData'), U.t('noDataSub'),
            '<button class="btn btn-primary" id="esAdd">'+U.icon('plus')+U.t('add')+'</button>');
      const es=box.querySelector('#esAdd');
      if(es) es.addEventListener('click', ()=>this.openForm(cfg,null));
      return;
    }
    const actions=(r)=>
      '<button class="icon-btn sm" data-row="view" data-id="'+r.id+'" title="'+U.t('view')+'">'+U.icon('eye')+'</button>'+
      '<button class="icon-btn sm" data-row="edit" data-id="'+r.id+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
      (cfg.print ? '<button class="icon-btn sm" data-row="print" data-id="'+r.id+'" title="'+U.t('print')+'">'+U.icon('printer')+'</button>' : '')+
      (cfg.canDelete && !cfg.canDelete(r) ? '' :
        '<button class="icon-btn sm danger" data-row="del" data-id="'+r.id+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>');
    box.innerHTML=U.tableHTML(cfg.tableCols, rows, actions);
    box.querySelectorAll('[data-row]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const rec=await DB.get(cfg.key,b.dataset.id);
        if(!rec) return U.toast(U.t('noResults'),'error');
        const act=b.dataset.row;
        if(act==='view') this.openDetail(cfg,rec);
        if(act==='edit') this.openForm(cfg,rec);
        if(act==='del') this.remove(cfg,rec);
        if(act==='print' && cfg.print) cfg.print(rec);
      });
    });
  },

  /* ---------- form ---------- */
  async openForm(cfg, record){
    const values = record ? {...record} : (cfg.makeRecord?cfg.makeRecord():{});
    const isEdit=!!record;
    const body=UI.formHTML(cfg.fields, values);
    const m=UI.modal({
      title: (isEdit?U.t('editRecord'):U.t('newRecord'))+' — '+U.t(cfg.titleKey),
      sub: isEdit && record.fullName ? record.fullName : (isEdit && record.name ? record.name : ''),
      icon: cfg.icon,
      size: (cfg.fields||[]).length>10 ? 'lg':'md',
      body,
      foot:
        '<button type="button" class="btn btn-outline" data-a="cancel">'+U.t('cancel')+'</button>'+
        '<button type="button" class="btn btn-primary" data-a="save">'+U.icon('check')+U.t('save')+'</button>'
    });
    const formRoot=m.body;

    // attach special widgets
    for(const f of cfg.fields){
      if(f.type==='msStore'){
        const fieldBox=formRoot.querySelector('[data-field="'+f.key+'"]');
        if(!fieldBox) continue;
        fieldBox.innerHTML='<label>'+U.escapeHtml(U.tv(f.label))+(f.required?'<span class="req">*</span>':'')+'</label>';
        const opts=await optionsFromStore(f.store, f.labelKey||'fullName', f.subKey, f.filter);
        const ms=UI.multiSelect(fieldBox, {
          key:f.key, options:opts, selected:values[f.key]||[], placeholder:U.t(f.placeholderKey||'selectMultiple')
        });
      } else if(f.type==='ms'){
        const fieldBox=formRoot.querySelector('[data-field="'+f.key+'"]');
        if(!fieldBox) continue;
        fieldBox.innerHTML='<label>'+U.escapeHtml(U.tv(f.label))+(f.required?'<span class="req">*</span>':'')+'</label>';
        UI.multiSelect(fieldBox, {
          key:f.key, options:(f.options||[]).map(o=>({id:o.v,label:U.tv(o)})),
          selected:values[f.key]||[], placeholder:U.t('selectMultiple')
        });
      } else if(f.type==='store'){
        const fieldBox=formRoot.querySelector('[data-field="'+f.key+'"]');
        if(!fieldBox) continue;
        const sel=formRoot.querySelector('[name="'+f.key+'"]');
        const opts=await optionsFromStore(f.store, f.labelKey||'name', f.subKey, f.filter);
        if(sel){
          sel.innerHTML='<option value="">'+U.t('selectOne')+'</option>'+
            opts.map(o=>'<option value="'+U.escapeHtml(o.id)+'">'+U.escapeHtml(o.label+(o.sub?' — '+o.sub:''))+'</option>').join('');
          sel.value=values[f.key]||'';
        }
      } else if(f.type==='settingsopt'){
        const fieldBox=formRoot.querySelector('[data-field="'+f.key+'"]');
        if(!fieldBox) continue;
        const sel=formRoot.querySelector('[name="'+f.key+'"]');
        const opts = typeof f.opts==='function' ? f.opts() : (f.opts||[]);
        if(sel){
          sel.innerHTML='<option value="">'+U.t('selectOne')+'</option>'+
            opts.map(o=>'<option value="'+U.escapeHtml(o.ps)+'">'+U.escapeHtml(U.tv(o))+'</option>').join('');
          sel.value = (values[f.key] && values[f.key].ps) || '';
        }
      } else if(f.type==='photo'){
        UI.attachPhoto(formRoot, f, values[f.key]||'');
      } else if(f.type==='studCounts'){
        UI.attachStudCounts(formRoot, f);
      }
    }

    const doSave=async ()=>{
      const vals=UI.collectForm(formRoot, cfg.fields);
      // sync photo state
      cfg.fields.forEach(f=>{
        if(f.type==='photo'){
          const box=formRoot.querySelector('[data-field="'+f.key+'"]');
          if(box && box._getPhoto) vals[f.key]=box._getPhoto();
        }
        if(f.type==='settingsopt'){
          const opts = typeof f.opts==='function' ? f.opts() : (f.opts||[]);
          const key=vals[f.key];
          vals[f.key]= (key!==undefined && key!=='') ? (opts.find(o=>o.ps===key) || {ps:key,fa:key}) : '';
        }
      });
      const errs=UI.validate(cfg.fields, vals);
      if(errs.length){
        U.toast(U.t('fillRequired')+': '+errs.join('، '),'error');
        return;
      }
      const rec = isEdit ? {...record, ...vals} : Object.assign(cfg.makeRecord?cfg.makeRecord():{}, vals);
      rec.id = rec.id || U.uid();
      rec.updatedAt = new Date().toISOString();
      if(!rec.createdAt) rec.createdAt = rec.updatedAt;
      if(cfg.beforeSave){
        const err = await cfg.beforeSave(rec, record);
        if(err){ U.toast(err,'error'); return; }
      }
      await DB.put(cfg.key, rec);
      U.toast(U.t(isEdit?'updated':'saved'),'success');
      m.close();
      window.App.refreshView();
    };

    m.el.querySelector('[data-a=save]').addEventListener('click', doSave);
    m.el.querySelector('[data-a=cancel]').addEventListener('click', ()=>m.close());
  },

  /* ---------- detail ---------- */
  async openDetail(cfg, rec){
    let body;
    if(cfg.detail){
      body = await cfg.detail(rec);
    } else {
      body = await this.genericDetail(cfg, rec);
    }
    const m=UI.modal({
      title: U.t('viewRecord')+' — '+U.t(cfg.titleKey),
      sub: rec.fullName||rec.name||rec.title||'',
      icon: cfg.icon,
      size:'lg',
      body,
      foot:
        (cfg.print?'<button type="button" class="btn btn-outline" data-a="print">'+U.icon('printer')+U.t('print')+'</button>':'')+
        '<button type="button" class="btn btn-outline" data-a="edit">'+U.icon('edit')+U.t('edit')+'</button>'+
        (cfg.canDelete && !cfg.canDelete(rec) ? '' :
          '<button type="button" class="btn btn-danger-soft" data-a="del">'+U.icon('trash')+U.t('delete')+'</button>')
    });
    m.el.querySelector('[data-a=edit]').addEventListener('click', ()=>{ m.close(); this.openForm(cfg,rec); });
    const delBtn=m.el.querySelector('[data-a=del]');
    if(delBtn) delBtn.addEventListener('click', async ()=>{
      const ok=await UI.confirm({danger:true, title:U.t('delete'), msg:U.t('confirmDelete'), okLabel:U.t('delete')});
      if(ok){ await DB.del(cfg.key,rec.id); U.toast(U.t('deleted'),'success'); m.close(); window.App.refreshView(); }
    });
    if(cfg.print){
      m.el.querySelector('[data-a=print]').addEventListener('click', ()=>cfg.print(rec));
    }
  },

  async genericDetail(cfg, rec){
    const head = (rec.photo||rec.logo)
      ? '<div class="detail-head"><img class="dh-photo" src="'+(rec.photo||rec.logo)+'" alt=""><div><h2>'+U.escapeHtml(rec.fullName||rec.name||rec.title||'')+'</h2><div class="dh-sub">'+U.t(cfg.titleKey)+'</div></div></div>'
      : '<div class="detail-head"><div class="dh-avatar">'+U.escapeHtml(U.initials(rec.fullName||rec.name||''))+'</div><div><h2>'+U.escapeHtml(rec.fullName||rec.name||rec.title||'')+'</h2><div class="dh-sub">'+U.t(cfg.titleKey)+'</div></div></div>';
    const pairs=[];
    for(const f of cfg.fields){
      if(f.type==='photo') continue;
      let v=rec[f.key];
      if(f.type==='select') v=U.tv((f.options||[]).find(o=>String(o.v)===String(v))||v);
      if(f.type==='store'){
        const r=await DB.get(f.store, v);
        v=r?(r[f.labelKey]||r.fullName||r.name||''):'';
      }
      if(f.type==='msStore'){
        const all=await DB.getAll(f.store);
        const byId=Object.fromEntries(all.map(x=>[x.id,x]));
        v=(v||[]).map(id=>{const x=byId[id]; return x?(x[f.labelKey]||x.fullName||x.name||''):'';}).filter(Boolean).join('، ');
      }
      if(f.type==='rating') v=v?U.STATUS['rg_'+v][U.currentLang()]:'—';
      if(f.type==='date') v=v?U.fmtDate(v):'';
      pairs.push({k:f.label, v});
    }
    return head + UI.detailKV(pairs);
  },

  /* ---------- delete ---------- */
  async remove(cfg, rec){
    if(cfg.canDelete && !cfg.canDelete(rec)){ U.toast(U.t('accountNoDelete'),'warning'); return; }
    const name = rec.fullName||rec.name||rec.title||rec.id;
    const ok=await UI.confirm({
      danger:true, title:U.t('delete'),
      msg: U.t('confirmDelete')+'<br><b>'+U.escapeHtml(name)+'</b><br><span class="muted small">'+U.t('deleteWarn')+'</span>',
      okLabel:U.t('delete')
    });
    if(!ok) return;
    await DB.del(cfg.key,rec.id);
    U.toast(U.t('deleted'),'success');
    window.App.refreshView();
  }
};

window.CRUD = CRUD;
window.optionsFromStore = optionsFromStore;

/* convenience: field builder */
window.F = function(key, label, type, opts){
  opts=opts||{};
  const f={key, label, type:type||'text'};
  if(opts.required!==undefined) f.required=opts.required;
  if(opts.span) f.span=opts.span;
  if(opts.options) f.options=opts.options;
  if(opts.opts) f.opts=opts.opts;
  if(opts.store) f.store=opts.store;
  if(opts.labelKey) f.labelKey=opts.labelKey;
  if(opts.subKey) f.subKey=opts.subKey;
  if(opts.filter) f.filter=opts.filter;
  if(opts.min!==undefined) f.min=opts.min;
  if(opts.max!==undefined) f.max=opts.max;
  if(opts.rows) f.rows=opts.rows;
  if(opts.placeholder) f.placeholder=opts.placeholder;
  if(opts.hint) f.hint=opts.hint;
  if(opts.maxDim) f.maxDim=opts.maxDim;
  if(opts.placeholderKey) f.placeholderKey=opts.placeholderKey;
  return f;
};

})();
