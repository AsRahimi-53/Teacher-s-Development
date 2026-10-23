/* =====================================================================
   ui.js — modals, toasts, confirm dialogs, form engine, multi-select,
   photo input, rating row, empty states, generic table renderer.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const UI = {

  /* ---------------- toast ---------------- */
  toast(msg, type, title){
    type = type || 'success';
    const icons={success:'check',error:'alert',warning:'alert',info:'info'};
    const titles={success:U.t('success'),error:U.t('error'),warning:U.t('warning'),info:U.t('info')};
    const root=document.getElementById('toast-root');
    const el=document.createElement('div');
    el.className='toast '+type;
    el.innerHTML='<div class="t-ico">'+U.icon(icons[type]||'info')+'</div><div><div class="t-title">'+(title||titles[type])+'</div><div class="t-msg">'+U.escapeHtml(msg)+'</div></div>';
    root.appendChild(el);
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),320); }, type==='error'?4500:3000);
  },

  /* ---------------- modal ---------------- */
  modal(opts){
    opts=opts||{};
    const root=document.getElementById('modal-root');
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const size = opts.size==='xl' ? 'modal-xl' : (opts.size==='lg' ? 'modal-lg' : (opts.size==='sm' ? '' : 'modal-md'));
    overlay.innerHTML =
      '<div class="modal '+size+'" role="dialog" aria-modal="true">'+
        '<div class="modal-head">'+
          (opts.icon?'<div class="mh-icon">'+U.icon(opts.icon)+'</div>':'')+
          '<div><h3>'+U.escapeHtml(opts.title||'')+'</h3>'+(opts.sub?'<div class="mh-sub">'+U.escapeHtml(opts.sub)+'</div>':'')+'</div>'+
          '<button type="button" class="icon-btn mh-close" aria-label="'+U.t('close')+'">'+U.icon('x')+'</button>'+
        '</div>'+
        '<div class="modal-body">'+(opts.body||'')+'</div>'+
        (opts.foot===false?'':'<div class="modal-foot">'+(opts.foot||'')+'</div>')+
      '</div>';
    root.appendChild(overlay);
    const close = ()=>{
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if(opts.onClose) opts.onClose();
    };
    const onKey = (e)=>{ if(e.key==='Escape' && !opts.sticky) close(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.mh-close').addEventListener('click', close);
    if(!opts.sticky) overlay.addEventListener('mousedown', (e)=>{ if(e.target===overlay) close(); });
    UI.attachJalaliHints(overlay);
    if(opts.onOpen) setTimeout(()=>opts.onOpen(overlay),20);
    return {el:overlay, close, body:overlay.querySelector('.modal-body')};
  },

  /* ---------------- Jalali dates ----------------
     Every native <input type="date"> (Gregorian picker) is upgraded in
     place to the Jalali calendar widget (js/jalali.js). Idempotent. */
  attachJalaliHints(root){
    if(window.Jalali) Jalali.upgrade(root);
  },

  /* ---------------- confirm ---------------- */
  confirm(opts){
    opts=opts||{};
    return new Promise(resolve=>{
      const danger = !!opts.danger;
      const m = UI.modal({
        title: opts.title || (danger?U.t('delete'):U.t('confirm')),
        icon: opts.icon || (danger?'trash':'info'),
        size:'sm',
        body:
          '<div class="confirm-ico '+(danger?'danger':(opts.warn?'warn':'info'))+'">'+U.icon(opts.icon||(danger?'trash':'info'))+'</div>'+
          '<div class="confirm-title">'+U.escapeHtml(opts.title||'')+'</div>'+
          /* msg is HTML built by the caller (user text is escaped by the caller) */
          '<div class="confirm-msg">'+(opts.msg||'')+'</div>',
        foot:
          '<button type="button" class="btn btn-outline" data-a="cancel">'+U.t('cancel')+'</button>'+
          '<button type="button" class="btn '+(danger?'btn-danger':'btn-primary')+'" data-a="ok">'+U.escapeHtml(opts.okLabel||U.t('confirm'))+'</button>',
        onClose: ()=>resolve(false)
      });
      let done=false;
      /* the REAL close function must be captured before it is overridden below,
         otherwise finish() would call itself and the dialog would never close */
      const origClose = m.close.bind(m);
      const finish=(v)=>{ if(done)return; done=true; resolve(v); origClose(); };
      m.el.querySelector('[data-a=ok]').addEventListener('click', ()=>finish(true));
      m.el.querySelector('[data-a=cancel]').addEventListener('click', ()=>finish(false));
      // X / overlay click / Esc resolve false
      m.close = ()=>{ finish(false); };
    });
  },

  alert(title, msg, icon){
    return new Promise(resolve=>{
      const m = UI.modal({
        title:title, icon:icon||'info', size:'sm',
        body:'<div class="confirm-ico info">'+U.icon(icon||'info')+'</div><div class="confirm-msg" style="margin-top:10px">'+U.escapeHtml(msg||'')+'</div>',
        foot:'<button type="button" class="btn btn-primary" data-a="ok">'+U.t('ok')+'</button>',
        onClose:()=>resolve()
      });
      m.el.querySelector('[data-a=ok]').addEventListener('click', ()=>m.close());
    });
  },

  /* ---------------- field renderers ---------------- */
  fieldHTML(f, value){
    const id = 'f_'+f.key;
    const val = value===undefined?'':value;
    let req = f.required?'<span class="req">*</span>':'';
    const label = '<label for="'+id+'">'+U.escapeHtml(U.tv(f.label))+'</label>';
    let input='';
    switch(f.type){
      case 'textarea':
        input='<textarea id="'+id+'" name="'+f.key+'" rows="'+(f.rows||3)+'" placeholder="'+U.escapeHtml(U.tv(f.placeholder||''))+'">'+U.escapeHtml(val)+'</textarea>';
        break;
      case 'number':
        input='<input type="number" id="'+id+'" name="'+f.key+'" value="'+U.escapeHtml(val)+'" min="'+(f.min===undefined?0:f.min)+'" max="'+(f.max===undefined?'':f.max)+'" step="'+(f.step||1)+'">';
        break;
      case 'date':
        input='<input type="date" id="'+id+'" name="'+f.key+'" value="'+U.escapeHtml(val)+'">';
        break;
      case 'select': {
        const opts=f.options||[];
        let html='<select id="'+id+'" name="'+f.key+'"><option value="">'+U.t('selectOne')+'</option>';
        opts.forEach(o=>{
          const v=String(o.v);
          const sel = String(val)===v ? 'selected':'';
          html+='<option value="'+U.escapeHtml(v)+'" '+sel+'>'+U.escapeHtml(U.tv(o))+'</option>';
        });
        /* an older record may hold a value that is no longer in the list (e.g. a
           former free-text position): keep it selectable so saving never wipes it */
        if(val!==undefined && val!==null && val!=='' && !opts.some(o=>String(o.v)===String(val))){
          const tl=U.t(String(val));
          html+='<option value="'+U.escapeHtml(String(val))+'" selected>'+U.escapeHtml(tl&&tl!==String(val)?tl:String(val))+'</option>';
        }
        html+='</select>';
        input=html;
        break;
      }
      case 'photo':
        input=this.photoHTML(f, val);
        break;
      case 'rating':
        input=this.ratingHTML(f, val);
        break;
      case 'store':
      case 'settingsopt':
        input='<select id="'+id+'" name="'+f.key+'" class="store-select"><option value="">'+U.t('selectOne')+'</option></select>';
        break;
      case 'year': {
        const y = U.nowJalaliYear();
        const nums = [1395,1396,1397,1398,1399,1400,1401,1402,1403,1404,1405,1406,1407,1408,1409,1410];
        let html='<select id="'+id+'" name="'+f.key+'"><option value="">'+U.t('selectOne')+'</option>';
        nums.forEach(n=>{
          const v=String(n);
          const sel=String(val)===v?'selected':'';
          html+='<option value="'+v+'" '+sel+'>'+n+'</option>';
        });
        html+='</select>';
        input=html;
        break;
      }
      case 'month': {
        let html='<select id="'+id+'" name="'+f.key+'"><option value="">'+U.t('selectOne')+'</option>';
        for(let i=1;i<=12;i++){
          html+='<option value="'+i+'"'+(String(val)===String(i)?'selected':'')+'>'+(U.monthName(i)+' — '+i)+'</option>';
        }
        html+='</select>';
        input=html;
        break;
      }
      case 'grade': {
        const opts=(window.I18N&&I18N.grades)||[];
        let html='<select id="'+id+'" name="'+f.key+'"><option value="">'+U.t('selectOne')+'</option>';
        opts.forEach(o=>{
          html+='<option value="'+o.v+'"'+(String(val)===o.v?'selected':'')+'>'+U.tv(o)+'</option>';
        });
        html+='</select>';
        input=html;
        break;
      }
      case 'studCounts': {
        /* gender mode (boys / girls / mixed) + both counts + auto total */
        const v=val||{};
        const mode=v.genderMode||'mixed';
        const m=Number(v.maleCount||0), g=Number(v.femaleCount||0);
        const opts=f.options||[];
        let html='<select id="'+id+'" name="genderMode">';
        opts.forEach(o=>{ html+='<option value="'+o.v+'"'+(o.v===mode?' selected':'')+'>'+U.escapeHtml(U.tv(o))+'</option>'; });
        html+='</select>';
        html+='<div class="stud-rows">';
        html+='<div class="field stud-cnt" data-studrow="m"><label for="'+id+'M">'+U.escapeHtml(U.tv(f.maleLabel||''))+'</label>'+
          '<input type="number" id="'+id+'M" name="maleCount" min="0" inputmode="numeric" value="'+(mode==='girls'?0:m)+'"></div>';
        html+='<div class="field stud-cnt" data-studrow="g"><label for="'+id+'G">'+U.escapeHtml(U.tv(f.femaleLabel||''))+'</label>'+
          '<input type="number" id="'+id+'G" name="femaleCount" min="0" inputmode="numeric" value="'+(mode==='boys'?0:g)+'"></div>';
        html+='</div>';
        html+='<div class="stud-total"><span>'+U.t('autoTotal')+'</span><b data-studtotal>'+U.num(m+g)+'</b></div>';
        input=html;
        break;
      }
      default:
        input='<input type="'+(f.type||'text')+'" id="'+id+'" name="'+f.key+'" value="'+U.escapeHtml(val)+'" placeholder="'+U.escapeHtml(U.tv(f.placeholder||''))+'">';
    }
    const span = f.span===2 ? ' fspan2':'';
    return '<div class="field'+span+'" data-field="'+f.key+'">'+label+input+(f.hint?'<div class="hint">'+U.escapeHtml(U.tv(f.hint))+'</div>':'')+'</div>';
  },

  photoHTML(f, val){
    const id='f_'+f.key;
    return '<div class="photo-field" id="'+id+'" data-photo-field="1">'+
      '<div class="photo-preview" id="phprev_'+f.key+'">'+(val?'<img src="'+val+'" alt="">':U.icon('camera'))+'</div>'+
      '<div class="pf-ctrls">'+
        '<input type="file" id="phfile_'+f.key+'" name="'+f.key+'" accept="image/*">'+
        '<button type="button" class="btn btn-soft btn-sm" data-photo-btn="'+f.key+'">'+U.icon('camera')+U.t('chooseFile')+'</button>'+
        (val?'<button type="button" class="btn btn-danger-soft btn-sm" data-photo-rm="'+f.key+'">'+U.icon('trash')+U.t('delete')+'</button>':'')+
      '</div></div>';
  },

  ratingHTML(f, val){
    const id='f_'+f.key;
    const grades=[['good',U.STATUS.rg_good.ps,U.STATUS.rg_good.fa],['mid',U.STATUS.rg_mid.ps,U.STATUS.rg_mid.fa],['bad',U.STATUS.rg_bad.ps,U.STATUS.rg_bad.fa]];
    const lang=U.currentLang();
    let html='<div class="rating-row" id="'+id+'" data-rating="1" name="'+f.key+'">';
    grades.forEach(g=>{
      const sel = val===g[0] ? ' on':'';
      html+='<div class="rating-opt'+sel+'" data-grade="'+g[0]+'" data-val="'+g[0]+'">'+(lang==='fa'?g[2]:g[1])+'</div>';
    });
    html+='</div>';
    return html;
  },

  /* ---------------- form build & collect ---------------- */
  formHTML(fields, values){
    let html='<div class="form-grid">';
    fields.forEach(f=>{ html+=this.fieldHTML(f, f.type==='studCounts' ? values : values[f.key]); });
    html+='</div>';
    return html;
  },

  collectForm(rootEl, fields){
    const out={};
    fields.forEach(f=>{
      if(f.type==='studCounts'){
        const box=rootEl.querySelector('[data-field="'+f.key+'"]');
        if(!box){ out.genderMode=''; out.maleCount=0; out.femaleCount=0; return; }
        const modeEl=box.querySelector('[name="genderMode"]');
        const mi=box.querySelector('[name="maleCount"]');
        const gi=box.querySelector('[name="femaleCount"]');
        const mode=modeEl?modeEl.value:'';
        const m=Number((mi&&mi.value)||0), g=Number((gi&&gi.value)||0);
        out.genderMode=mode;
        out.maleCount = mode==='girls' ? 0 : m;
        out.femaleCount = mode==='boys' ? 0 : g;
        return;
      }
      if(f.type==='msStore' || f.type==='ms'){
        const ms=rootEl.querySelector('[data-ms="'+f.key+'"]');
        out[f.key]= ms ? ms._selected() : [];
        return;
      }
      if(f.type==='photo'){
        const box=rootEl.querySelector('[data-field="'+f.key+'"]');
        out[f.key]= (box && box._getPhoto) ? box._getPhoto() : '';
        return;
      }
      if(f.type==='rating'){
        const r=rootEl.querySelector('[name="'+f.key+'"]');
        const sel=r&&r.querySelector('.rating-opt.on');
        out[f.key]= sel ? sel.dataset.val : '';
        return;
      }
      const el=rootEl.querySelector('[name="'+f.key+'"]');
      if(!el){ out[f.key]=''; return; }
      if(el.type==='number'){ out[f.key]= el.value===''? '' : Number(el.value); return; }
      out[f.key]= el.value;
    });
    return out;
  },

  validate(fields, values){
    const errors=[];
    fields.forEach(f=>{
      if(!f.required) return;
      if(f.type==='studCounts'){
        if(!values.genderMode) errors.push(U.tv(f.label));
        return;
      }
      const v=values[f.key];
      if(v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length)) errors.push(U.tv(f.label));
      if(f.min!==undefined && v!=='' && Number(v)<f.min) errors.push(U.tv(f.label)+' ('+f.min+'+)');
    });
    return errors;
  },

  /* ---------------- multi-select ---------------- */
  multiSelect(container, opts){
    // opts: {key, options:[{id, label, sub?}], selected:[ids], placeholder}
    const sel=new Set(opts.selected||[]);
    const wrap=document.createElement('div');
    wrap.className='ms';
    wrap.dataset.ms=opts.key;
    wrap._selected=()=>[...sel];
    wrap._setValue=(ids)=>{ sel.clear(); (ids||[]).forEach(i=>sel.add(i)); renderChips(); renderList(); renderCount(); };
    const listData=(opts.options||[]).map(o=> typeof o==='object'?o:{id:o, label:o});

    wrap.innerHTML=
      '<div class="ms-control" tabindex="0">'+
        '<span class="ms-chips"></span>'+
        '<span class="ms-placeholder">'+U.escapeHtml(opts.placeholder||U.t('selectMultiple'))+'</span>'+
      '</div>'+
      '<div class="ms-panel">'+
        '<div class="ms-tools">'+
          '<input type="text" class="ms-search" placeholder="'+U.escapeHtml(U.t('searchOptions'))+'">'+
          '<button type="button" class="ms-tb" data-act="all">'+U.t('selectAll')+'</button>'+
          '<button type="button" class="ms-tb" data-act="clear">'+U.t('clearAll')+'</button>'+
        '</div>'+
        '<div class="ms-list"></div>'+
        '<div class="ms-count"></div>'+
      '</div>';

    const chipsEl=wrap.querySelector('.ms-chips');
    const phEl=wrap.querySelector('.ms-placeholder');
    const listEl=wrap.querySelector('.ms-list');
    const countEl=wrap.querySelector('.ms-count');
    const searchEl=wrap.querySelector('.ms-search');

    const findOpt=id=>listData.find(o=>String(o.id)===String(id));

    function renderChips(){
      chipsEl.innerHTML='';
      phEl.style.display= sel.size? 'none':'inline';
      sel.forEach(id=>{
        const o=findOpt(id);
        const chip=document.createElement('span');
        chip.className='ms-chip';
        chip.innerHTML='<span>'+U.escapeHtml(o?o.label:id)+'</span><button type="button" data-rm="'+U.escapeHtml(id)+'" aria-label="'+U.t('delete')+'">'+U.icon('x')+'</button>';
        chip.querySelector('button').addEventListener('click', (e)=>{ e.stopPropagation(); sel.delete(String(id)); renderAll(); });
        chipsEl.appendChild(chip);
      });
    }
    function renderList(filter){
      filter=(filter||'').trim().toLowerCase();
      listEl.innerHTML='';
      listData.forEach(o=>{
        if(filter && !(String(o.label).toLowerCase().includes(filter) || (o.sub||'').toLowerCase().includes(filter))) return;
        const row=document.createElement('div');
        row.className='ms-opt';
        const id=String(o.id);
        row.innerHTML='<input type="checkbox" id="msopt_'+id.replace(/[^a-zA-Z0-9_-]/g,'')+'" '+(sel.has(id)?'checked':'')+'>'+
          '<label for="msopt_'+id.replace(/[^a-zA-Z0-9_-]/g,'')+'">'+U.escapeHtml(o.label)+(o.sub?' <small>— '+U.escapeHtml(o.sub)+'</small>':'')+'</label>';
        row.querySelector('input').addEventListener('change', (e)=>{
          if(e.target.checked) sel.add(id); else sel.delete(id);
          renderAll();
        });
        row.addEventListener('click', (e)=>{
          if(e.target.tagName==='LABEL'||e.target.tagName==='INPUT') return;
          const cb=row.querySelector('input');
          cb.checked=!cb.checked;
          if(cb.checked) sel.add(id); else sel.delete(id);
          renderAll();
        });
        listEl.appendChild(row);
      });
    }
    function renderCount(){
      countEl.textContent= U.t('selectedCount')+': '+sel.size;
    }
    function renderAll(){ renderChips(); renderList(searchEl.value); renderCount(); if(opts.onChange) opts.onChange(wrap._selected()); }

    wrap.querySelector('.ms-control').addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      wrap.classList.toggle('open');
      if(wrap.classList.contains('open')) searchEl.focus();
    });
    wrap.querySelectorAll('.ms-tb').forEach(b=>{
      b.addEventListener('click', ()=>{
        const act=b.dataset.act;
        const filtered = listData.filter(o=> !searchEl.value || String(o.label).toLowerCase().includes(searchEl.value.toLowerCase()));
        if(act==='all') filtered.forEach(o=>sel.add(String(o.id)));
        else filtered.forEach(o=>sel.delete(String(o.id)));
        renderAll();
      });
    });
    searchEl.addEventListener('input', ()=>renderList(searchEl.value));
    document.addEventListener('click', (e)=>{ if(!wrap.contains(e.target)) wrap.classList.remove('open'); });

    wrap._setValue(opts.selected||[]);
    container.appendChild(wrap);
    return wrap;
  },

  /* attach photo handler to a form field container */
  /* wire the studCounts field: show/hide count rows by mode, live total */
  attachStudCounts(rootEl, f){
    const box=rootEl.querySelector('[data-field="'+f.key+'"]');
    if(!box) return;
    const mode=box.querySelector('[name="genderMode"]');
    const rowM=box.querySelector('[data-studrow="m"]');
    const rowG=box.querySelector('[data-studrow="g"]');
    const tot=box.querySelector('[data-studtotal]');
    const apply=()=>{
      const m=mode.value;
      if(rowM) rowM.style.display=(m==='boys'||m==='mixed')?'':'none';
      if(rowG) rowG.style.display=(m==='girls'||m==='mixed')?'':'none';
      const mi=rowM&&rowM.querySelector('input');
      const gi=rowG&&rowG.querySelector('input');
      const n=Number((mi&&mi.value)||0)+Number((gi&&gi.value)||0);
      if(tot) tot.textContent=U.num(n);
    };
    if(mode) mode.addEventListener('change', apply);
    const mi=rowM&&rowM.querySelector('input');
    const gi=rowG&&rowG.querySelector('input');
    if(mi) mi.addEventListener('input', apply);
    if(gi) gi.addEventListener('input', apply);
    apply();
  },

  attachPhoto(rootEl, f, initVal, onDone){
    const box=rootEl.querySelector('[data-field="'+f.key+'"]');
    if(!box) return;
    const pv=box.querySelector('.photo-preview');
    const file=box.querySelector('input[type=file]');
    const btn=box.querySelector('[data-photo-btn]');
    const key=f.key;
    let cur=initVal||'';
    const state={ _value:cur };
    box._photoState=state;
    if(btn) btn.addEventListener('click', ()=>file.click());
    if(pv) pv.addEventListener('click', ()=>file.click());
    const rm=box.querySelector('[data-photo-rm]');
    if(rm) rm.addEventListener('click', ()=>{
      cur=''; state._value='';
      pv.innerHTML=U.icon('camera');
      rm.remove();
      if(onDone) onDone();
    });
    file.addEventListener('change', async ()=>{
      const fileObj=file.files[0];
      if(!fileObj) return;
      try{
        cur = await U.resizeImage(fileObj, f.maxDim||320, 0.82);
        state._value=cur;
        pv.innerHTML='<img src="'+cur+'" alt="">';
        if(!box.querySelector('[data-photo-rm]')){
          const b=document.createElement('button');
          b.type='button'; b.className='btn btn-danger-soft btn-sm';
          b.dataset.photoRm=key;
          b.innerHTML=U.icon('trash')+U.t('delete');
          b.addEventListener('click', ()=>rm && rm.click());
          box.querySelector('.pf-ctrls').appendChild(b);
        }
        if(onDone) onDone();
      }catch(e){ U.toast(U.t('invalidInput'),'error'); }
    });
    // register for collect: add hidden marker
    const marker=document.createElement('span');
    marker.dataset.photoKey=key;
    marker.style.display='none';
    marker._value=cur;
    box.appendChild(marker);
    box._marker=marker;
    box._syncPhoto=()=>{ marker._value=cur; };
    // keep in sync after rm
    const origState = state;
    box._getPhoto=()=>cur;
  },

  /* ---------------- empty state ---------------- */
  emptyState(icon, title, sub, actionHTML){
    return '<div class="empty-state"><div class="es-ico">'+U.icon(icon||'folder')+'</div><h4>'+U.escapeHtml(title||U.t('noData'))+'</h4><p>'+U.escapeHtml(sub||U.t('noDataSub'))+'</p>'+(actionHTML||'')+'</div>';
  },

  /* ---------------- generic table ---------------- */
  tableHTML(cols, rows, actions){
    if(!rows.length) return '';
    let html='<div class="table-wrap"><table class="data"><thead><tr>';
    cols.forEach(c=>{ html+='<th>'+U.escapeHtml(U.tv(c.label))+'</th>'; });
    html+='<th style="text-align:end">'+U.t('actions')+'</th></tr></thead><tbody>';
    rows.forEach((r,i)=>{
      html+='<tr>';
      cols.forEach(c=>{
        const v = c.render ? c.render(r) : (c.cell ? U.escapeHtml(String(c.cell(r)===undefined||c.cell(r)===null?'':c.cell(r))) : U.escapeHtml(U.tv(r[c.key])));
        html+='<td'+(c.cls?' class="'+c.cls+'"':'')+'>'+v+'</td>';
      });
      html+='<td><div class="row-actions">'+(actions?actions(r,i):'')+'</div></td></tr>';
    });
    html+='</tbody></table></div>';
    return html;
  },

  progressHTML(pctVal, cls){
    const p=U.clamp(pctVal,0,100);
    const c = cls || (p>=80?'':(p>=40?'warn':'bad'));
    return '<div class="progress'+(p===100?' progress-lg':'')+'"><div class="bar'+(c?' '+c:'')+'" style="width:'+p+'%"></div></div><div class="progress-labels"><span>'+p+'%</span></div>';
  },

  obsDotsHTML(obs, max){
    max=max||4;
    const arr=Array.isArray(obs)?obs:[];
    let html='<div class="obs-dots">';
    for(let i=1;i<=max;i++){
      const has = arr.some(o=>Number(o.observationNumber)===i);
      html+='<div class="obs-dot'+(has?' done':'')+'" title="'+i+'">'+i+'</div>';
    }
    html+='</div>';
    return html;
  },

  detailKV(pairs, full){
    let html='<dl class="detail-grid">';
    pairs.forEach(p=>{
      if(!p.k && p.k!==0) return;
      const v = (p.v===undefined||p.v===null||p.v==='') ? '—' : (p.html?p.v:U.escapeHtml(U.tv(p.v)));
      const cls = (full||p.full)?' drow full':' drow';
      html+='<div class="'+cls.trim()+'"><dt>'+U.escapeHtml(U.tv(p.k))+'</dt><dd>'+v+'</dd></div>';
    });
    html+='</dl>';
    return html;
  },

  /* name lists for records holding ids */
  namesHTML(ids, byId, sep){
    ids=(ids||[]).map(i=>byId[i]);
    ids=ids.filter(Boolean).map(x=>x.fullName||x.name||'');
    if(!ids.length) return '—';
    return U.escapeHtml(ids.join(sep||', '));
  }
};

window.UI = UI;

/* modules reference UI helpers as U.xxx — bridge onto Utils */
['toast','modal','confirm','alert','fieldHTML','formHTML','collectForm','validate',
 'multiSelect','attachPhoto','attachStudCounts','emptyState','tableHTML','progressHTML','obsDotsHTML',
 'detailKV','namesHTML'].forEach(k=>{ if(Utils) Utils[k]=UI[k].bind(UI); });
})();
