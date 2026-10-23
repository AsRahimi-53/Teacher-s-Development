/* =====================================================================
   export.js — Excel (.xlsx) export via bundled SheetJS (offline).
   RTL worksheet direction, frozen header row, autofilters, column
   widths, merged title, localized (Pashto/Dari) headings & values,
   numeric totals, Jalali dates.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const ExcelExport = {

  _lang(){ return U.currentLang(); },

  _cell(v){
    if(v===undefined||v===null) return '';
    if(typeof v==='object'){ return U.tv(v); }
    return v;
  },

  _ws(aoa, opts){
    opts=opts||{};
    if(!window.XLSX) throw new Error('xlsx lib missing');
    const ws=XLSX.utils.aoa_to_sheet(aoa.length?aoa:[['']]);
    const maxCols=Math.max(1,...aoa.map(r=>r.length));
    const widths=(opts.widths&&opts.widths.length) ? opts.widths : (aoa[0]||[]).map(h=>({wch:Math.max(12,String(h).length*1.6+4)}));
    ws['!cols']=widths.slice(0,maxCols);
    /* a merge of a single cell makes Excel offer to "repair" the file */
    if(opts.merges) ws['!merges']=opts.merges.filter(m=>m.e.c>m.s.c || m.e.r>m.s.r);
    const hr=Math.max(0,Math.min(aoa.length-1, opts.headerRow||0));
    const ref=XLSX.utils.encode_range({s:{r:hr,c:0},e:{r:Math.max(hr,aoa.length-1),c:maxCols-1}});
    if(opts.filter!==false && opts.headerRow!==undefined && aoa.length>hr+1) ws['!autofilter']={ref};
    ws['!views']=[{ rightToLeft:true, state:'frozen', ySplit:opts.freezeRows||1, topLeftCell:'A'+((opts.freezeRows||1)+1) }];
    return ws;
  },

  _docRows(cfg, rows){
    const cols = cfg.exportCols || cfg.tableCols;
    return rows.map(r=>cols.map(c=>{
      if(c.cell) return this._cell(c.cell(r));
      if(c.key) return this._cell(U.tv(r[c.key]));
      return '';
    }));
  },

  _headers(cfg){
    const cols = cfg.exportCols || cfg.tableCols;
    return cols.map(c=>U.tv(c.label));
  },

  _titleBlock(title, extra){
    const s=Settings.get();
    const lang=this._lang();
    const line1 = lang==='fa' ? 'امارت اسلامی افغانستان' : 'د افغانستان اسلامي امارت';
    const line2 = (lang==='fa' ? (s.directorateFa||s.directorate) : (s.directorate||s.directorateFa))||'';
    const out=[
      [line1],
      [line2],
      [((lang==='fa'?'استان':'ولایت')+(s.province?' '+s.province:''))+' — '+((lang==='fa'?'ولسوالی':'ولسوالۍ')+(s.district?' '+s.district:''))],
      [title],
      [(lang==='fa'?'تاریخ':'نېټه')+': '+U.fmtDate(U.todayISO())+'   |   '+U.t('academicYear')+': '+(s.academicYear||'')]
    ];
    (extra||[]).forEach(e=>out.push([e]));
    return out;
  },

  exportList(cfg, rows, opts){
    opts=opts||{};
    if(!window.XLSX){ U.toast('xlsx library missing','error'); return; }
    const headers=this._headers(cfg);
    const data=this._docRows(cfg,rows);
    const widths=headers.map((h,i)=>{
      const longest=Math.max(String(h).length, ...data.map(r=>String(r[i]===undefined?'':r[i]).length));
      return {wch:Math.min(48,Math.max(12,longest*1.25+4))};
    });
    const aoa=[];
    const tb=this._titleBlock(opts.title||U.t(cfg.titleKey), opts.extraTitle);
    aoa.push(...tb);
    aoa.push([]);
    const headerRow=aoa.length;
    aoa.push(headers);
    aoa.push(...data);
    if(cfg.exportTotals){
      const tot=cfg.exportTotals(rows);
      if(tot){ aoa.push([]); aoa.push(tot); }
    }
    if(opts.summary){
      aoa.push([]);
      aoa.push([U.t('summary')]);
      aoa.push(...opts.summary);
    }
    const lc=this._lastCol(headers);
    const ws=this._ws(aoa,{
      widths,
      headerRow,
      freezeRows:headerRow+1,
      merges:[ {s:{r:0,c:0},e:{r:0,c:lc}}, {s:{r:1,c:0},e:{r:1,c:lc}}, {s:{r:3,c:0},e:{r:3,c:lc}} ],
      filter:true
    });
    const wb=this._newWb();
    XLSX.utils.book_append_sheet(wb, ws, this._sheetName(opts.sheetName||U.t(cfg.titleKey)));
    this._save(wb, this._fname(opts.file||opts.filename||cfg.key));
  },

  /* Excel sheet names: max 31 chars, none of  : \ / ? * [ ] */
  _sheetName(s){ return String(s||'Sheet').replace(/[:\\\/?*\[\]]/g,'-').slice(0,28).replace(/[\s—–-]+$/,'')||'Sheet'; },

  _safeName(s){ return String(s).replace(/[\\/:*?"<>|]/g,'-'); },

  /* Jalali date stamp with LATIN digits: 1405-07-26 */
  _stamp(){
    const j=U.jalParts(new Date());
    return j ? (j.jy+'-'+String(j.jm).padStart(2,'0')+'-'+String(j.jd).padStart(2,'0')) : U.todayISO();
  },
  /* ASCII-only slug: non-Latin file names are replaced by "download" by several
     browsers / WebViews (the file then has no .xlsx extension and cannot be opened) */
  _slug(s){
    const x=String(s||'').replace(/\.xlsx$/i,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
    return x||'export';
  },
  /* file name: tdp_teachers_1405-07-26.xlsx */
  _fname(slug){
    return 'tdp_'+this._slug(slug)+'_'+this._stamp()+'.xlsx';
  },

  /* a new workbook that opens right-to-left in Excel */
  _newWb(){
    const wb=XLSX.utils.book_new();
    wb.Workbook={Views:[{RTL:true}]};
    return wb;
  },

  _save(wb, filename){
    try{
      XLSX.writeFile(wb, filename, {compression:true});
      U.toast(U.t('export')+' — OK','success');
    }catch(e){
      console.error('[export]',e);
      U.toast(U.t('export')+' — '+(e&&e.message?e.message:'error'),'error');
    }
  },

  _lastCol(headers){ return Math.max(0,(headers?headers.length:1)-1); },

  /* multi-sheet workbook */
  exportWorkbook(filename, sheets){
    if(!window.XLSX){ U.toast('xlsx library missing','error'); return; }
    const wb=this._newWb();
    const used={};
    sheets.forEach(sh=>{
      const ws=this._ws(sh.aoa, sh.opts||{});
      let name=this._sheetName(sh.name||'Sheet');
      let n=name, i=2; while(used[n.toLowerCase()]){ n=name.slice(0,25)+' '+i++; }
      used[n.toLowerCase()]=1;
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    this._save(wb, this._fname(filename));
  },

  /* simple table → xlsx (for statistics / reports) */
  exportTable(title, headers, rows, opts){
    opts=opts||{};
    if(!window.XLSX){ U.toast('xlsx library missing','error'); return; }
    const aoa=[];
    const tb=this._titleBlock(title, opts.extraTitle);
    aoa.push(...tb); aoa.push([]);
    const headerRow=aoa.length;
    aoa.push(headers);
    aoa.push(...rows);
    if(opts.totals){ aoa.push([]); aoa.push(opts.totals); }
    const lc=this._lastCol(headers);
    const ws=this._ws(aoa,{
      widths:headers.map((h,i)=>{
        const longest=Math.max(String(h).length, ...rows.map(r=>String(r[i]===undefined?'':r[i]).length));
        return {wch:Math.min(48,Math.max(12,longest*1.25+4))};
      }),
      headerRow,
      freezeRows:headerRow+1,
      merges:[ {s:{r:0,c:0},e:{r:0,c:lc}}, {s:{r:1,c:0},e:{r:1,c:lc}}, {s:{r:3,c:0},e:{r:3,c:lc}} ]
    });
    const wb=this._newWb();
    XLSX.utils.book_append_sheet(wb, ws, this._sheetName(title));
    this._save(wb, this._fname(opts.file||'table'));
  }
};

window.ExcelExport = ExcelExport;
})();
