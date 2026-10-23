/* =====================================================================
   utils.js — shared helpers: icons, i18n, dates (Jalali), numbers,
   images, misc. No dependencies. Loaded first.
   ===================================================================== */

(function(){
'use strict';

/* ---------------- language ---------------- */
function currentLang(){ return (window.AppLang) || 'ps'; }
function setLang(l){
  window.AppLang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = 'rtl';
  if(window.document.title && window.App.__titleSetByUser === false){}
}

/* L(ps,fa) — bilingual cell/value */
function L(ps, fa){ return {ps:ps, fa:(fa===undefined?ps:fa)}; }
/* pick value for current language */
function tv(v){
  if(v===null || v===undefined || v==='') return '';
  if(typeof v==='object' && (v.ps!==undefined || v.fa!==undefined))
    return v[currentLang()] || v.ps || v.fa || '';
  return String(v);
}

/* ---------------- i18n t() ---------------- */
function t(key){
  const dict = (window.I18N && I18N.t) || {};
  const d = dict[key];
  if(!d) return key;
  return d[currentLang()] || d.ps || d.fa || key;
}
function tParams(key, params){
  let s = t(key);
  if(params) Object.keys(params).forEach(k=>{ s = s.replace('{'+k+'}', params[k]); });
  return s;
}

/* ---------------- icons (feather-style, stroke) ---------------- */
const ICONS = {
  search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit:'<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  printer:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  checkSquare:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userPlus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  school:'<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/><path d="M9.5 11h.01M14.5 11h.01"/>',
  briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  gradcap:'<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5"/>',
  chart:'<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/><line x1="2" y1="20" x2="22" y2="20"/>',
  pie:'<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  calendarCheck:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>',
  activity:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  clipboard:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  clipboardCheck:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail:'<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  mapPin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  map:'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  award:'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trend:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  filter:'<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  arrowLeft:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowRight:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  arrowUp:'<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  arrowDown:'<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  chevLeft:'<polyline points="15 18 9 12 15 6"/>',
  chevRight:'<polyline points="9 18 15 12 9 6"/>',
  refresh:'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  login:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  chevronLeft:'<polyline points="15 18 9 12 15 6"/>',
  chevronRight:'<polyline points="9 18 15 12 9 6"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  building:'<rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/>',
  hash:'<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  menu:'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  globe:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  move:'<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  male:'<circle cx="10" cy="14" r="6"/><line x1="14.5" y1="9.5" x2="21" y2="3"/><polyline points="15 3 21 3 21 9"/>',
  female:'<circle cx="12" cy="9" r="6"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/>',
  bookClosed:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  hourglass:'<path d="M6 2h12M6 22h12M8 2v4l4 4 4-4V2M8 22v-4l4-4 4 4v4"/>',
  userCheck:'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  targetObs:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
};

function icon(name, cls){
  return '<svg'+(cls?' class="'+cls+'"':'')+' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||'')+'</svg>';
}

/* ---------------- ids / misc ---------------- */
function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,6);
}
function escapeHtml(s){
  if(s===null || s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function clamp(n,min,max){ n=Number(n)||0; return Math.max(min,Math.min(max,n)); }
function sum(arr, f){ return arr.reduce((a,x)=>a+(f?f(x):x),0); }
function pct(part,total){ if(!total) return 0; return Math.round(part/total*1000)/10; }
function initials(name){
  if(!name) return '?';
  const p = String(name).trim().split(/\s+/);
  return p.length>1 ? p[0][0]+p[1][0] : String(name).slice(0,2);
}
function sortBy(arr, key, dir){
  const d = dir==='desc' ? -1 : 1;
  return arr.slice().sort((a,b)=>{
    const va=a[key], vb=b[key];
    if(va===vb) return 0;
    if(va===undefined||va===null) return 1;
    if(vb===undefined||vb===null) return -1;
    return (va>vb?1:-1)*d;
  });
}
function groupBy(arr, key){
  const m={};
  arr.forEach(x=>{ const k=key(x); (m[k]=m[k]||[]).push(x); });
  return m;
}
function unique(arr){ return arr.filter((x,i)=>arr.indexOf(x)===i); }
function debounce(fn,ms){ let h; return function(){ clearTimeout(h); const a=arguments,c=this; h=setTimeout(()=>fn.apply(c,a),ms||250); }; }
function titleCase(s){ return s ? s.replace(/(^|\s)\S/g, c=>c.toUpperCase()) : ''; }

/* ---------------- numbers ---------------- */
function num(n){
  if(n===null||n===undefined||n==='') return '—';
  n=Number(n);
  if(isNaN(n)) return '—';
  /* deterministic Persian digits + grouping (the browser's ps-AF locale data is
     missing on many phones and silently falls back to Latin digits) */
  return n.toLocaleString('en-US',{maximumFractionDigits:2}).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]).replace(/,/g,'٬').replace(/\./g,'٫');
}
function numW(n){ return (n===null||n===undefined||n==='') ? '—' : Number(n).toLocaleString('en-US'); }
function toLocDigits(str){
  if(str===null||str===undefined) return '';
  const map='۰۱۲۳۴۵۶۷۸۹';
  return String(str).replace(/[0-9]/g, d=>map[d]);
}

