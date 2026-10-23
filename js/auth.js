/* =====================================================================
   auth.js — cloud-mode account screen (sign in / register).
   Registration ALWAYS requires province (ولایت) + district (ولسوالۍ).
   Only provinces/districts registered by the super admin are offered.
   Exception: the very first account (nothing registered yet) may enter
   free text — its rows are created automatically.
   Every account is auto-added to the district's scientific members
   list (علمي غړي) after sign-in.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

let root=null;

const Auth = {
  /* opts.tab     — 'login' | 'register' (default: register on the very first launch of a device)
     opts.closable — true when opened from inside the (offline) app: shows a close button */
  show(opts){
    opts=opts||{};
    this._closable=!!opts.closable;
    if(!root){
      root=document.createElement('div');
      root.id='auth-root';
      document.body.appendChild(root);
    }
    root.hidden=false;
    document.body.classList.add('auth-open');
    const app=document.getElementById('app');
    if(app) app.style.visibility='hidden';
    this.render(opts.tab || (window.Cloud && Cloud.hasAccountOnDevice() ? 'login' : 'register'));
  },

  hide(){
    if(root) root.hidden=true;
    document.body.classList.remove('auth-open');
    const app=document.getElementById('app');
    if(app) app.style.visibility='';
  },

  errKey(message){
    if(!message) return null;
    if(message.indexOf('DISTRICT_NOT_REGISTERED')>=0 || message.indexOf('PROVINCE_NOT_REGISTERED')>=0) return 'districtNotRegistered';
    if(message.indexOf('DISTRICT_FULL')>=0) return 'districtFull';
    if(message.indexOf('DISTRICT_INACTIVE')>=0 || message.indexOf('PROVINCE_INACTIVE')>=0) return 'districtInactive';
    if(message.indexOf('already registered')>=0 || message.indexOf('already in use')>=0) return 'emailTaken';
    if(message.indexOf('Invalid login')>=0 || message.indexOf('invalid credentials')>=0) return 'wrongCreds';
    if(message.indexOf('PROFILE_MISSING')>=0) return 'profileMissing';
    if(message.indexOf('MISSING_FIELDS')>=0) return 'fillRequired';
    if(message.indexOf('NOT_AUTHENTICATED')>=0) return 'wrongCreds';
    if(message.indexOf('Failed to fetch')>=0 || message.indexOf('NetworkError')>=0) return 'offline';
    return null;
  },

  showErr(err, fallbackKey){
    const k=this.errKey(err && err.message);
    if(k) U.toast(U.t(k),'error');
    else U.toast((err && (err.message||err))||U.t(fallbackKey),'error');
  },

  /* ---------------- render ---------------- */
  render(tab){
    const s=Settings.get();
    const logo=s.logo ? '<img src="'+s.logo+'" alt="">' : U.icon('bookClosed');
    const fa=U.currentLang()==='fa';
    const hasAcct=!!(window.Cloud && Cloud.hasAccountOnDevice());
    const distHtml = (tab==='register') ?
      '<div class="field"><label>'+U.t('province')+' <span class="req">*</span></label>'+
        '<select id="auProvince" class="auth-inp"><option value="">'+U.t('selectProvince')+'</option></select>'+
      '</div>'+
      '<div class="field"><label>'+U.t('district')+' <span class="req">*</span></label>'+
        '<select id="auDistrict" class="auth-inp" disabled><option value="">'+U.t('selectDistrict')+'</option></select>'+
      '</div>'+
      '<div class="auth-note" id="auListNote" hidden></div>'
      : '';
    root.innerHTML=
      '<div class="auth-wrap">'+
        '<div class="auth-brand">'+
          '<div class="auth-logo">'+logo+'</div>'+
          '<h1>'+U.t('appName')+'</h1>'+
          '<div class="auth-sub">'+U.t('authSub')+'</div>'+
        '</div>'+
        '<div class="auth-card">'+
          '<div class="auth-tabs">'+
            '<button type="button" class="auth-tab'+(tab==='login'?' on':'')+'" data-autab="login">'+U.t('authLogin')+'</button>'+
            '<button type="button" class="auth-tab'+(tab==='register'?' on':'')+'" data-autab="register">'+U.t('authRegister')+'</button>'+
          '</div>'+
          (tab==='login' ? this.loginForm() : this.registerForm(distHtml)) +
        '</div>'+
        '<div class="auth-offline">'+
          '<div class="auth-or"><span>'+U.t('authOr')+'</span></div>'+
          '<button type="button" class="btn btn-outline btn-block auth-off-btn'+(hasAcct?'':' is-locked')+'" data-auoffline>'+U.icon('database')+' '+U.t('authOffline')+'</button>'+
          '<div class="auth-off-note small muted">'+U.t(hasAcct?'authOfflineHas':'authOfflineFirst')+'</div>'+
        '</div>'+
        '<div class="auth-foot small muted">'+U.t('authNote')+'</div>'+
        (this._closable?'<button type="button" class="btn btn-outline btn-sm auth-close" data-auclose>'+U.icon('x')+' '+U.t('close')+'</button>':'')+
      '</div>';
    root.querySelectorAll('[data-autab]').forEach(b=>{
      b.addEventListener('click', ()=>this.render(b.dataset.autab));
    });
    /* offline use: only after an account was created on this device once */
    root.querySelector('[data-auoffline]').addEventListener('click', ()=>this.offlineUse(tab));
    const closeBtn=root.querySelector('[data-auclose]');
    if(closeBtn) closeBtn.addEventListener('click', ()=>this.hide());
    /* Enter / "Go" on the phone keyboard submits the form */
    root.querySelectorAll('.auth-inp').forEach(inp=>{
      inp.addEventListener('keydown', e=>{
        if(e.key!=='Enter' || inp.tagName==='SELECT') return;
        e.preventDefault();
        if(tab==='login') this.doLogin(); else this.doRegister();
      });
    });
    if(tab==='login'){
      root.querySelector('[data-aulogin]').addEventListener('click', ()=>this.doLogin());
    } else {
      root.querySelector('[data-aureg]').addEventListener('click', ()=>this.doRegister());
      const prov=root.querySelector('#auProvince');
      prov.addEventListener('change', ()=>this.loadDistrictsFiltered(prov.value));
      this.loadPicker();
    }
  },

  loginForm(){
    return '<form class="auth-form" onsubmit="return false">'+
      '<div class="field"><label>'+U.t('email')+' <span class="req">*</span></label>'+
        '<input type="email" id="auEmailL" class="auth-inp" dir="ltr" placeholder="name@example.com" autocomplete="username" inputmode="email" autocapitalize="none" enterkeyhint="next"></div>'+
      '<div class="field"><label>'+U.t('password')+' <span class="req">*</span></label>'+
        '<input type="password" id="auPassL" class="auth-inp" dir="ltr" autocomplete="current-password" enterkeyhint="go"></div>'+
      '<button type="button" class="btn btn-primary btn-block" data-aulogin>'+U.icon('login')+' '+U.t('authLogin')+'</button>'+
    '</form>';
  },

  registerForm(distHtml){
    return '<form class="auth-form" onsubmit="return false">'+
      '<div class="field"><label>'+U.t('fullName')+' <span class="req">*</span></label>'+
        '<input type="text" id="auName" class="auth-inp"></div>'+
      '<div class="field"><label>'+U.t('phone')+'</label>'+
        '<input type="tel" id="auPhone" class="auth-inp" dir="ltr"></div>'+
      '<div class="field"><label>'+U.t('email')+' <span class="req">*</span></label>'+
        '<input type="email" id="auEmailR" class="auth-inp" dir="ltr" placeholder="name@example.com" autocomplete="email" inputmode="email" autocapitalize="none"></div>'+
      '<div class="field"><label>'+U.t('password')+' <span class="req">*</span></label>'+
        '<input type="password" id="auPassR" class="auth-inp" dir="ltr" autocomplete="new-password" minlength="6"></div>'+
      distHtml+
      '<button type="button" class="btn btn-primary btn-block" data-aureg>'+U.icon('userPlus')+' '+U.t('authRegister')+'</button>'+
    '</form>';
  },

  /* ---------- registration picker: REGISTERED provinces/districts only.
     Province + district are ALWAYS selects — no free text. If the super
     admin has registered nothing yet, the selects stay empty and an
     explanation is shown. */
  setListNote(key){
    const note=document.getElementById('auListNote');
    if(!note) return;
    if(key){ note.hidden=false; note.innerHTML=U.icon('info')+' '+U.t(key); }
    else { note.hidden=true; note.innerHTML=''; }
  },

  async loadPicker(){
    let provinces=[];
    try{ provinces=await Cloud.provincesList(); }catch(e){}
    const provSel=document.getElementById('auProvince');
    if(!provSel) return;
    const fa=U.currentLang()==='fa';
    provSel.innerHTML='<option value="">'+U.t('selectProvince')+'</option>'+
      provinces.map(p=>'<option value="'+U.escapeHtml(p.name_ps)+'">'+
        U.escapeHtml(fa?(p.name_fa||p.name_ps):p.name_ps)+'</option>').join('');
    if(!provinces.length) this.setListNote('noProvinceRegistered');
    else this.setListNote();
    await this.loadDistrictsFiltered('');
  },

  async loadDistrictsFiltered(provPs){
    let districts=[];
    try{ districts=await Cloud.districtOptions(); }catch(e){}
    const distSel=document.getElementById('auDistrict');
    if(!distSel) return;
    const fa=U.currentLang()==='fa';
    /* the district list stays locked until a province is chosen (and only that
       province's registered districts are offered) */
    if(!provPs){
      distSel.disabled=true;
      distSel.innerHTML='<option value="">'+U.t('selectDistrict')+'</option>';
      return;
    }
    const list=districts.filter(d=>d.province && d.province.name_ps===provPs);
    if(!list.length){
      distSel.disabled=true;
      distSel.innerHTML='<option value="">'+U.t('selectDistrict')+'</option>';
      this.setListNote('noDistrictInProvince');
      return;
    }
    distSel.disabled=false;
    this.setListNote();
    distSel.innerHTML='<option value="">'+U.t('selectDistrict')+'</option>'+
      list.map(d=>'<option value="'+U.escapeHtml(d.name_ps)+'">'+
        U.escapeHtml(fa?(d.name_fa||d.name_ps):d.name_ps)+'</option>').join('');
  },

  /* ---------------- actions ---------------- */
  async doLogin(){
    const email=(document.getElementById('auEmailL').value||'').trim();
    const pass=document.getElementById('auPassL').value||'';
    if(!email || !pass){ U.toast(U.t('fillRequired'),'error'); return; }
    const btn=root.querySelector('[data-aulogin]');
    btn.disabled=true; btn.innerHTML=U.icon('refresh')+' '+U.t('loading');
    const r=await Cloud.login(email, pass);
    btn.disabled=false;
    if(r.error){ this.showErr(r.error, 'wrongCreds'); return r; }
    await this.enterApp();
    return r;
  },

  async doRegister(){
    if(this._busy) return;                       // ignore double taps
    const g=id=>{ const el=document.getElementById(id); return el ? (el.value||'').trim() : ''; };
    const btn=root.querySelector('[data-aureg]');
    this._busy=true; if(btn) btn.disabled=true;
    const r=await Cloud.register({
      fullName: g('auName'), phone: g('auPhone'),
      email: g('auEmailR'), password: document.getElementById('auPassR').value||'',
      province: g('auProvince'), district: g('auDistrict')
    });
    this._busy=false; if(btn) btn.disabled=false;
    if(r.needsConfirm){
      U.toast(U.t('needsConfirm'),'info');
      this.render('login');
      return r;
    }
    if(r.error){ this.showErr(r.error, 'registerFailed'); return r; }
    await this.enterApp();
    return r;
  },

  async enterApp(){
    await Cloud.loadAccount();
    await Cloud.guardDistrict();                /* other district on this phone → wipe old data */
    if(window.Sync) await Sync.startup();       /* pull FIRST, so the member row is not duplicated */
    await ensureAccountMember(Cloud.profile);   /* auto-add to علمي غړي */
    this.hide();
    Nav.buildSidebar();
    Nav.applyBrand();
    if(window.App) App.route();
  },

  /* ---------------- offline use ---------------- */
  offlineUse(tab){
    if(!Cloud.hasAccountOnDevice()){
      /* very first launch: an account is mandatory (needs the internet once) */
      U.toast(U.t('authOfflineFirst'),'error');
      if(tab!=='register') this.render('register');
      return;
    }
    const p=Cloud.enterOffline();
    if(!p){ U.toast(U.t('authOfflineFirst'),'error'); return; }
    this.hide();
    Nav.buildSidebar();
    Nav.applyBrand();
    if(window.Sync && Sync.refreshBadge) Sync.refreshBadge();
    if(window.App) App.route();
    U.toast(U.t('offlineStarted'),'info');
  },

  async logout(){
    await Cloud.logout();
    /* show the auth screen again (no reload needed) */
    this.show();
  }
};

/* every account is also a scientific member of the district —
   auto-create the members-store row once (matched by accountId) */
async function ensureAccountMember(profile){
  if(!window.Cloud || !Cloud.enabled() || !profile) return;
  if(profile.role==='super') return;        // the super admin is not a member of a district
  try{
    const all=await DB.getAll('members');
    if(all.some(m=>m.accountId===profile.id)) return;
    /* offline on a fresh device: the member may already exist in the cloud —
       wait for the first pull (Sync.onNetChange calls us again) */
    if(window.Sync && !Sync.isOnline() && !Sync.lastPullAt) return;
    const nowIso=new Date().toISOString();
    await DB.put('members',{
      id: U.uid(),
      fullName: profile.full_name||'',
      fatherName: '',
      position: U.t('scientificMember'),
      gender: '',
      phone: profile.phone||'',
      email: profile.email||'',
      status: 'm_active',
      accountId: profile.id,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }catch(e){ console.warn('[auth] ensureAccountMember', e); }
}

window.Auth=Auth;
window.ensureAccountMember=ensureAccountMember;
})();
