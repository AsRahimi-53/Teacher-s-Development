/* =====================================================================
   jalali.js — Jalali (Solar Hijri / هجري شمسي) date entry.
   ALL user-facing date entry is a TYPED Jalali date  yyyy/mm/dd
   (e.g. ۱۴۰۵/۰۷/۲۶) — there is no calendar popup and the native Gregorian
   <input type=date> is never shown. Internally dates stay ISO Gregorian
   (yyyy-mm-dd) so storage, sorting, sync and reports are untouched.
   Conversion math: vendored jalaali-js (lib/jalaali.js, Borkowski, MIT).
   Every <input type="date"> that appears in the page (also dynamically,
   inside modals or re-rendered panels) is upgraded automatically.
   ===================================================================== */

(function(){
'use strict';

const J = window.JalaaliLib;

function lang(){ return (typeof Utils!=='undefined') ? Utils.currentLang() : 'ps'; }
const PDIG='۰۱۲۳۴۵۶۷۸۹';
function loc(n){ return String(n).replace(/[0-9]/g, d=>PDIG[d]); }
/* Persian ۰-۹ and Arabic-Indic ٠-٩ digits → Latin */
function latin(s){
  return String(s||'')
    .replace(/[۰-۹]/g, d=>String(d.charCodeAt(0)-0x06F0))
    .replace(/[٠-٩]/g, d=>String(d.charCodeAt(0)-0x0660));
}

const MONTH_NAMES={
  ps:['وری','غویی','غبرګولی','چنګاښ','زمری','وږی','تله','لړم','لیندۍ','مرغومی','سلواغه','کب'],
  fa:['حمل','ثور','جوزا','سرطان','اسد','سنبله','میزان','عقرب','قوس','جدی','دلو','حوت']
};
const WEEKDAYS={
  ps:['شنبه','یکشنبه','دوشنبه','درېشنبه','څلورشنبه','پنجشنبه','جمعه'],
  fa:['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']
};
function MONTHS(l){ return MONTH_NAMES[(l||lang())==='fa'?'fa':'ps']; }

/* ---------- conversions ---------- */
function isoToParts(iso){
  if(!iso) return null;
  const m=String(iso).slice(0,10).split('-').map(Number);
  if(m.length<3||!m[0]||m[0]<100) return null;
  const d=new Date(Date.UTC(m[0],m[1]-1,m[2]));
  if(isNaN(d)) return null;
  return J.toJalaali(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
}
function jalToISO(jy,jm,jd){
  const g=J.toGregorian(jy,jm,jd);
  return g.gy+'-'+String(g.gm).padStart(2,'0')+'-'+String(g.gd).padStart(2,'0');
}
function jMonthLen(jy,jm){ return J.jalaaliMonthLength(jy,jm); }
function firstWeekday(jy,jm){
  const g=J.toGregorian(jy,jm,1);
  const js=new Date(Date.UTC(g.gy,g.gm-1,g.gd)).getUTCDay(); // 0=Sun
  return (js+1)%7; // Saturday-first: Sat=0 ... Fri=6
}
/* ISO → «۱۴۰۵/۰۷/۲۶» (what is shown inside the input) */
function fmtNum(iso){
  const j=isoToParts(iso);
  if(!j) return '';
  return loc(j.jy)+'/'+loc(String(j.jm).padStart(2,'0'))+'/'+loc(String(j.jd).padStart(2,'0'));
}
/* ISO → «۲۶ تله ۱۴۰۵» */
function fmtJal(iso){
  const j=isoToParts(iso);
  if(!j) return '';
  return loc(j.jd)+' '+MONTHS()[j.jm-1]+' '+loc(j.jy);
}
const JY_MIN=1300, JY_MAX=1500;
/* validate a Jalali y/m/d triple → ISO or '' */
function triToISO(y,m,d){
  y=Number(y); m=Number(m); d=Number(d);
  if(!y||!m||!d) return '';
  if(y<JY_MIN||y>JY_MAX||m<1||m>12||d<1||d>jMonthLen(y,m)) return '';
  return jalToISO(y,m,d);
}

/* =====================================================================
   Typed-input mask
   Accepts Persian / Arabic / Latin digits and the separators / - . or space.
   • digits only:   14050726 → ۱۴۰۵/۰۷/۲۶ (slashes are added automatically)
   • a month digit 2-9 or a day digit 4-9 is zero-padded by itself
   ===================================================================== */
function maskText(raw, adding){
  let s=latin(raw).replace(/[\-\.\s،]/g,'/').replace(/[^0-9\/]/g,'');
  let segs=s.split('/');
  segs=segs.filter((x,i)=>x!=='' || i===segs.length-1);        // drop empty middle parts ('//')
  let y=segs[0]||'', m=segs.length>1?segs[1]:null, d=segs.length>2?segs[2]:null;
  /* over-long segments spill into the next one (digits typed without slashes) */
  if(y.length>4){ m=y.slice(4)+(m||''); y=y.slice(0,4); }
  if(m!==null && m.length>2){ d=m.slice(2)+(d||''); m=m.slice(0,2); }
  if(d!==null) d=d.slice(0,2);
  if(adding){                                                  // never while deleting
    if(m!==null && m.length===1 && /[2-9]/.test(m)){ m='0'+m; if(d===null) d=''; }
    if(d!==null && d.length===1 && /[4-9]/.test(d)) d='0'+d;
    if(m===null && y.length===4) m='';
    if(m!==null && m.length===2 && d===null) d='';
  }
  let out=y;
  if(m!==null) out+='/'+m;
  if(d!==null) out+='/'+d;
  return out;
}
function parseTyped(text){
  const segs=latin(text).split('/').filter(x=>x!=='');
  if(segs.length!==3) return '';
  if(segs[0].length!==4) return '';
  return triToISO(segs[0],segs[1],segs[2]);
}

/* ---------- widget ---------- */
function setErr(wrap,on){
  wrap.classList.toggle('jd-bad',!!on);
  let e=wrap.querySelector('.jd-err');
  if(on){
    if(!e){ e=document.createElement('div'); e.className='jd-err'; wrap.appendChild(e); }
    e.textContent=(typeof Utils!=='undefined')?Utils.t('invalidDate'):'';
  } else if(e) e.remove();
}

function upgradeOne(inp){
  if(!inp || inp.dataset.jal==='1' || !inp.matches || !inp.matches('input[type=date]')) return;
  inp.dataset.jal='1';
  const U=(typeof Utils!=='undefined')?Utils:null;
  const wrap=document.createElement('div');
  wrap.className='jd'+(inp.classList && inp.classList.contains('flt')?' flt':'');
  const disp=document.createElement('input');
  disp.type='text';
  disp.className='jd-input';
  disp.setAttribute('inputmode','numeric');
  disp.setAttribute('autocomplete','off');
  disp.setAttribute('dir','ltr');
  disp.setAttribute('maxlength','10');
  disp.setAttribute('enterkeyhint','next');
  if(inp.title) disp.title=inp.title;
  const example=fmtNum(U?U.todayISO():'')||'۱۴۰۵/۰۱/۱۵';
  disp.placeholder=example;
  disp.setAttribute('aria-label',(inp.getAttribute('aria-label')||inp.title||(U?U.t('date'):'date'))+' ('+example+')');

  const btn=document.createElement('button');
  btn.type='button';
  btn.className='jd-today';
  btn.textContent=U?U.t('today'):'today';
  btn.tabIndex=-1;

  /* the ORIGINAL element stays in the DOM as a hidden field: its id, name,
     classes, data-* attributes and every listener bound to it keep working,
     and its .value is always the ISO (Gregorian) date */
  const valDesc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  const initial=inp.value||'';
  inp.parentNode.insertBefore(wrap,inp);
  wrap.appendChild(disp);
  wrap.appendChild(btn);
  wrap.appendChild(inp);
  inp.type='hidden';
  valDesc.set.call(inp,initial);
  disp.value=fmtNum(initial);

  /* programmatic changes (form reset, defaults…) refresh the visible text */
  Object.defineProperty(inp,'value',{
    configurable:true,
    get(){ return valDesc.get.call(inp); },
    set(v){ valDesc.set.call(inp,v); disp.value=fmtNum(v); setErr(wrap,false); }
  });

  function commit(iso){
    const old=valDesc.get.call(inp);
    if(old===iso) return;
    valDesc.set.call(inp,iso);
    try{
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      inp.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){}
  }

  disp.addEventListener('input',(ev)=>{
    const before=disp.value;
    const adding=!(ev && ev.inputType && /^delete/.test(ev.inputType));
    const atEnd=(disp.selectionStart===before.length);
    const caretDigits=latin(before.slice(0,disp.selectionStart||0)).replace(/[^0-9]/g,'').length;
    const masked=maskText(before,adding);
    const shown=loc(masked);
    if(shown!==before){
      disp.value=shown;
      let pos=shown.length;
      if(!atEnd){                                   // keep the caret after the same number of digits
        pos=0; let seen=0;
        while(pos<shown.length && seen<caretDigits){ if(/[0-9۰-۹]/.test(shown[pos])) seen++; pos++; }
      }
      try{ disp.setSelectionRange(pos,pos); }catch(e){}
    }
    const iso=parseTyped(masked);
    commit(iso);
    const parts=masked.split('/');
    setErr(wrap, parts.length===3 && parts[0].length===4 && parts[2].length===2 && !iso);
  });
  disp.addEventListener('blur',()=>{
    /* tidy "1405/7/5" → 1405/07/05 */
    const segs=latin(disp.value).split('/').filter(x=>x!=='');
    if(segs.length===3 && segs[0].length===4){
      const iso=triToISO(segs[0],segs[1],segs[2]);
      if(iso){ disp.value=fmtNum(iso); commit(iso); setErr(wrap,false); return; }
    }
    setErr(wrap, disp.value.trim()!=='' && !valDesc.get.call(inp));
  });
  btn.addEventListener('click',()=>{
    const iso=(U?U.todayISO():'');
    disp.value=fmtNum(iso); commit(iso); setErr(wrap,false);
  });
}

function upgradeAll(root){
  let list=[];
  try{
    const scope=root||document;
    list= scope.querySelectorAll ? Array.from(scope.querySelectorAll('input[type="date"]')) : [];
    if(scope.matches && scope.matches('input[type="date"]')) list.push(scope);
  }catch(e){ return; }
  list.forEach(upgradeOne);
}

/* upgrade inputs that are added later (modals, re-rendered panels, report scope…) */
function watch(){
  upgradeAll(document);
  const mo=new MutationObserver(muts=>{
    for(const m of muts){
      m.addedNodes && m.addedNodes.forEach(n=>{
        if(n.nodeType!==1) return;
        if(n.matches && n.matches('input[type="date"]')) upgradeOne(n);
        else if(n.querySelectorAll) n.querySelectorAll('input[type="date"]').forEach(upgradeOne);
      });
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
}

window.Jalali={
  isoToParts, jalToISO, fmtJal, fmtNum, jMonthLen, firstWeekday, triToISO, parseTyped, maskText,
  MONTHS, WEEKDAYS,
  todayISO(){ return (typeof Utils!=='undefined')?Utils.todayISO():''; },
  upgrade(root){ upgradeAll(root); },
  closePopup(){ /* no popup any more — kept for backward compatibility */ }
};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watch); else watch();
})();
