/* =====================================================================
   database.js — IndexedDB persistence layer (100% offline)
   Stores all module data. Falls back to in-memory (with warning) if
   IndexedDB is unavailable in the environment.
   ===================================================================== */

(function(){
'use strict';

const DB = {
  NAME:'school_tdp_db',
  VER:2,
  STORES:{
    settings:{kp:'id'},
    members:{kp:'id'},
    schools:{kp:'id'},
    employees:{kp:'id'},
    teachers:{kp:'id'},
    studentStats:{kp:'id'},
    tashkil:{kp:'id'},
    observations:{kp:'id'},
    criteria:{kp:'id'},
    annualPlans:{kp:'id'},
    monthlyPlans:{kp:'id'},
    duties:{kp:'id'},
    activities:{kp:'id'},
    professionalDevelopment:{kp:'id'},
    learningCircles:{kp:'id'},
    monitoring:{kp:'id'},
    reports:{kp:'id'},
    counters:{kp:'id'}
  },
  _db:null,
  memory:false,
  _mem:{},

  async init(){
    if(typeof indexedDB === 'undefined'){ this._useMemory(); return; }
    try{
      await new Promise((resolve,reject)=>{
        const req = indexedDB.open(this.NAME,this.VER);
        req.onupgradeneeded = (e)=>{
          const db=e.target.result;
          Object.keys(this.STORES).forEach(name=>{
            if(!db.objectStoreNames.contains(name)){
              const s=db.createObjectStore(name,{keyPath:this.STORES[name].kp});
            }
          });
          /* sync outbox — NOT part of STORES so backups ignore it */
          if(!db.objectStoreNames.contains('__outbox')){
            db.createObjectStore('__outbox',{keyPath:'oid'});
          }
        };
        req.onsuccess = (e)=>{ this._db=e.target.result; resolve(); };
        req.onerror = (e)=>{ reject(e.target.error||new Error('idb open failed')); };
        req.onblocked = ()=>{ reject(new Error('idb blocked')); };
        setTimeout(()=>reject(new Error('idb timeout')), 5000);
      });
    }catch(e){
      this._useMemory();
    }
  },

  _useMemory(){
    this.memory=true;
    Object.keys(this.STORES).forEach(k=>{ this._mem[k]=[]; });
  },

  /* ---------- memory helpers ---------- */
  _mAll(name){ return (this._mem[name]||[]).slice(); },
  _mPut(name,rec){
    const arr=this._mem[name]||(this._mem[name]=[]);
    const i=arr.findIndex(r=>r.id===rec.id);
    if(i>=0) arr[i]=rec; else arr.push(rec);
    return rec;
  },
  _mDel(name,id){
    const arr=this._mem[name]||[];
    const i=arr.findIndex(r=>r.id===id);
    if(i>=0) arr.splice(i,1);
  },

  /* ---------- read ---------- */
  async get(name,id){
    if(this.memory) return (this._mAll(name).find(r=>r.id===id))||null;
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction(name,'readonly').objectStore(name).get(id);
      rq.onsuccess=()=>resolve(rq.result||null);
      rq.onerror=()=>reject(rq.error);
    });
  },
  async getAll(name){
    if(this.memory) return this._mAll(name);
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction(name,'readonly').objectStore(name).getAll();
      rq.onsuccess=()=>resolve(rq.result||[]);
      rq.onerror=()=>reject(rq.error);
    });
  },
  async count(name){
    const all = await this.getAll(name);
    return all.length;
  },

  /* ---------- write ---------- */
  /* opts.noSync = true → write is NOT queued for upload (used when applying
     pulled rows). Per-call flag instead of a global one, so a user's edit that
     happens while a pull is running is still queued. */
  async put(name,rec,opts){
    const noSync = !!(opts && opts.noSync);
    if(this.memory){ this._mPut(name,rec); if(!noSync) this._syncQueue('put',name,rec); return rec; }
    const p=await new Promise((resolve,reject)=>{
      const rq=this._db.transaction(name,'readwrite').objectStore(name).put(rec);
      rq.onsuccess=()=>resolve(rec);
      rq.onerror=()=>reject(rq.error);
    });
    if(!noSync) this._syncQueue('put',name,rec);
    return p;
  },
  async bulkPut(name,recs){
    if(this.memory){ recs.forEach(r=>this._mPut(name,r)); return; }
    return await new Promise((resolve,reject)=>{
      const t=this._db.transaction(name,'readwrite');
      const store=t.objectStore(name);
      recs.forEach(r=>store.put(r));
      t.oncomplete=()=>resolve();
      t.onerror=()=>reject(t.error);
    });
  },
  async del(name,id,opts){
    const noSync = !!(opts && opts.noSync);
    if(this.memory){ this._mDel(name,id); if(!noSync) this._syncQueue('del',name,{id}); return; }
    const p=await new Promise((resolve,reject)=>{
      const rq=this._db.transaction(name,'readwrite').objectStore(name).delete(id);
      rq.onsuccess=()=>resolve();
      rq.onerror=()=>reject(rq.error);
    });
    if(!noSync) this._syncQueue('del',name,{id});
    return p;
  },
  /* fire-and-forget: hand the write to the sync outbox (cloud mode only) */
  _syncQueue(op,name,rec){
    try{
      if(window.Sync && Sync.enabled()){
        if(op==='put') Sync.queuePut(name,rec);
        else Sync.queueDel(name,rec.id);
      }
    }catch(e){ /* never break local writes because of sync */ }
  },

  /* ---------- sync outbox (cloud mode) ---------- */
  async outboxPut(entry){
    if(this.memory) return;
    await new Promise((resolve,reject)=>{
      const rq=this._db.transaction('__outbox','readwrite').objectStore('__outbox').put(entry);
      rq.onsuccess=()=>resolve(); rq.onerror=()=>reject(rq.error);
    });
  },
  async outboxAll(){
    if(this.memory) return [];
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction('__outbox','readonly').objectStore('__outbox').getAll();
      rq.onsuccess=()=>resolve(rq.result||[]); rq.onerror=()=>reject(rq.error);
    });
  },
  async outboxCount(){
    if(this.memory) return 0;
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction('__outbox','readonly').objectStore('__outbox').count();
      rq.onsuccess=()=>resolve(rq.result||0); rq.onerror=()=>reject(rq.error);
    });
  },
  async outboxGet(oid){
    if(this.memory) return null;
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction('__outbox','readonly').objectStore('__outbox').get(oid);
      rq.onsuccess=()=>resolve(rq.result||null); rq.onerror=()=>reject(rq.error);
    });
  },
  /* remove only the entries that were really uploaded: if a record was edited
     again while the upload was running its outbox entry has a newer `ts`
     and must stay queued */
  async outboxClearIf(entries){
    if(this.memory || !entries.length) return;
    await new Promise((resolve,reject)=>{
      const t=this._db.transaction('__outbox','readwrite');
      const st=t.objectStore('__outbox');
      entries.forEach(e=>{
        const g=st.get(e.oid);
        g.onsuccess=()=>{ if(g.result && g.result.ts===e.ts) st.delete(e.oid); };
      });
      t.oncomplete=()=>resolve(); t.onerror=()=>reject(t.error);
    });
  },
  async outboxClearAll(){
    if(this.memory) return;
    await new Promise((resolve,reject)=>{
      const rq=this._db.transaction('__outbox','readwrite').objectStore('__outbox').clear();
      rq.onsuccess=()=>resolve(); rq.onerror=()=>reject(rq.error);
    });
  },
  /* wipe all district data on this device (not the settings): used when a
     different district signs in on the same phone */
  async wipeLocal(){
    for(const name of Object.keys(this.STORES)){
      if(name==='settings') continue;
      await this.clear(name);
    }
    await this.outboxClearAll();
  },
  async outboxClear(oids){
    if(this.memory) return;
    await new Promise((resolve,reject)=>{
      const t=this._db.transaction('__outbox','readwrite');
      const st=t.objectStore('__outbox');
      oids.forEach(id=>st.delete(id));
      t.oncomplete=()=>resolve(); t.onerror=()=>reject(t.error);
    });
  },
  async clear(name){
    if(this.memory){ this._mem[name]=[]; return; }
    return await new Promise((resolve,reject)=>{
      const rq=this._db.transaction(name,'readwrite').objectStore(name).clear();
      rq.onsuccess=()=>resolve();
      rq.onerror=()=>reject(rq.error);
    });
  },

  /* ---------- backup / restore ---------- */
  async dumpAll(){
    const out={ _meta:{ app:'School TDP System', version:1, exportedAt:new Date().toISOString(), engine:this.memory?'memory':'indexeddb' }, data:{} };
    for(const name of Object.keys(this.STORES)){
      out.data[name]= await this.getAll(name);
    }
    return out;
  },
  async loadAll(payload){
    const data = payload && payload.data;
    if(!data) throw new Error('bad backup');
    for(const name of Object.keys(this.STORES)){
      const rows = data[name];
      /* cloud mode: keep the outbox in step with the restore */
      try{
        if(window.Sync && window.Sync.enabled && window.Sync.enabled()){
          const before = (await this.getAll(name)).map(r=>r.id);
          await this.clear(name);
          const clean = (Array.isArray(rows)?rows:[]).filter(r=>r && (r.id!==undefined));
          await this.bulkPut(name,clean);
          const after = new Set(clean.map(r=>r.id));
          for(const id of before) if(!after.has(id)) await window.Sync.queueDel(name,id);
          for(const rec of clean) await window.Sync.queuePut(name,rec);
          continue;
        }
      }catch(e){ console.warn('[db] restore queue', e); }
      await this.clear(name);
      if(Array.isArray(rows) && rows.length){
        const clean = rows.filter(r=>r && (r.id!==undefined));
        await this.bulkPut(name,clean);
      }
    }
  },
  /* integrity: returns {ok, issues[]} */
  async integrity(){
    const issues=[];
    const [members,schools,teachers,employees,obs] = await Promise.all([
      this.getAll('members'),this.getAll('schools'),this.getAll('teachers'),
      this.getAll('employees'),this.getAll('observations')
    ]);
    const sids=new Set(schools.map(s=>s.id));
    const mids=new Set(members.map(m=>m.id));
    const tids=new Set(teachers.map(t=>t.id));
    teachers.forEach(x=>{ if(x.schoolId && !sids.has(x.schoolId)) issues.push(x.fullName+' → '+(window.Utils?Utils.t('missingSchool'):'missing school')); });
    employees.forEach(e=>{ if(e.schoolId && !sids.has(e.schoolId)) issues.push(e.fullName+' → missing school'); });
    obs.forEach(o=>{
      if(o.teacherId && !tids.has(o.teacherId)) issues.push('observation → missing teacher');
      if(o.observerId && !mids.has(o.observerId)) issues.push('observation → missing observer');
    });
    return {ok:issues.length===0, issues};
  }
};

window.DB = DB;
})();