/* ---------------- dates ---------------- */
function todayISO(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parseISO(iso){
  if(!iso) return null;
  if(typeof iso==='number') return new Date(iso);
  const s=String(iso);
  const d = s.length===10 ? new Date(s+'T12:00:00') : new Date(s);
  return isNaN(d)?null:d;
}
/* =====================================================================
   Jalali (Solar Hijri) dates — computed with the vendored jalaali-js
   library, NOT with Intl: the browser's "ps-AF-u-ca-persian" locale data is
   missing on most devices and silently returns GREGORIAN dates. Dates are
   stored internally as ISO Gregorian (yyyy-mm-dd) but are NEVER shown that way.
   ===================================================================== */
const JAL_MONTHS={
  ps:['وری','غویی','غبرګولی','چنګاښ','زمری','وږی','تله','لړم','لیندۍ','مرغومی','سلواغه','کب'],
  fa:['حمل','ثور','جوزا','سرطان','اسد','سنبله','میزان','عقرب','قوس','جدی','دلو','حوت']
};
function pDigits(v){ return String(v).replace(/[0-9]/g, d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }
/* ISO / timestamp / Date  →  {jy,jm,jd} (Jalali) or null */
function jalParts(iso){
  const d = (iso instanceof Date) ? iso : parseISO(iso);
  if(!d || isNaN(d)) return null;
  const J = window.JalaaliLib;
  if(!J) return null;
  return J.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate());
}
/* e.g. «۲۶ تله ۱۴۰۵» */
function fmtDate(iso, style){
  if(!iso) return '';
  const j=jalParts(iso);
  if(!j) return '';                     // never fall back to a Gregorian string
  const names = JAL_MONTHS[currentLang()==='fa'?'fa':'ps'];
  return pDigits(j.jd)+' '+names[j.jm-1]+' '+pDigits(j.jy);
}
/* numeric form  ۱۴۰۵/۰۷/۲۶  */
function fmtDateNum(iso){
  if(!iso) return '';
  const j=jalParts(iso);
  if(!j) return '';
  return pDigits(j.jy)+'/'+pDigits(String(j.jm).padStart(2,'0'))+'/'+pDigits(String(j.jd).padStart(2,'0'));
}
function monthName(m, lang){
  lang = lang || currentLang();
  /* Jalali month names — Pashto: traditional names; Dari: standard zodiac names */
  return JAL_MONTHS[lang==='fa'?'fa':'ps'][Number(m)-1] || '';
}
/* current Jalali month (1-12) / year — data is stored with Jalali academic
   years, so month numbers everywhere are Jalali months */
function nowJalaliMonth(){ const j=jalParts(new Date()); return j?j.jm:1; }
function nowJalaliYear(){ const j=jalParts(new Date()); return j?String(j.jy):'1405'; }
function isSameDay(iso, ref){
  if(!iso) return false;
  const d=parseISO(iso), r=ref?parseISO(ref):new Date();
  return d&&r&&d.toDateString()===r.toDateString();
}
function isOverdue(iso){
  if(!iso) return false;
  const d=parseISO(iso);
  if(!d) return false;
  const t=new Date(); t.setHours(23,59,59,999);
  return d < t;
}
function isUpcoming(iso, days){
  if(!iso) return false;
  const d=parseISO(iso); if(!d) return false;
  const t=new Date(); t.setHours(0,0,0,0);
  const end=new Date(t); end.setDate(end.getDate()+(days||7));
  return d>=t && d<=end;
}
function daysDiff(iso){
  const d=parseISO(iso); if(!d) return 0;
  const t=new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.round((d-t)/86400000);
}
function fmtAge(dob){
  const d=parseISO(dob); if(!d) return '';
  const now=new Date();
  let a=now.getFullYear()-d.getFullYear();
  const m=now.getMonth()-d.getMonth();
  if(m<0 || (m===0 && now.getDate()<d.getDate())) a--;
  return a>=0 ? a : '';
}

/* ---------------- files / images ---------------- */
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}
/* compress + resize image → dataURL (jpeg) */
function resizeImage(file, maxDim, quality){
  maxDim = maxDim || 320; quality = quality || 0.82;
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let w=img.width, h=img.height;
      if(w>h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; }
      else if(h>=w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      resolve(cv.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src=url;
  });
}
function downloadDataUrl(filename, dataUrl){
  const a=document.createElement('a');
  a.href=dataUrl; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>a.remove(),400);
}
function downloadBlob(filename, blob){
  const url=URL.createObjectURL(blob);
  downloadDataUrl(filename,url);
  setTimeout(()=>URL.revokeObjectURL(url),8000);
}
function downloadText(filename, text, mime){
  downloadBlob(filename, new Blob([text],{type:mime||'application/octet-stream'}));
}

