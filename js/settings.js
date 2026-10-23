/* =====================================================================
   settings.js — global settings (entered ONCE), observation scoring
   configuration (criteria ≤25, quality ranges), school types.
   ===================================================================== */

(function(){
'use strict';

/* developer / contact details shown at the bottom of the settings page */
const DEV={
  name:'عبدالسلام رحيمي',
  email:'salamraihan53@gmail.com',
  whatsapp:'0747844817',
  whatsappUrl:'https://wa.me/93747844817',
  telegram:'t.me/YaraanMedia',
  telegramUrl:'https://t.me/YaraanMedia'
};

const DEFAULT_CRITERIA = [
  {ps:'د درس چمتووالی', fa:'آمادگی درس'},
  {ps:'د زده کړې موخې', fa:'اهداف یادگیری'},
  {ps:'د مضمون په اړه پوهه', fa:'دانش مضمون'},
  {ps:'تشریح', fa:'توضیح'},
  {ps:'د تدریس طریقه', fa:'روش تدریس'},
  {ps:'د زده کوونکو ګډون', fa:'مشارکت دانش‌آموزان'},
  {ps:'پوښتنې', fa:'پرسش'},
  {ps:'د ټولګي مدیریت', fa:'مدیریت کلاس'},
  {ps:'د تدریس مواد', fa:'وسایل تدریس'},
  {ps:'د وخت مدیریت', fa:'مدیریت زمان'},
  {ps:'ارزونه', fa:'ارزشیابی'},
  {ps:'انفرادي ملاتړ', fa:'پشتیبانی فردی'},
  {ps:'اړیکه', fa:'ارتباط'},
  {ps:'د درس پای', fa:'خاتمه درس'},
  {ps:'د کور دنده او پیرو', fa:'تکالیف و پیگیری'},
  {ps:'د ټولګي چاپېریال', fa:'محیط کلاس'},
  {ps:'نظم او انضباط', fa:'نظم و انضباط'},
  {ps:'د تخته کارول', fa:'نوشت‌بار'},
  {ps:'د درس پیل', fa:'آغاز درس'},
  {ps:'د انفرادي توپیرونو پام', fa:'توجه به تفاوت‌ها'},
  {ps:'د رسنیو کارول', fa:'استفاده از رسانه‌ها'},
  {ps:'په وخت رارسېدل', fa:'رعایت وقت'},
  {ps:'د زده کړې تداوم', fa:'پیوستگی درس'},
  {ps:'د زده کوونکو ارزونه', fa:'ارزشیابی دانش‌آموزان'},
  {ps:'د زده کړې پرمختګ', fa:'پیشرفت یادگیری'}
];

const Settings = {
  cache:null,
  _criteriaCache:null,

  defaults(){
    return {
      id:'main',
      province:'',
      district:'',
      directorate:'د پوهنې وزارت',
      directorateFa:'وزارت معارف',
      section:'د ښوونکو د مسلکي پراختیا څانګه',
      sectionFa:'بخش توسعه شغلی معلمان',
      academicYear: Utils.nowJalaliYear(),
      officeAddress:'',
      officePhone:'',
      logo:'',
      language:'ps',
      theme:'light',
      maxObsPerYear:4,
      maxCriteria:25,
      obsMin:0,
      obsMax:4,
      schoolLevels:[L('ابتدایي','ابتدایی'), L('متوسطه','متوسطه'), L('لیسه','دبیرستان')],
      schoolOwnershipTypes:[L('دولتي','دولتی'), L('خصوصي','خصوصی')],
      qualityLevels:[
        {min:0,  max:40, ps:'کمزوری', fa:'ضعیف',   color:'red'},
        {min:41, max:60, ps:'منځنی',  fa:'متوسط', color:'orange'},
        {min:61, max:80, ps:'ښه',     fa:'خوب',    color:'blue'},
        {min:81, max:100,ps:'عالي',   fa:'عالی',   color:'green'}
      ]
    };
  },

  async load(){
    let s = await DB.get('settings','main');
    if(!s) s = this.defaults();
    const d = this.defaults();
    // merge missing keys (forward compatibility)
    Object.keys(d).forEach(k=>{ if(s[k]===undefined) s[k]=d[k]; });
    // ensure the two split school-type lists exist (level + ownership)
    s.schoolLevels = s.schoolLevels || d.schoolLevels;
    s.schoolOwnershipTypes = s.schoolOwnershipTypes || d.schoolOwnershipTypes;
    s.id='main';
    this.cache=s;
    // ensure default criteria exist
    await this.ensureCriteria();
    return s;
  },

  get(){ return this.cache || this.defaults(); },

  async save(patch){
    const cur = this.get();
    Object.keys(patch).forEach(k=>{ cur[k]=patch[k]; });
    this.cache=cur;
    await DB.put('settings',cur);
    this._criteriaCache=null;
    return cur;
  },

  async ensureCriteria(){
    const existing = await DB.getAll('criteria');
    if(existing.length) { this._criteriaCache=existing; return existing; }
    const rows = DEFAULT_CRITERIA.map((c,i)=>({
      id: 'crit_'+i,
      order: i+1,
      ps: c.ps,
      fa: c.fa,
      maxScore: 4,
      enabled: true
    }));
    await DB.bulkPut('criteria',rows);
    this._criteriaCache=rows;
    return rows;
  },

  async criteria(){
    if(this._criteriaCache) return this._criteriaCache;
    const rows = await DB.getAll('criteria');
    this._criteriaCache = Utils.sortBy(rows,'order','asc');
    return this._criteriaCache;
  },
  async saveCriteria(rows){
    await DB.clear('criteria');
    const withOrder = rows.map((r,i)=>({ ...r, order:i+1, id:r.id||Utils.uid() }));
    await DB.bulkPut('criteria',withOrder);
    this._criteriaCache=withOrder;
  },

  activeCriteria(){
    return (this._criteriaCache||[]).filter(c=>c.enabled);
  },
  totalPossible(){
    return this.activeCriteria().reduce((a,c)=>a+Number(c.maxScore||0),0);
  },

  quality(pct){
    const q = this.get().qualityLevels || [];
    pct = Number(pct)||0;
    const hit = q.find(x=>pct>=Number(x.min) && pct<=Number(x.max));
    return hit || q[q.length-1] || {ps:'—',fa:'—',color:'gray'};
  },
  qualityBadge(pct){
    const q=this.quality(pct);
    const cls = {red:'q-kamar',orange:'q-manzil',blue:'q-sha',green:'q-ali'}[q.color]||'b-gray';
    return '<span class="badge '+cls+'"><span class="dot"></span>'+(window.currentLang()==='fa'?(q.fa||q.ps):q.ps)+'</span>';
  },

  /* localized school level types (ابتدایي / متوسطه / لیسه) */
  schoolLevels(){
    return (this.get().schoolLevels||[]).map(st=> typeof st==='string' ? {v:st, ps:st, fa:st} : st);
  },
  /* localized ownership / management types (دولتي / خصوصي) */
  schoolOwnershipTypes(){
    return (this.get().schoolOwnershipTypes||[]).map(st=> typeof st==='string' ? {v:st, ps:st, fa:st} : st);
  },

  /* official header text for print docs */
  officialLines(){
    const s=this.get();
    const lang=window.currentLang();
    return {
      line1: lang==='fa' ? 'امارت اسلامی افغانستان' : 'د افغانستان اسلامي امارت',
      line2: (lang==='fa' ? (s.directorateFa||s.directorate) : (s.directorate||s.directorateFa)) || '',
      line3: (lang==='fa' ? 'استان' : 'ولایت') + (s.province? ' '+s.province : ''),
      line4: (lang==='fa' ? 'ولسوالی' : 'ولسوالۍ') + (s.district? ' '+s.district : ''),
      section: (lang==='fa' ? (s.sectionFa||s.section) : (s.section||s.sectionFa)) || '',
      year: s.academicYear || '',
      logo: s.logo || ''
    };
  }
};

/* =====================================================================
   Settings PAGE — full editor for the once-only global configuration.
   Registered as route 'settings' (from app.js, since this file loads
   before navigation.js defines register()).
   ===================================================================== */
Settings.renderPage = async function(id){
  const U=Utils;
  Nav.setActive('settings');
  Nav.crumb([{label:U.t('navDashboard'),route:'dashboard'},{label:U.t('navSettings')}]);
  const s=this.get();
  const criteria=await this.criteria();
  const cloudOn = !!(window.Cloud && Cloud.enabled());
  /* in cloud mode the account's province+district are authoritative */
  if(cloudOn && window.Cloud.district){
    const cd=Cloud.district;
    if(!s.province && cd.province) s.province=cd.province.name_ps;
    if(!s.district) s.district=cd.name_ps;
  }

  const view=document.getElementById('view');
  const year=U.nowJalaliYear();

  const orgHTML=
    (cloudOn?'<p class="small muted mb-2">'+U.icon('info')+' '+U.t('fromAccountNote')+'</p>':'')+
    '<div class="grid-2">'+
      fld('province',U.t('province'),s.province,cloudOn)+
      fld('district',U.t('district'),s.district,cloudOn)+
      fld('directorate',U.t('directorate')+' — '+U.t('pashto'),s.directorate)+
      fld('directorateFa',U.t('directorate')+' — '+U.t('dari'),s.directorateFa)+
      fld('section',U.t('section')+' — '+U.t('pashto'),s.section)+
      fld('sectionFa',U.t('section')+' — '+U.t('dari'),s.sectionFa)+
      '<div class="field" data-field="academicYear"><label>'+U.t('academicYear')+'</label><select id="f_academicYear" name="academicYear">'+
        Array.from({length:12},(_,i)=>{const y=year-3+i;return '<option value="'+y+'"'+(String(y)===String(s.academicYear)?'selected':'')+'>'+y+'</option>';}).join('')+
      '</select></div>'+
      '<div class="field" data-field="language"><label>'+U.t('language')+'</label><select id="f_language" name="language">'+
        '<option value="ps"'+(s.language==='ps'?'selected':'')+'>پښتو</option>'+
        '<option value="fa"'+(s.language==='fa'?'selected':'')+'>دری</option>'+
      '</select></div>'+
      '<div class="field" data-field="theme"><label>'+U.t('theme')+'</label><select id="f_theme" name="theme">'+
        '<option value="light"'+(s.theme!=='dark'?'selected':'')+'>'+U.t('themeLight')+'</option>'+
        '<option value="dark"'+(s.theme==='dark'?'selected':'')+'>'+U.t('themeDark')+'</option>'+
      '</select></div>'+
      fld('officeAddress',U.t('officeAddress'),s.officeAddress)+
      fld('officePhone',U.t('officePhone'),s.officePhone)+
    '</div>'+
    '<div class="field mb-2" data-field="logo" style="max-width:280px"><label>'+U.t('logo')+'</label>'+
      '<div class="photo-field">'+
        '<div class="photo-preview" id="logoPrev" style="width:84px;height:84px">'+(s.logo?'<img src="'+s.logo+'" alt="">':U.icon('school'))+'</div>'+
        '<div class="pf-ctrls">'+
          '<input type="file" id="logoFile" accept="image/*">'+
          '<button type="button" class="btn btn-soft btn-sm" id="logoPick">'+U.icon('camera')+U.t('chooseFile')+'</button>'+
          (s.logo?'<button type="button" class="btn btn-danger-soft btn-sm" id="logoRm">'+U.icon('trash')+U.t('delete')+'</button>':'')+
        '</div>'+
      '</div>'+
    '</div>';

  /* ---- separate account section (own account + district members) ---- */
  let accountHTML='';
  if(!(window.Cloud && Cloud.configured())){
    accountHTML='<p class="small muted">'+U.icon('info')+' '+U.t('cloudOffNote')+'</p>';
  } else if(!Cloud.enabled()){
    accountHTML=
      '<p class="small muted">'+U.icon('login')+' '+U.t('signInPrompt')+'</p>'+
      '<button type="button" class="btn btn-primary btn-sm" id="acctSignIn">'+U.icon('login')+' '+U.t('authLogin')+'</button>';
  } else {
    const p=Cloud.profile, d=Cloud.district;
    let members=[];
    try{ members=await Cloud.districtMembers(); }catch(e){}
    const max=Cloud.maxAccounts();
    const roleBadge=r=>'<span class="badge '+(r==='super'?'b-teal':'b-gray')+'">'+(r==='super'?U.t('superBadge'):U.t('memberBadge'))+'</span>';
    accountHTML=
      '<div class="grid-2">'+
        '<div class="field"><label>'+U.t('fullName')+'</label><input value="'+U.escapeHtml(p.full_name)+'" disabled></div>'+
        '<div class="field"><label>'+U.t('email')+'</label><input value="'+U.escapeHtml(p.email)+'" dir="ltr" disabled></div>'+
        '<div class="field"><label>'+U.t('phone')+'</label><input value="'+U.escapeHtml(p.phone)+'" dir="ltr" disabled></div>'+
        '<div class="field"><label>'+U.t('role')+'</label><input value="'+(p.role==='super'?U.t('superBadge'):U.t('memberBadge'))+'" disabled></div>'+
        '<div class="field"><label>'+U.t('province')+'</label><input value="'+U.escapeHtml(Cloud.provinceName())+'" disabled></div>'+
        '<div class="field"><label>'+U.t('district')+'</label><input value="'+U.escapeHtml(Cloud.districtName())+'" disabled></div>'+
        '<div class="field"><label>'+U.t('creditLimit')+'</label><input value="'+(d?U.num(d.credit_limit)+' '+U.t('afghani'):'—')+'" disabled></div>'+
        '<div class="field"><label>'+U.t('restrictions')+'</label><input value="'+U.escapeHtml(d?d.restrictions:'')+'" placeholder="—" disabled></div>'+
      '</div>'+
      '<div class="flex mt-2 mb-1"><b>'+U.t('districtMembers')+'</b> <span class="count-chip"><b>'+U.num(members.length)+'</b> / '+U.num(max)+'</span></div>'+
      '<div class="table-wrap"><table class="data"><thead><tr>'+
        '<th>'+U.t('fullName')+'</th><th>'+U.t('phone')+'</th><th>'+U.t('email')+'</th><th>'+U.t('role')+'</th>'+
      '</tr></thead><tbody>'+
      (members.length?members.map(mm=>
        '<tr><td><b>'+U.escapeHtml(mm.full_name)+'</b></td><td dir="ltr">'+U.escapeHtml(mm.phone||'—')+'</td><td dir="ltr">'+U.escapeHtml(mm.email||'—')+'</td><td>'+roleBadge(mm.role)+'</td></tr>'
      ).join(''):'<tr><td colspan="4" class="muted">'+U.t('noData')+'</td></tr>')+
      '</tbody></table></div>';
  }

  const scoringHTML=
    '<div class="grid-3">'+
      numFld('maxObsPerYear',U.t('maxObsPerYear'),s.maxObsPerYear)+
      numFld('obsMin',U.t('obsMin'),s.obsMin)+
      numFld('obsMax',U.t('obsMax'),s.obsMax)+
      numFld('maxCriteria',U.t('maxCriteria'),s.maxCriteria)+
    '</div>';

    const Q_COLORS=[['red',L('سور','قرمز')],['orange',L('نارنجي','نارنجی')],['blue',L('شین','آبی')],['green',L('زرغون','سبز')],['gray',L('رمادي','خاکستری')]];
  const Q_CLS={red:'q-kamar',orange:'q-manzil',blue:'q-sha',green:'q-ali',gray:'b-gray'};
  const Q_SWATCH={red:'var(--danger)',orange:'var(--warning)',blue:'var(--info)',green:'var(--success)',gray:'#9aa7b4'};
  function qualRowHTML(q,i){
    const label=U.currentLang()==='fa'?(q.fa||q.ps):(q.ps||'—');
    return '<tr data-qi="'+i+'">'+
      '<td class="tc" data-label=""><span class="q-idx">'+(i+1)+'</span></td>'+
      '<td data-label="'+U.t('scoreRange')+'"><div class="q-range">'+
        '<input type="number" class="q-input" data-q="min" value="'+(q.min||0)+'" min="0" max="100" aria-label="'+U.t('minScore')+'">'+
        '<span class="q-dash">—</span>'+
        '<input type="number" class="q-input" data-q="max" value="'+(q.max||0)+'" min="0" max="100" aria-label="'+U.t('maxScore')+'">'+
      '</div></td>'+
      '<td data-label="'+U.t('pashto')+'"><input type="text" class="q-input q-grow" data-q="ps" value="'+U.escapeHtml(q.ps||'')+'" aria-label="'+U.t('pashto')+'"></td>'+
      '<td data-label="'+U.t('dari')+'"><input type="text" class="q-input q-grow" data-q="fa" value="'+U.escapeHtml(q.fa||'')+'" aria-label="'+U.t('dari')+'"></td>'+
      '<td data-label="'+U.t('color')+'"><div class="q-color"><span class="swatch" style="background:'+(Q_SWATCH[q.color]||'#9aa7b4')+'"></span>'+
        '<select data-q="color">'+Q_COLORS.map(x=>'<option value="'+x[0]+'"'+(q.color===x[0]?'selected':'')+'>'+U.tv(x[1])+'</option>').join('')+'</select></div></td>'+
      '<td class="tc" data-label=""><span class="badge '+(Q_CLS[q.color]||'b-gray')+'" data-qbadge><span class="dot"></span>'+U.escapeHtml(label)+'</span></td>'+
    '</tr>';
  }
  let qualRows=(s.qualityLevels||[]).map(qualRowHTML).join('');

  const qualityHTML=
    '<div class="qual-wrap"><table class="data qual-table"><thead><tr>'+
      '<th></th><th>'+U.t('scoreRange')+'</th><th>'+U.t('pashto')+'</th><th>'+U.t('dari')+'</th><th>'+U.t('color')+'</th><th class="tc">'+U.t('sample')+'</th>'+
    '</tr></thead><tbody id="qualBody">'+qualRows+'</tbody></table></div>';

  function critRows(list){
    return list.map((c,i)=>
      '<tr data-ci="'+i+'">'+
        '<td class="tc c-idx" data-label="">'+(i+1)+'</td>'+
        '<td data-label="'+U.t('pashto')+'"><input type="text" data-c="ps" value="'+U.escapeHtml(c.ps||'')+'" class="c-in"></td>'+
        '<td data-label="'+U.t('dari')+'"><input type="text" data-c="fa" value="'+U.escapeHtml(c.fa||'')+'" class="c-in"></td>'+
        '<td data-label="'+U.t('maxScore')+'"><input type="number" data-c="maxScore" value="'+(c.maxScore||0)+'" min="'+s.obsMin+'" max="10" class="c-num"></td>'+
        '<td data-label=""><label class="chk"><input type="checkbox" data-c="enabled"'+(c.enabled?' checked':'')+'>'+U.t('enabled')+'</label></td>'+
        '<td class="tc c-act" data-label="">'+
          '<button type="button" class="icon-btn sm" data-cact="up" title="↑">'+U.icon('arrowUp')+'</button>'+
          '<button type="button" class="icon-btn sm" data-cact="down" title="↓">'+U.icon('arrowDown')+'</button>'+
          '<button type="button" class="icon-btn sm danger" data-cact="del" title="'+U.t('deleteCriterion')+'">'+U.icon('trash')+'</button>'+
        '</td>'+
      '</tr>').join('');
  }

  function typeRows(list, attr){
    return list.map((t,i)=>
      '<tr data-'+attr+'i="'+i+'">'+
        '<td class="type-cell" data-label="'+U.t('pashto')+'"><input type="text" data-'+attr+'="ps" value="'+U.escapeHtml(typeof t==='string'?t:(t.ps||''))+'" class="type-input"></td>'+
        '<td class="type-cell" data-label="'+U.t('dari')+'"><input type="text" data-'+attr+'="fa" value="'+U.escapeHtml(typeof t==='string'?t:(t.fa||''))+'" class="type-input"></td>'+
        '<td class="tc" data-label="" style="width:52px"><button type="button" class="icon-btn sm danger" data-'+attr+'act="del" title="'+U.t('removeType')+'">'+U.icon('trash')+'</button></td>'+
      '</tr>').join('');
  }

  view.innerHTML=
    '<div class="page-head view-fade">'+
      '<div class="ph-icon">'+U.icon('settings')+'</div>'+
      '<div><h1>'+U.t('navSettings')+'</h1><div class="ph-sub">'+U.t('generalSettings')+'</div></div>'+
      '<div class="ph-actions"><button class="btn btn-primary" id="stSaveAll">'+U.icon('check')+U.t('saveAll')+'</button></div>'+
    '</div>'+
    '<div class="settings-grid">'+
    '<div class="card mb-3"><div class="card-head"><h3>'+U.t('setOrg')+'</h3></div><div class="card-body" id="stOrg">'+orgHTML+'</div></div>'+
    '<div class="card mb-3"><div class="card-head"><h3>'+U.icon('user')+' '+U.t('setAccount')+'</h3></div><div class="card-body">'+accountHTML+'</div></div>'+
    '<div class="card mb-3"><div class="card-head"><h3>'+U.t('setScoring')+'</h3></div><div class="card-body">'+scoringHTML+'</div></div>'+
    '<div class="card mb-3"><div class="card-head"><h3>'+U.t('setQuality')+'</h3></div><div class="card-body">'+qualityHTML+'</div></div>'+
    '<div class="card mb-3 span-all"><div class="card-head"><h3>'+U.t('setCriteria')+' <span class="muted small" id="critCount"></span></h3>'+
      '<button class="btn btn-soft btn-sm" id="critAdd">'+U.icon('plus')+U.t('addCriterion')+'</button></div>'+
      '<div class="card-body" style="overflow:auto"><table class="data crit-table"><thead><tr><th>'+U.t('orderNo')+'</th><th>'+U.t('pashto')+'</th><th>'+U.t('dari')+'</th><th>'+U.t('maxScore')+'</th><th></th><th></th></tr></thead><tbody id="critBody"></tbody></table>'+
      '<div class="mt-2 small muted" id="critTotal"></div></div></div>'+
    '<div class="card mb-3 span-all"><div class="card-head"><h3>'+U.t('setSchoolTypes')+'</h3></div>'+
      '<div class="card-body types-cols">'+
        '<div class="mb-3"><div class="flex mb-1" style="align-items:center"><b>'+U.t('schoolLevelTitle')+'</b>'+
          '<button class="btn btn-soft btn-sm" id="levelAdd" style="margin-inline-start:auto">'+U.icon('plus')+U.t('addLevel')+'</button></div>'+
          '<table class="data type-table"><thead><tr><th>'+U.t('pashto')+'</th><th>'+U.t('dari')+'</th><th></th></tr></thead><tbody id="levelBody"></tbody></table></div>'+
        '<div><div class="flex mb-1" style="align-items:center"><b>'+U.t('ownershipTitle')+'</b>'+
          '<button class="btn btn-soft btn-sm" id="ownAdd" style="margin-inline-start:auto">'+U.icon('plus')+U.t('addOwn')+'</button></div>'+
          '<table class="data type-table"><thead><tr><th>'+U.t('pashto')+'</th><th>'+U.t('dari')+'</th><th></th></tr></thead><tbody id="ownBody"></tbody></table></div>'+
      '</div></div>'+
    '<div class="card mb-3 span-all dev-card"><div class="card-head"><h3>'+U.icon('user')+' '+U.t('aboutDeveloper')+'</h3></div>'+
      '<div class="card-body">'+
        '<div class="dev-name">'+U.escapeHtml(DEV.name)+'<span>'+U.t('developerRole')+'</span></div>'+
        '<div class="dev-links">'+
          '<a class="dev-link" href="mailto:'+DEV.email+'">'+U.icon('mail')+'<span><small>'+U.t('email')+'</small><b dir="ltr">'+DEV.email+'</b></span></a>'+
          '<a class="dev-link" href="'+DEV.whatsappUrl+'" target="_blank" rel="noopener">'+U.icon('message')+'<span><small>WhatsApp</small><b dir="ltr">'+DEV.whatsapp+'</b></span></a>'+
          '<a class="dev-link" href="'+DEV.telegramUrl+'" target="_blank" rel="noopener">'+U.icon('globe')+'<span><small>Telegram</small><b dir="ltr">'+DEV.telegram+'</b></span></a>'+
        '</div>'+
      '</div></div>'+
    '</div>';

  /* ---- account section: sign-in shortcut ---- */
  const acctBtn=document.getElementById('acctSignIn');
  if(acctBtn) acctBtn.addEventListener('click', ()=>{ if(window.Auth) Auth.show(); });

  /* ---- logo picker ---- */
  let logoVal=s.logo||'';
  const logoPrev=document.getElementById('logoPrev');
  const logoFile=document.getElementById('logoFile');
  document.getElementById('logoPick').addEventListener('click',()=>logoFile.click());
  logoPrev.addEventListener('click',()=>logoFile.click());
  const logoRm=document.getElementById('logoRm');
  if(logoRm) logoRm.addEventListener('click',()=>{ logoVal=''; logoPrev.innerHTML=U.icon('school'); });
  logoFile.addEventListener('change', async ()=>{
    const f=logoFile.files[0]; if(!f) return;
    logoVal=await U.resizeImage(f,256,0.85);
    logoPrev.innerHTML='<img src="'+logoVal+'" alt="">';
  });

  /* ---- criteria state ---- */
  let crits=criteria.map(c=>({...c}));
  const critBody=document.getElementById('critBody');
  const critTotal=document.getElementById('critTotal');
  const critCount=document.getElementById('critCount');
  function renderCrit(){
    critBody.innerHTML=critRows(crits);
    const total=crits.filter(c=>c.enabled).reduce((a,c)=>a+Number(c.maxScore||0),0);
    critTotal.innerHTML=U.t('totalScore')+': <b>'+U.num(total)+'</b> / 100';
    critCount.textContent='('+crits.length+' / '+s.maxCriteria+')';
    critBody.querySelectorAll('[data-cact]').forEach(b=>b.addEventListener('click',()=>{
      const i=+b.closest('tr').dataset.ci; const act=b.dataset.cact;
      if(act==='del'){ crits.splice(i,1); renderCrit(); }
      if(act==='up'&&i>0){ [crits[i-1],crits[i]]=[crits[i],crits[i-1]]; renderCrit(); }
      if(act==='down'&&i<crits.length-1){ [crits[i+1],crits[i]]=[crits[i],crits[i+1]]; renderCrit(); }
    }));
    critBody.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
      const i=+inp.closest('tr').dataset.ci; const k=inp.dataset.c;
      if(k==='enabled') crits[i].enabled=inp.checked;
      else if(k==='maxScore') crits[i].maxScore=Number(inp.value);
      else crits[i][k]=inp.value;
      if(k==='enabled'||k==='maxScore'){ const total=crits.filter(c=>c.enabled).reduce((a,c)=>a+Number(c.maxScore||0),0); critTotal.innerHTML=U.t('totalScore')+': <b>'+U.num(total)+'</b> / 100'; }
    }));
  }
  renderCrit();
  document.getElementById('critAdd').addEventListener('click',()=>{
    if(crits.length>=s.maxCriteria){ U.toast(U.t('criteriaHint'),'error'); return; }
    crits.push({id:U.uid(),ps:'',fa:'',maxScore:s.obsMax,enabled:true}); renderCrit();
  });

  /* ---- split school-type lists state (level + ownership) ---- */
  const levels=(s.schoolLevels||[]).map(t=>typeof t==='string'?{ps:t,fa:t}:({...t}));
  const owns=(s.schoolOwnershipTypes||[]).map(t=>typeof t==='string'?{ps:t,fa:t}:({...t}));
  function bindTypeTable(body, list, attr){
    body.innerHTML=typeRows(list, attr);
    body.querySelectorAll('[data-'+attr+'act="del"]').forEach(b=>b.addEventListener('click',()=>{
      list.splice(+b.closest('tr').dataset[attr+'i'],1); renderAllTypes();
    }));
    body.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
      const i=+inp.closest('tr').dataset[attr+'i']; list[i][inp.dataset[attr]]=inp.value;
    }));
  }
  const levelBody=document.getElementById('levelBody');
  const ownBody=document.getElementById('ownBody');
  function renderAllTypes(){ bindTypeTable(levelBody,levels,'lv'); bindTypeTable(ownBody,owns,'ow'); }
  renderAllTypes();
  document.getElementById('levelAdd').addEventListener('click',()=>{ levels.push({ps:'',fa:''}); renderAllTypes(); });
  document.getElementById('ownAdd').addEventListener('click',()=>{ owns.push({ps:'',fa:''}); renderAllTypes(); });

  /* ---- quality rows live edit ---- */
  const qualBody=document.getElementById('qualBody');
  function refreshQualRow(tr){
    const i=+tr.dataset.qi; const q=s.qualityLevels[i];
    const sw=tr.querySelector('.swatch'); if(sw) sw.style.background=(Q_SWATCH[q.color]||'#9aa7b4');
    const bd=tr.querySelector('[data-qbadge]');
    if(bd){ const label=U.currentLang()==='fa'?(q.fa||q.ps):(q.ps||''); bd.className='badge '+(Q_CLS[q.color]||'b-gray'); bd.setAttribute('data-qbadge',''); bd.innerHTML='<span class="dot"></span>'+U.escapeHtml(label||'—'); }
  }
  qualBody.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{
    const tr=el.closest('tr');
    const i=+tr.dataset.qi; const k=el.dataset.q;
    const v=(k==='min'||k==='max')?Number(el.value):el.value;
    s.qualityLevels[i][k]=v;
    refreshQualRow(tr);
  }));

  /* ---- save all ---- */
  document.getElementById('stSaveAll').addEventListener('click', async ()=>{
    const vals=collectOrg();
    vals.qualityLevels=s.qualityLevels;
    await this.save(vals);
    await this.saveCriteria(crits);
    /* apply theme + language immediately */
    applyTheme(vals.theme||'light');
    if(vals.language && vals.language!==U.currentLang()){
      U.setLang(vals.language);
      Nav.langButtons && Nav.langButtons();
    }
    Nav.applyBrand();
    U.toast(U.t('saved'),'success');
  });

  function collectOrg(){
    const g=n=>{ const el=document.getElementById('f_'+n); return el?el.value:''; };
    return {
      province:g('province'), district:g('district'),
      directorate:g('directorate'), directorateFa:g('directorateFa'),
      section:g('section'), sectionFa:g('sectionFa'),
      academicYear:Number(g('academicYear'))||s.academicYear,
      officeAddress:g('officeAddress'), officePhone:g('officePhone'),
      language:g('language')||s.language, theme:g('theme')||s.theme,
      maxObsPerYear:Number(g('maxObsPerYear'))||0,
      obsMin:Number(g('obsMin'))||0, obsMax:Number(g('obsMax'))||0,
      maxCriteria:Number(g('maxCriteria'))||25,
      logo:logoVal,
      schoolLevels:levels.map(t=>L(t.ps,t.fa)),
      schoolOwnershipTypes:owns.map(t=>L(t.ps,t.fa))
    };
  }
  function applyTheme(t){ try{ document.documentElement.setAttribute('data-theme',t); }catch(e){} }
  applyTheme(s.theme||'light');
};

function fld(name,label,val,readOnly){
  return '<div class="field" data-field="'+name+'"><label>'+label+'</label>'+
    '<input type="text" id="f_'+name+'" name="'+name+'" value="'+(Utils.escapeHtml(val||''))+'"'+(readOnly?' readonly class="readonly-field" title="'+(Utils.t('fromAccount'))+'"':'')+'></div>';
}
function numFld(name,label,val){
  return '<div class="field" data-field="'+name+'"><label>'+label+'</label>'+
    '<input type="number" id="f_'+name+'" name="'+name+'" value="'+(val===undefined?'':val)+'"></div>';
}

window.Settings = Settings;
})();
 
