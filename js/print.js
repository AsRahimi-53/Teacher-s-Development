/* =====================================================================
   print.js — PrintDoc: official A4 print documents (RTL).
   Builds structured documents with official header (province /
   district / ministry / section / academic year), meta strip,
   sections with paragraphs/tables/KV blocks, signature areas.
   Supports preview modal + direct printing.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const PrintDoc = {

  async nextSeq(type){
    const id='seq_'+type;
    let c=await DB.get('counters',id);
    if(!c) c={id,n:0};
    c.n++;
    await DB.put('counters',c);
    return c.n;
  },

  seqStr(n){ return String(n).padStart(4,'0'); },

  /* official header */
  head(){
    const o=Settings.officialLines();
    const lang=U.currentLang();
    const logo = o.logo
      ? '<img class="ph-logo" src="'+o.logo+'" alt="">'
      : '<div class="ph-logo-ph">'+(lang==='fa'?'لوگو':'لوګو')+'</div>';
    return '<div class="pdoc-head">'+
      '<div>'+logo+'</div>'+
      '<div class="ph-mid">'+
        '<div class="ph-line1">'+U.escapeHtml(o.line1)+'</div>'+
        (o.line2?'<div class="ph-line2">'+U.escapeHtml(o.line2)+'</div>':'')+
        (o.line3?'<div class="ph-line3">'+U.escapeHtml(o.line3)+'</div>':'')+
        (o.line4?'<div class="ph-line4">'+U.escapeHtml(o.line4)+(o.section?' — '+U.escapeHtml(o.section):'')+'</div>':'')+
      '</div>'+
      '<div class="ph-side">'+
        '<span>'+U.t('academicYear')+'</span><span class="phs-val">'+U.escapeHtml(o.year)+'</span>'+
        '<span>'+U.t('documentDate')+'</span><span class="phs-val">'+U.fmtDate(U.todayISO())+'</span>'+
      '</div>'+
    '</div>';
  },

  meta(items){
    if(!items||!items.length) return '';
    return '<div class="pdoc-meta">'+items.map(i=>'<span><b>'+U.escapeHtml(U.tv(i.k))+'</b>: '+U.escapeHtml(U.tv(i.v))+'</span>').join('')+'</div>';
  },

  title(text, sub){
    return '<div class="pdoc-title">'+U.escapeHtml(text)+(sub?'<span class="pt-sub">'+U.escapeHtml(sub)+'</span>':'')+'</div>';
  },

  /* KV block: pairs [{k,v,full}] */
  kv(pairs){
    let html='<div class="pdoc-kv">';
    (pairs||[]).forEach(p=>{
      const v = p.v===undefined||p.v===null||p.v==='' ? '—' : U.tv(p.v);
      html+='<div class="kv'+(p.full?' full':'')+'"><span class="k">'+U.escapeHtml(U.tv(p.k))+'</span><span class="v">'+U.escapeHtml(v)+'</span></div>';
    });
    html+='</div>';
    return html;
  },

  para(text){ return '<p>'+U.escapeHtml(text)+'</p>'; },
  list(items){
    return '<ul>'+items.map(i=>'<li>'+U.escapeHtml(U.tv(i))+'</li>').join('')+'</ul>';
  },

  /* table: headers [str|{ps,fa}], rows [[cells]] */
  table(headers, rows, opts){
    opts=opts||{};
    let html='<table class="pdoc-table"><thead><tr>';
    (headers||[]).forEach(h=>{ html+='<th>'+U.escapeHtml(U.tv(h))+'</th>'; });
    html+='</tr></thead><tbody>';
    (rows||[]).forEach(r=>{
      html+='<tr>';
      r.forEach((c,ci)=>{
        if(c && typeof c==='object' && c.html){ html+='<td class="'+(c.cls||'')+'">'+c.html+'</td>'; }
        else {
          const isNum = opts.numCols && opts.numCols.includes(ci);
          html+='<td class="'+(isNum?'num':'')+(opts.clsFn?opts.clsFn(ci,c):'')+'">'+U.escapeHtml(U.tv(c))+'</td>';
        }
      });
      html+='</tr>';
    });
    html+='</tbody>';
    if(opts.totals){
      html+='<tfoot><tr>'+opts.totals.map(c=>'<td class="tc">'+U.escapeHtml(U.tv(c))+'</td>').join('')+'</tr></tfoot>';
    }
    html+='</table>';
    return html;
  },

  sigs(names){
    if(!names || names===true) names=[U.t('preparedBy'),U.t('reviewedBy'),U.t('approvedBy')];
    const cls = names.length===2?' cols-2':'';
    return '<div class="pdoc-sigs'+cls+'">'+names.map(n=>
      '<div class="sig"><div class="s-title">'+U.escapeHtml(U.tv(n))+'</div><div class="s-name">'+U.t('signature')+'</div></div>'
    ).join('')+'</div>';
  },

  footer(extra){
    const s=Settings.get();
    const bits=[s.officeAddress, s.officePhone].filter(Boolean);
    return '<div class="pdoc-foot"><span>'+U.t('printDate')+': '+U.fmtDate(U.todayISO())+(extra?(' — '+U.escapeHtml(U.tv(extra))):'')+'</span><span>'+U.escapeHtml(bits.join(' | '))+'</span></div>';
  },

  /* assemble full document */
  build(opts){
    const secHtml=(opts.sections||[]).map((s,i)=>
      '<div class="pdoc-section"><h4>'+(i+1)+'. '+U.escapeHtml(U.tv(s.heading))+'</h4>'+(s.html||'')+'</div>'
    ).join('');
    return '<div class="print-doc">'+
      this.head()+
      (opts.docNo ? this.meta([{k:U.t('documentNumber'), v:opts.docNo}, ...(opts.meta||[])]) : this.meta(opts.meta))+
      this.title(opts.title, opts.sub)+
      secHtml+
      (opts.sigs!==false ? this.sigs(opts.sigs) : '')+
      this.footer(opts.footExtra)+
    '</div>';
  },

  /* preview modal + print */
  preview(docHtml, title){
    const m=UI.modal({
      title: title||U.t('print'),
      icon:'printer',
      size:'xl',
      body:'<div class="pp-actions">'+
        '<button type="button" class="btn btn-primary" data-a="print">'+U.icon('printer')+U.t('print')+'</button>'+
      '</div><div class="print-preview">'+docHtml+'</div>',
      foot:'<button type="button" class="btn btn-outline" data-a="close">'+U.t('close')+'</button>'+
            '<button type="button" class="btn btn-primary" data-a="print2">'+U.icon('printer')+U.t('print')+'</button>'
    });
    const doPrint=()=>this.print(docHtml);
    m.el.querySelectorAll('[data-a^=print]').forEach(b=>b.addEventListener('click', doPrint));
    m.el.querySelector('[data-a=close]').addEventListener('click', ()=>m.close());
  },

  /* render into print root and print */
  print(docHtml){
    document.getElementById('print-root').innerHTML=docHtml;
    window.print();
  },

  /* ---------- generic helpers for modules ---------- */

  /* full official document from any record; used by all modules */
  async officialDoc(o){
    // o: {type:'observation'|'school'|..., title, meta[], sections[], sigs, seqType}
    let docNo='';
    if(o.seqType){
      const n=await this.nextSeq(o.seqType);
      docNo=this.seqStr(n);
    }
    return this.build({
      title:o.title, sub:o.sub,
      meta:o.meta,
      sections:o.sections||[],
      sigs:o.sigs===undefined?true:o.sigs,
      docNo,
      footExtra:o.footExtra
    });
  },

  /* generic "print all" for list modules */
  async printTableDoc(cfg, rows){
    const headers=[...(cfg.tableCols||[]).map(c=>c.label), U.t('actions')?null:null].filter(Boolean);
    const dataRows=rows.map(r=>(cfg.tableCols||[]).map(c=> c.cell? c.cell(r) : (c.render ? '' : U.tv(r[c.key]))));
    const doc=await this.officialDoc({
      seqType:'list_'+cfg.key,
      title: U.t(cfg.titleKey)+' — '+U.t('total'),
      meta:[{k:U.t('records'), v:U.num(rows.length)}, {k:U.t('academicYear'), v:Settings.get().academicYear}],
      sections:[{heading:U.t('summary'), html: this.table(headers, dataRows, {numCols:(cfg.tableCols||[]).map((c,i)=>c.isNum?i:-1).filter(i=>i>=0)})}]
    });
    this.preview(doc, U.t('print'));
  }
};

window.PrintDoc = PrintDoc;
})();