/* ---------------- small renderers ---------------- */
function avatarHTML(rec, size){
  const s = size||44;
  const photo = rec && (rec.photo||rec.logo);
  if(photo) return '<img class="'+(size>50?'cell-photo-lg':'cell-photo')+'" style="width:'+s+'px;height:'+s+'px" src="'+photo+'" alt="">';
  return '<div class="member-card" style="display:none"></div><div class="mc-avatar" style="width:'+s+'px;height:'+s+'px;min-width:'+s+'px;font-size:'+Math.round(s*0.38)+'px">'+escapeHtml(initials(rec?(rec.fullName||rec.name):''))+'</div>';
}

/* status badge map (key → {ps,fa,cls}) */
const STATUS = {
  m_active:{ps:'فعال',fa:'فعال',cls:'b-green'},
  m_inactive:{ps:'غیر فعال',fa:'غیرفعال',cls:'b-red'},
  m_leave:{ps:'رخصت',fa:'مرخصی',cls:'b-orange'},
  m_other:{ps:'نور',fa:'سایر',cls:'b-gray'},
  s_active:{ps:'فعال',fa:'فعال',cls:'b-green'},
  s_inactive:{ps:'غیر فعال',fa:'غیرفعال',cls:'b-red'},
  s_temp:{ps:'موقتي بند',fa:'موقتاً بسته',cls:'b-orange'},
  s_other:{ps:'نور',fa:'سایر',cls:'b-gray'},
  g_boys:{ps:'هلکانو',fa:'پسرانه',cls:'b-blue'},
  g_girls:{ps:'نجونو',fa:'دخترانه',cls:'b-purple'},
  pg_boys:{ps:'نارینه',fa:'مرد',cls:'b-blue'},          /* gender of a PERSON */
  pg_girls:{ps:'ښځینه',fa:'زن',cls:'b-purple'},
  g_mixed:{ps:'ګډ',fa:'مختلط',cls:'b-teal'},
  e_active:{ps:'فعال',fa:'فعال',cls:'b-green'},
  e_inactive:{ps:'غیر فعال',fa:'غیرفعال',cls:'b-red'},
  e_leave:{ps:'رخصت',fa:'مرخصی',cls:'b-orange'},
  e_resigned:{ps:'استعفا',fa:'استعفا',cls:'b-red'},
  e_other:{ps:'نور',fa:'سایر',cls:'b-gray'},
  p_planned:{ps:'پلان شوی',fa:'برنامه‌ریزی شده',cls:'b-blue'},
  p_inprogress:{ps:'د اجرا په حال کې',fa:'در حال اجرا',cls:'b-teal'},
  p_done:{ps:'بشپړ شوی',fa:'انجام شده',cls:'b-green'},
  p_delayed:{ps:'ځنډېدلی',fa:'تأخیر یافته',cls:'b-orange'},
  p_cancelled:{ps:'لغوه شوی',fa:'لغو شده',cls:'b-gray'},
  mp_planned:{ps:'پلان شوی',fa:'برنامه‌ریزی شده',cls:'b-blue'},
  mp_inprogress:{ps:'روان',fa:'در حال انجام',cls:'b-teal'},
  mp_done:{ps:'بشپړ شوی',fa:'انجام شده',cls:'b-green'},
  mp_delayed:{ps:'ځنډېدلی',fa:'تأخیر یافته',cls:'b-orange'},
  mp_cancelled:{ps:'لغوه شوی',fa:'لغو شده',cls:'b-gray'},
  d_open:{ps:'پرانیستې',fa:'باز',cls:'b-blue'},
  d_progress:{ps:'روان',fa:'در حال انجام',cls:'b-teal'},
  d_done:{ps:'بشپړه',fa:'انجام شده',cls:'b-green'},
  d_delayed:{ps:'ځنډېدلې',fa:'تأخیری',cls:'b-orange'},
  d_cancelled:{ps:'لغوه شوې',fa:'لغوشده',cls:'b-gray'},
  a_planned:{ps:'پلان شوې',fa:'برنامه‌ریزی شده',cls:'b-blue'},
  a_done:{ps:'بشپړه',fa:'انجام شده',cls:'b-green'},
  a_delayed:{ps:'ځنډېدلې',fa:'تأخیری',cls:'b-orange'},
  a_cancelled:{ps:'لغوه شوې',fa:'لغوشده',cls:'b-gray'},
  mng_planned:{ps:'پلان شوې',fa:'برنامه‌ریزی شده',cls:'b-blue'},
  mng_done:{ps:'بشپړه',fa:'انجام شده',cls:'b-green'},
  mng_follow:{ps:'تر تعقیب لاندې',fa:'در پیگیری',cls:'b-orange'},
  t_filled:{ps:'ډک شوی',fa:'تأمین شده',cls:'b-green'},
  t_partial:{ps:'جزوي ډک شوی',fa:'جزئی',cls:'b-orange'},
  t_vacant:{ps:'خالي',fa:'خالی',cls:'b-red'},
  pr_high:{ps:'لوړ',fa:'بالا',cls:'b-red'},
  pr_medium:{ps:'منځنی',fa:'متوسط',cls:'b-orange'},
  pr_low:{ps:'ټیټ',fa:'پایین',cls:'b-gray'},
  rg_good:{ps:'ښه',fa:'خوب',cls:'b-green'},
  rg_mid:{ps:'منځنی',fa:'متوسط',cls:'b-orange'},
  rg_bad:{ps:'کمزوری',fa:'ضعیف',cls:'b-red'},
  rg_none:{ps:'—',fa:'—',cls:'b-gray'},
  lc_planned:{ps:'پلان شوې',fa:'برنامه‌ریزی شده',cls:'b-blue'},
  lc_active:{ps:'روان',fa:'در حال انجام',cls:'b-teal'},
  lc_done:{ps:'بشپړه شوه',fa:'انجام شده',cls:'b-green'},
  q_low:{ps:'کمزوری',fa:'ضعیف',cls:'q-kamar'},
  q_mid:{ps:'منځنی',fa:'متوسط',cls:'q-manzil'},
  q_good:{ps:'ښه',fa:'خوب',cls:'q-sha'},
  q_high:{ps:'عالي',fa:'عالی',cls:'q-ali'}
};
function badge(key){
  const s=STATUS[key];
  if(!s) return key? '<span class="badge b-gray">'+escapeHtml(key)+'</span>' : '';
  return '<span class="badge '+s.cls+'"><span class="dot"></span>'+s[currentLang()]+'</span>';
}
function statusLabel(key){
  const s=STATUS[key];
  return s ? s[currentLang()] : (key||'');
}

window.Utils = {
  currentLang, setLang, L, tv, t, tParams, jalParts, pDigits,
  icon, ICONS, uid, escapeHtml, clamp, sum, pct, initials,
  sortBy, groupBy, unique, debounce,
  num, numW, toLocDigits,
  todayISO, parseISO, fmtDate, fmtDateNum, monthName, nowJalaliMonth, nowJalaliYear,
  isSameDay, isOverdue, isUpcoming, daysDiff, fmtAge,
  fileToDataUrl, resizeImage, downloadDataUrl, downloadBlob, downloadText,
  avatarHTML, STATUS, badge, statusLabel
};

/* also expose as globals for convenience */
window.L = L; window.tv = tv; window.t = t; window.tParams = tParams;
window.icon = icon; window.uid = uid; window.esc = escapeHtml;
window.num = num; window.fmtDate = fmtDate; window.fmtDateNum = fmtDateNum;
window.todayISO = todayISO; window.badge = badge; window.statusLabel = statusLabel;
window.currentLang = currentLang; window.monthName = monthName;
window.parseISO = parseISO; window.pct = pct; window.sum = sum;

})();
