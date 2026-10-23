/* =====================================================================
   admin.js — SUPER ADMIN dashboard (visible to the super admin only).
   • register provinces (ولايتونه)
   • register districts (ولسوالۍ) under provinces
   • set per-district credit limit (اعتياري نیټه) + restrictions (محدودیتونه)
   • record income collected (عايد) per district
   The super dashboard is a SEPARATE view — district app data (schools,
   teachers, …) is not visible here; other users never see this page.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

/* parse a value that may contain localized (Eastern Arabic) digits */
function enNum(str){
  const s=String(str==null?'':str).replace(/[۰-۹]/g, d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const n=Number(s.replace(/[^0-9.]/g,''));
  return isNaN(n)?0:n;
}

const SuperDashboard = {
  _ctx:null,
  _pName(p){ return U.currentLang()==='fa'?(p.name_fa||p.name_ps):(p.name_ps||p.name_fa); },

  async render(view){
    view.innerHTML='<div class="view-fade" style="padding:40px;text-align:center"><div class="spinner"></div></div>';
    if(!(window.Cloud && Cloud.enabled() && Cloud.isSuper())){
      view.innerHTML='<div class="empty">'+U.icon('shield')+'<div>'+U.t('superOnly')+'</div></div>';
      return;
    }
    const [provs, dists, rev, membersTotal] = await Promise.all([
      Cloud.provincesOverview(),
      Cloud.districtOverview(),
      Cloud.revenueOverview(),
      (async()=>{ try{ const {data}=await Cloud.rpc('count_profiles'); return (data&&data.length)?Number(data[0].c||data[0].count||0):0; }catch(e){ return 0; } })()
    ]);
    const provinces=(provs.data||[]), districts=(dists.data||[]), revenue=(rev.data||[]);
    const totalRev=revenue.reduce((a,r)=>a+enNum(r.amount),0);
    this._ctx={provinces, districts, revenue, totalRev, membersTotal};

    view.innerHTML=
      '<div class="view-fade">'+
        '<div class="page-head"><div class="ph-icon">'+U.icon('shield')+'</div>'+
          '<div><h1>'+U.t('superDashboard')+'</h1><div class="ph-sub">'+U.t('superSub')+'</div></div></div>'+
        '<div class="stat-grid mb-3">'+
          this.card('flag','var(--info)',  U.t('provinces'), U.num(provinces.length))+
          this.card('map','var(--success)',U.t('districts'), U.num(districts.length))+
          this.card('users','var(--warning)',U.t('accountsTotal'), U.num(membersTotal))+
          this.card('cash','var(--primary)',U.t('totalRevenue'), U.num(totalRev)+' '+U.t('afghani'))+
        '</div>'+
        this.provincesCard(provinces)+
        this.districtsCard(districts)+
        this.revenueCard(districts, revenue)+
      '</div>';

    if(window.Jalali) Jalali.upgrade(view);
    this.wire(view);
  },

  card(icon, color, label, val){
    return '<div class="stat-card"><div class="sc-icon" style="color:'+color+'">'+U.icon(icon)+'</div>'+
      '<div><div class="sc-num">'+U.escapeHtml(String(val))+'</div><div class="sc-label">'+U.escapeHtml(label)+'</div></div></div>';
  },

  /* status badge + the four row actions: edit / activate-deactivate / delete */
  _status(active){
    return '<span class="badge '+(active?'b-green':'b-red')+'">'+U.t(active?'active':'inactiveS')+'</span>';
  },
  _rowActions(kind, id, active){
    return '<div class="row-actions">'+
      '<button type="button" class="icon-btn sm" data-'+kind+'-edit="'+U.escapeHtml(id)+'" title="'+U.t('edit')+'">'+U.icon('edit')+'</button>'+
      '<button type="button" class="icon-btn sm" data-'+kind+'-toggle="'+U.escapeHtml(id)+'" title="'+U.t(active?'deactivate':'activate')+'">'+U.icon(active?'shield':'shieldCheck')+'</button>'+
      '<button type="button" class="icon-btn sm danger" data-'+kind+'-del="'+U.escapeHtml(id)+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button>'+
    '</div>';
  },

  /* ---------------- provinces ---------------- */
  provincesCard(provinces){
    const rows=provinces.map(p=>
      '<tr><td><b>'+U.escapeHtml(this._pName(p))+'</b></td>'+
      '<td class="tc">'+U.num(p.districts)+'</td>'+
      '<td class="tc">'+this._status(p.is_active!==false)+'</td>'+
      '<td class="tc">'+this._rowActions('prov', p.id, p.is_active!==false)+'</td></tr>'
    ).join('');
    return '<div class="card mb-3"><div class="card-head"><h3>'+U.icon('flag')+' '+U.t('provinces')+'</h3></div>'+
      '<div class="card-body">'+
        '<div class="table-wrap"><table class="data"><thead><tr>'+
          '<th>'+U.t('provinceName')+'</th><th class="tc">'+U.t('districtsCount')+'</th><th class="tc">'+U.t('status')+'</th><th class="tc">'+U.t('actions')+'</th>'+
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="4" class="muted">'+U.t('noData')+'</td></tr>')+'</tbody></table></div>'+
        '<div class="flex flex-wrap mt-2">'+
          '<div class="field"><input type="text" id="provPs" placeholder="'+U.t('provinceName')+' *" aria-label="'+U.t('provinceName')+'"></div>'+
          '<div class="field"><input type="text" id="provFa" placeholder="'+U.t('provinceFa')+' " aria-label="'+U.t('provinceFa')+'"></div>'+
          '<button type="button" class="btn btn-primary btn-sm" id="provAdd">'+U.icon('plus')+' '+U.t('addProvince')+'</button>'+
        '</div>'+
      '</div></div>';
  },

  /* ---------------- districts ---------------- */
  districtsCard(districts){
    const rows=districts.map(d=>{
      const max=Number(d.max_accounts)||8;
      const act=(d.is_active!==false) && (d.province_active!==false);
      return '<tr>'+
        '<td>'+U.escapeHtml(this._pName({name_ps:d.province_ps, name_fa:d.province_fa}))+'</td>'+
        '<td><b>'+U.escapeHtml(this._pName(d))+'</b></td>'+
        '<td class="tc"><span class="badge '+(Number(d.accounts)>=max?'b-red':'b-green')+'">'+U.num(d.accounts)+' / '+U.num(max)+'</span></td>'+
        '<td>'+U.num(enNum(d.credit_limit))+' '+U.t('afghani')+'</td>'+
        '<td>'+U.escapeHtml(d.restrictions||'—')+'</td>'+
        '<td class="tc">'+this._status(act)+(d.province_active===false?'<div class="muted small">'+U.t('provinceInactiveNote')+'</div>':'')+'</td>'+
        '<td class="tc">'+this._rowActions('dist', d.id, d.is_active!==false)+'</td>'+
      '</tr>';
    }).join('');
    return '<div class="card mb-3"><div class="card-head"><h3>'+U.icon('map')+' '+U.t('districts')+'</h3></div>'+
      '<div class="card-body">'+
        '<div class="table-wrap"><table class="data"><thead><tr>'+
          '<th>'+U.t('provinceName')+'</th><th>'+U.t('districtName')+'</th><th class="tc">'+U.t('accountsCount')+'</th>'+
          '<th>'+U.t('creditLimit')+'</th><th>'+U.t('restrictions')+'</th><th class="tc">'+U.t('status')+'</th><th class="tc">'+U.t('actions')+'</th>'+
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="muted">'+U.t('noData')+'</td></tr>')+'</tbody></table></div>'+
        '<div class="flex flex-wrap mt-2">'+
          '<div class="field"><select id="distProv" aria-label="'+U.t('provinceName')+'">'+
            '<option value="">'+U.t('selectProvince')+'</option>'+
            this._ctx.provinces.map(p=>'<option value="'+U.escapeHtml(p.id)+'">'+U.escapeHtml(this._pName(p))+'</option>').join('')+
          '</select></div>'+
          '<div class="field"><input type="text" id="distPs" placeholder="'+U.t('districtName')+' *" aria-label="'+U.t('districtName')+'"></div>'+
          '<div class="field"><input type="text" id="distFa" placeholder="'+U.t('districtFa')+' " aria-label="'+U.t('districtFa')+'"></div>'+
          '<button type="button" class="btn btn-primary btn-sm" id="distAdd">'+U.icon('plus')+' '+U.t('addDistrict')+'</button>'+
        '</div>'+
      '</div></div>';
  },

  /* ---------------- revenue (عايد) ---------------- */
  revenueCard(districts, revenue){
    const rows=revenue.map(r=>
      '<tr>'+
        '<td>'+U.escapeHtml(this._pName({name_ps:r.province_ps})+' — '+r.district_ps)+'</td>'+
        '<td class="tc"><b>'+U.num(enNum(r.amount))+'</b></td>'+
        '<td>'+U.escapeHtml(U.fmtDate(r.collected_at))+'</td>'+
        '<td>'+U.escapeHtml(r.notes||'')+'</td>'+
        '<td class="tc"><button type="button" class="icon-btn sm danger" data-revdel="'+U.escapeHtml(r.id)+'" title="'+U.t('delete')+'">'+U.icon('trash')+'</button></td>'+
      '</tr>'
    ).join('');
    return '<div class="card mb-3"><div class="card-head"><h3>'+U.icon('cash')+' '+U.t('revenue')+'</h3></div>'+
      '<div class="card-body">'+
        '<div class="flex flex-wrap mb-2">'+
          '<div class="field"><select id="revDist" aria-label="'+U.t('districtName')+'">'+
            '<option value="">'+U.t('selectDistrict')+'</option>'+
            districts.map(d=>'<option value="'+U.escapeHtml(d.id)+'">'+U.escapeHtml(this._pName({name_ps:d.province_ps,name_fa:d.province_fa})+' — '+this._pName(d))+'</option>').join('')+
          '</select></div>'+
          '<div class="field"><input type="number" id="revAmount" min="0" placeholder="'+U.t('revenueAmount')+'" aria-label="'+U.t('revenueAmount')+'"></div>'+
          '<div class="field"><input type="date" id="revDate" value="'+U.todayISO()+'" aria-label="'+U.t('date')+'"></div>'+
          '<div class="field"><input type="text" id="revNotes" placeholder="'+U.t('revenueNotes')+'" aria-label="'+U.t('revenueNotes')+'"></div>'+
          '<button type="button" class="btn btn-primary btn-sm" id="revAdd">'+U.icon('plus')+' '+U.t('addRevenue')+'</button>'+
        '</div>'+
        '<div class="table-wrap"><table class="data"><thead><tr>'+
          '<th>'+U.t('districtName')+'</th><th class="tc">'+U.t('revenueAmount')+'</th><th>'+U.t('date')+'</th><th>'+U.t('notes')+'</th><th></th>'+
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="muted">'+U.t('noData')+'</td></tr>')+'</tbody></table></div>'+
        '<div class="mt-2 small"><b>'+U.t('totalRevenue')+':</b> <b style="color:var(--primary)">'+U.num(this._ctx.totalRev)+' '+U.t('afghani')+'</b></div>'+
      '</div></div>';
  },

  /* ---------------- wiring ---------------- */
  wire(view){
    /* provinces: add */
    view.querySelector('#provAdd').addEventListener('click', async ()=>{
      const ps=(view.querySelector('#provPs').value||'').trim();
      const fa=(view.querySelector('#provFa').value||'').trim();
      if(!ps){ U.toast(U.t('fillRequired'),'error'); return; }
      const r=await Cloud.addProvince(ps, fa);
      if(r.error){ U.toast(r.error.message,'error'); return; }
      U.toast(U.t('saved'),'success');
      this.render(view);
    });

    /* districts: add */
    view.querySelector('#distAdd').addEventListener('click', async ()=>{
      const pid=view.querySelector('#distProv').value;
      const ps=(view.querySelector('#distPs').value||'').trim();
      const fa=(view.querySelector('#distFa').value||'').trim();
      if(!pid){ U.toast(U.t('selectProvinceReq'),'error'); return; }
      if(!ps){ U.toast(U.t('fillRequired'),'error'); return; }
      const r=await Cloud.addDistrict(pid, ps, fa);
      if(r.error){ U.toast(r.error.message,'error'); return; }
      U.toast(U.t('saved'),'success');
      this.render(view);
    });

    const fail=(r)=>{ U.toast((r.error&&r.error.message)||U.t('error'),'error'); };

    /* provinces: edit (names + active) */
    view.querySelectorAll('[data-prov-edit]').forEach(b=>b.addEventListener('click', ()=>{
      const p=this._ctx.provinces.find(x=>x.id===b.dataset.provEdit); if(!p) return;
      const m=UI.modal({
        title: U.t('editProvince')+' — '+this._pName(p), icon:'flag', size:'md',
        body:
          '<div class="field mb-2"><label>'+U.t('provinceName')+' <span class="req">*</span></label><input type="text" id="epPs" value="'+U.escapeHtml(p.name_ps||'')+'"></div>'+
          '<div class="field mb-2"><label>'+U.t('provinceFa')+'</label><input type="text" id="epFa" value="'+U.escapeHtml(p.name_fa||'')+'"></div>'+
          '<label class="chk"><input type="checkbox" id="epAct" '+(p.is_active!==false?'checked':'')+'> '+U.t('active')+'</label>'+
          '<div class="muted small mt-1">'+U.t('provinceInactiveNote')+'</div>',
        foot:'<button type="button" class="btn btn-outline" data-act="close">'+U.t('cancel')+'</button>'+
             '<button type="button" class="btn btn-primary" data-act="save">'+U.icon('check')+' '+U.t('save')+'</button>'
      });
      m.el.querySelector('[data-act=close]').addEventListener('click', ()=>m.close());
      m.el.querySelector('[data-act=save]').addEventListener('click', async ()=>{
        const ps=(m.el.querySelector('#epPs').value||'').trim();
        if(!ps){ U.toast(U.t('fillRequired'),'error'); return; }
        const r=await Cloud.updateProvince(p.id,{name_ps:ps,name_fa:(m.el.querySelector('#epFa').value||'').trim()||ps,is_active:m.el.querySelector('#epAct').checked});
        if(r.error) return fail(r);
        U.toast(U.t('saved'),'success'); m.close(); this.render(view);
      });
    }));
    /* provinces: activate / deactivate (one tap) */
    view.querySelectorAll('[data-prov-toggle]').forEach(b=>b.addEventListener('click', async ()=>{
      const p=this._ctx.provinces.find(x=>x.id===b.dataset.provToggle); if(!p) return;
      const next=!(p.is_active!==false);
      const ok=await UI.confirm({danger:!next, title:U.t(next?'activate':'deactivate'), msg:'<b>'+U.escapeHtml(this._pName(p))+'</b><br><span class="muted small">'+U.t(next?'activateNote':'deactivateNote')+'</span>', okLabel:U.t(next?'activate':'deactivate')});
      if(!ok) return;
      const r=await Cloud.updateProvince(p.id,{is_active:next});
      if(r.error) return fail(r);
      U.toast(U.t('saved'),'success'); this.render(view);
    }));
    /* provinces: delete (only when it has no districts) */
    view.querySelectorAll('[data-prov-del]').forEach(b=>b.addEventListener('click', async ()=>{
      const p=this._ctx.provinces.find(x=>x.id===b.dataset.provDel); if(!p) return;
      if(Number(p.districts)>0){ U.toast(U.t('cannotDeleteHasChildren'),'error'); return; }
      const ok=await UI.confirm({danger:true, title:U.t('delete'), msg:U.t('confirmDelete')+'<br><b>'+U.escapeHtml(this._pName(p))+'</b>', okLabel:U.t('delete')});
      if(!ok) return;
      const r=await Cloud.deleteProvince(p.id);
      if(r.error) return fail(r);
      U.toast(U.t('deleted'),'success'); this.render(view);
    }));

    /* districts: full settings (names, active, account limit, credit, restrictions) */
    view.querySelectorAll('[data-dist-edit]').forEach(b=>b.addEventListener('click', ()=>{
      const d=this._ctx.districts.find(x=>x.id===b.dataset.distEdit);
      if(!d) return;
      const m=UI.modal({
        title: U.t('districtSettings')+' — '+this._pName(d),
        icon: 'map',
        size: 'md',
        body:
          '<div class="field mb-2"><label>'+U.t('provinceName')+'</label>'+
            '<input value="'+U.escapeHtml(this._pName({name_ps:d.province_ps,name_fa:d.province_fa}))+'" disabled></div>'+
          '<div class="field mb-2"><label>'+U.t('districtName')+' <span class="req">*</span></label><input type="text" id="edPs" value="'+U.escapeHtml(d.name_ps||'')+'"></div>'+
          '<div class="field mb-2"><label>'+U.t('districtFa')+'</label><input type="text" id="edFa" value="'+U.escapeHtml(d.name_fa||'')+'"></div>'+
          '<div class="field mb-2"><label>'+U.t('maxAccounts')+' <span class="req">*</span> <span class="muted small">('+U.t('maxAccountsHint')+')</span></label>'+
            '<input type="number" id="edMax" min="1" max="500" value="'+(Number(d.max_accounts)||8)+'"></div>'+
          '<div class="field mb-2"><label>'+U.t('creditLimit')+' <span class="muted small">('+U.t('creditLimitHint')+')</span></label>'+
            '<input type="number" id="edCredit" min="0" value="'+enNum(d.credit_limit)+'"></div>'+
          '<div class="field mb-2"><label>'+U.t('restrictions')+'</label>'+
            '<textarea id="edRestr" rows="3" placeholder="'+U.t('restrictionsPlaceholder')+'">'+U.escapeHtml(d.restrictions||'')+'</textarea></div>'+
          '<label class="chk"><input type="checkbox" id="edAct" '+(d.is_active!==false?'checked':'')+'> '+U.t('active')+'</label>',
        foot:
          '<button type="button" class="btn btn-outline" data-act="close">'+U.t('cancel')+'</button>'+
          '<button type="button" class="btn btn-primary" data-act="save">'+U.icon('check')+' '+U.t('save')+'</button>'
      });
      m.el.querySelectorAll('[data-act=close]').forEach(x=>x.addEventListener('click', ()=>m.close()));
      m.el.querySelector('[data-act=save]').addEventListener('click', async ()=>{
        const ps=(m.el.querySelector('#edPs').value||'').trim();
        const max=Math.round(enNum(m.el.querySelector('#edMax').value));
        if(!ps || !(max>=1)){ U.toast(U.t('fillRequired'),'error'); return; }
        if(max < Number(d.accounts)){ U.toast(U.t('maxBelowAccounts'),'error'); return; }
        const r=await Cloud.updateDistrict(d.id,{
          name_ps:ps, name_fa:(m.el.querySelector('#edFa').value||'').trim()||ps,
          max_accounts:max, credit_limit:enNum(m.el.querySelector('#edCredit').value),
          restrictions:(m.el.querySelector('#edRestr').value||'').trim(),
          is_active:m.el.querySelector('#edAct').checked
        });
        if(r.error) return fail(r);
        U.toast(U.t('saved'),'success'); m.close(); this.render(view);
      });
    }));
    /* districts: activate / deactivate */
    view.querySelectorAll('[data-dist-toggle]').forEach(b=>b.addEventListener('click', async ()=>{
      const d=this._ctx.districts.find(x=>x.id===b.dataset.distToggle); if(!d) return;
      const next=!(d.is_active!==false);
      const ok=await UI.confirm({danger:!next, title:U.t(next?'activate':'deactivate'), msg:'<b>'+U.escapeHtml(this._pName(d))+'</b><br><span class="muted small">'+U.t(next?'activateNote':'deactivateNote')+'</span>', okLabel:U.t(next?'activate':'deactivate')});
      if(!ok) return;
      const r=await Cloud.updateDistrict(d.id,{is_active:next});
      if(r.error) return fail(r);
      U.toast(U.t('saved'),'success'); this.render(view);
    }));
    /* districts: delete (only when no account belongs to it) */
    view.querySelectorAll('[data-dist-del]').forEach(b=>b.addEventListener('click', async ()=>{
      const d=this._ctx.districts.find(x=>x.id===b.dataset.distDel); if(!d) return;
      if(Number(d.accounts)>0){ U.toast(U.t('cannotDeleteHasChildren'),'error'); return; }
      const ok=await UI.confirm({danger:true, title:U.t('delete'), msg:U.t('confirmDelete')+'<br><b>'+U.escapeHtml(this._pName(d))+'</b>', okLabel:U.t('delete')});
      if(!ok) return;
      const r=await Cloud.deleteDistrict(d.id);
      if(r.error) return fail(r);
      U.toast(U.t('deleted'),'success'); this.render(view);
    }));

    /* revenue: add */
    view.querySelector('#revAdd').addEventListener('click', async ()=>{
      const distId=view.querySelector('#revDist').value;
      const amt=enNum(view.querySelector('#revAmount').value);
      const dateVal=view.querySelector('#revDate').value; /* ISO gregorian (Jalali widget keeps it hidden) */
      const notes=(view.querySelector('#revNotes').value||'').trim();
      if(!distId){ U.toast(U.t('selectDistrictReq'),'error'); return; }
      if(!(amt>0)){ U.toast(U.t('fillRequired'),'error'); return; }
      if(!dateVal){ U.toast(U.t('fillRequired'),'error'); return; }
      const r=await Cloud.revenueAdd({districtId:distId, amount:amt, collectedAt:dateVal, notes});
      if(r.error){ U.toast(r.error.message,'error'); return; }
      U.toast(U.t('saved'),'success');
      this.render(view);
    });

    /* revenue: delete */
    view.querySelectorAll('[data-revdel]').forEach(b=>b.addEventListener('click', async ()=>{
      const ok=await UI.confirm({danger:true, title:U.t('delete'), msg:U.t('confirmDelete'), okLabel:U.t('delete')});
      if(!ok) return;
      const r=await Cloud.revenueDel(b.dataset.revdel);
      if(r.error){ U.toast(r.error.message,'error'); return; }
      U.toast(U.t('deleted'),'success');
      this.render(view);
    }));
  }
};

window.SuperDashboard = SuperDashboard;
})();
