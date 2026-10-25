/* =====================================================================
   sync.js — offline-first sync engine (cloud mode only).
   Every local write is recorded in an outbox (IndexedDB __outbox);
   when online the outbox is pushed to Supabase and the district's
   records are pulled back. Offline edits sync automatically as soon
   as the connection returns (online event / visibility / timer).
   Conflict policy: last write wins (compared by updated_at); local
   unpushed changes always win until they are pushed.
   ===================================================================== */

(function(){
'use strict';
const U = Utils;

const Sync = {
  busy: false,
  applying: false,       // true while applying pulled rows (no re-queue)
  timer: null,
  pullTimer: null,
  pending: 0,
  lastPushAt: null,
  lastPullAt: null,
  toastShown: false,

  enabled(){ return !!(window.Cloud && Cloud.enabled() && !DB.memory); },
  isOnline(){ return (typeof navigator==='undefined') || navigator.onLine; },

  /* called from DB.put / DB.del (local mode: no-op) */
  async queuePut(store, rec){
    if(!this.enabled() || !rec || !rec.id) return;
    await this._outboxPut({
      oid: store+'::'+rec.id, store, key_id: rec.id,
      payload: rec, deleted: false, ts: Date.now()
    });
  },
  async queueDel(store, id){
    if(!this.enabled() || !id) return;
    await this._outboxPut({
      oid: store+'::'+id, store, key_id: id,
      payload: {}, deleted: true, ts: Date.now()
    });
  },

  async _outboxPut(entry){
    try{ await DB.outboxPut(entry); }catch(e){ console.warn('[sync] outbox', e); }
    this._count();
    this.schedulePush();
  },

  async _count(){
    try{ this.pending = await DB.outboxCount(); }catch(e){ this.pending=0; }
    this.updateBadge();
  },

  updateBadge(){
    const el=document.getElementById('syncBadge');
    if(!el) return;
    if(!this.enabled()){ el.hidden=true; return; }
    el.hidden=false;
    const dot = this.isOnline() ? 'on' : 'off';
    const label = !this.isOnline() ? U.t('offline')
      : (this.pending>0 ? U.tParams('pendingSync', {n:U.num(this.pending)})
      : (this.lastPushAt ? U.t('synced') : U.t('online')));
    el.innerHTML='<span class="sync-dot '+dot+'"></span><span class="sync-label">'+label+'</span>';
  },

  /* debounce pushes so a burst of saves = one upload */
  schedulePush(){
    if(!this.enabled()) return;
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{ this.push().catch(()=>{}); }, 1200);
  },

  /* ---------------- PUSH (outbox -> Supabase) ---------------- */
  async push(){
    if(!this.enabled() || !this.isOnline() || this.busy) return;
    this.busy=true;
    try{
      let batch=await DB.outboxAll();
      /* no district known → NEVER clear the outbox (that would silently lose
         the user's offline work); keep it queued until the account is loaded */
      const did = Cloud.district ? Cloud.district.id : null;
      if(batch.length && did){
        batch.sort((a,b)=>a.ts-b.ts);
        const rows=batch.map(e=>({
          district_id: did,
          store: e.store,
          key_id: e.key_id,
          payload: e.payload || {},
          updated_at: new Date(e.ts).toISOString(),
          deleted: !!e.deleted
        }));
        for(let i=0;i<rows.length;i+=200){
          const chunk=rows.slice(i,i+200);
          const {error} = await Cloud.client.from('records')
            .upsert(chunk, {onConflict:'district_id,store,key_id'});
          if(error) throw error;
        }
        /* only entries that were not edited again during the upload */
        await DB.outboxClearIf(batch);
        this.lastPushAt=Date.now();
      }
    }catch(e){
      console.warn('[sync] push failed', e.message||e);
    }
    this.busy=false;
    await this._count();
  },

  /* ---------------- PULL (Supabase -> local, last-write-wins) ---------------- */
  async pull(){
    if(!this.enabled() || !this.isOnline() || this.busy) return;
    if(!Cloud.district) return;               // nothing to pull without a district
    this.busy=true;
    try{
      const {data, error} = await Cloud.client
        .from('records')
        .select('*')
        .eq('district_id', Cloud.district.id);
      if(error) throw error;
      let n=0;
      for(const row of (data||[])){
        /* re-check the outbox for EVERY row: the user may have edited this
           record while the pull was running — local always wins until pushed */
        if(await DB.outboxGet(row.store+'::'+row.key_id)) continue;
        if(!DB.STORES[row.store]) continue;      // unknown store → ignore
        if(row.deleted){ await DB.del(row.store, row.key_id, {noSync:true}); n++; continue; }
        const local = await DB.get(row.store, row.key_id);
        if(local && local.updatedAt && local.updatedAt >= row.updated_at) continue;
        const rec=Object.assign({}, row.payload || {});
        rec.id=row.key_id;
        rec.updatedAt=row.updated_at;
        await DB.put(row.store, rec, {noSync:true});
        n++;
      }
      if(n){ this.lastPullAt=Date.now(); this.refreshSoon(); }
      else if(!this.lastPullAt) this.lastPullAt=Date.now();
    }catch(e){
      console.warn('[sync] pull failed', e.message||e);
    }
    this.busy=false;
    await this._count();
    if(this.pending>0) this.schedulePush();   // edits made while we were busy
  },

  /* after new rows arrived: refresh the visible page (debounced) */
  refreshSoon(){
    clearTimeout(this._rt);
    this._rt=setTimeout(()=>{
      try{
        /* only refresh plain list pages — never under an open modal, a form
           being filled (any focused field) or a detail/edit page (#/x/id) */
        const open=document.querySelector('.modal-overlay');
        const ae=document.activeElement;
        const typing=ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
        const listPage=/^#\/[^\/?]*(\?.*)?$/.test(location.hash||'#/dashboard');
        if(!open && !typing && listPage && window.App && !App.booting) App.refreshView();
      }catch(e){}
    }, 600);
  },

  /* members that belong to an ACCOUNT: remove those whose account was deleted in
     Supabase, and any duplicate of the same account. Removals are synced, so every
     device ends up with the same list. Never runs on a failed/empty answer. */
  async reconcileAccounts(){
    try{
      if(!this.enabled() || !this.isOnline() || Cloud.offline) return;
      if(Cloud.profile && Cloud.profile.role==='super') return;
      const ids=await Cloud.districtAccountIds();
      if(!ids || !ids.length) return;
      const live=new Set(ids);
      const members=(await DB.getAll('members')).filter(m=>m.accountId);
      members.sort((a,b)=>(a.id.indexOf('acct_')===0?0:1)-(b.id.indexOf('acct_')===0?0:1) || String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
      const seen={}; let n=0;
      for(const m of members){
        if(!live.has(m.accountId) || seen[m.accountId]){ await DB.del('members',m.id); n++; continue; }
        seen[m.accountId]=1;
      }
      if(n) this.refreshSoon();
    }catch(e){ console.warn('[sync] reconcileAccounts', e); }
  },

  async startup(){
    if(!this.enabled()) return;
    this._count();
    if(this.isOnline()){
      /* pull first (so fresh remote data is visible), then push local */
      await this.pull();
      await this.push();
      await this.pull();
      await this.reconcileAccounts();
    }
    this.updateBadge();
    /* periodic catch-up while online */
    clearInterval(this.pullTimer);
    this.pullTimer=setInterval(()=>{
      if(this.isOnline() && !this.busy){ this.push().catch(()=>{}); this.pull().then(()=>this.reconcileAccounts()).catch(()=>{}); }
    }, 120000);
  },

  async onNetChange(online){
    this.updateBadge();
    if(online){
      await this.push().catch(()=>{});
      await this.pull().catch(()=>{});
      try{ if(window.ensureAccountMember) await ensureAccountMember(Cloud.profile); }catch(e){}
      await this.reconcileAccounts();
      if(!this.toastShown && this.pending===0){
        U.toast(U.t('autoSynced'),'success');
        this.toastShown=true;
      }
    }
  },

  /* manual "sync now" from the backup page */
  async manual(){
    if(!this.enabled()){ U.toast(U.t('localMode'), 'warning'); return; }
    if(!this.isOnline()){ U.toast(U.t('offline'),'warning'); return; }
    U.toast(U.t('syncing'),'info');
    await this.pull();
    await this.push();
    await this._count();
    if(this.pending===0) U.toast(U.t('synced'),'success');
    else U.toast(U.tParams('pendingSync',{n:U.num(this.pending)}),'warning');
  }
};

window.Sync = Sync;
})();
