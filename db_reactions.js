/**
 * ═══════════════════════════════════════════════
 *  NTILA — BASE DE DADOS DE REACÇÕES v1.0
 *  localStorage  |  BroadcastChannel sync
 * ═══════════════════════════════════════════════
 */
;(function(global){
'use strict';
const BC=(typeof BroadcastChannel!=='undefined')?new BroadcastChannel('ntila_reactions_sync'):null;
const _cbs={};
function _emit(k,d){if(BC)BC.postMessage({k,d});(_cbs[k]||[]).forEach(cb=>{try{cb(d);}catch(e){}});}
if(BC)BC.onmessage=({data:m})=>{if(m&&m.k)(_cbs[m.k]||[]).forEach(cb=>{try{cb(m.d);}catch(e){}});};
function _obj(){try{return JSON.parse(localStorage.getItem('ntila_reactions')||'{}')}catch{return{}}}
function _save(v){try{localStorage.setItem('ntila_reactions',JSON.stringify(v));}catch{}}

const ReactionsDB = {
  get(topicId){
    return _obj()[topicId]||{likes:0,dislikes:0};
  },
  toggle(topicId,type){
    const all=_obj();
    const r=all[topicId]||{likes:0,dislikes:0};
    const key=`ntila_reacted_${topicId}`;
    const prev=localStorage.getItem(key);
    if(prev==='like')    r.likes=Math.max(0,(r.likes||0)-1);
    if(prev==='dislike') r.dislikes=Math.max(0,(r.dislikes||0)-1);
    if(prev!==type){
      if(type==='like')    r.likes=(r.likes||0)+1;
      if(type==='dislike') r.dislikes=(r.dislikes||0)+1;
      localStorage.setItem(key,type);
    } else {
      localStorage.removeItem(key);
    }
    all[topicId]=r; _save(all);
    const evt=`ntila_reactions_${topicId}`;
    _emit(evt,r); return r;
  },
  getUserVote(topicId){ return localStorage.getItem(`ntila_reacted_${topicId}`)||null; },
  listen(topicId,cb){
    const key=`ntila_reactions_${topicId}`; cb(this.get(topicId));
    if(!_cbs[key])_cbs[key]=[]; _cbs[key].push(cb);
    return()=>{_cbs[key]=_cbs[key].filter(f=>f!==cb);};
  },
  getAll(){
    try{return JSON.parse(localStorage.getItem('ntila_reactions')||'{}')}catch{return{}}
  }
};
global.ReactionsDB=ReactionsDB;
console.log('[ReactionsDB v1.0] ✅ Pronta');
})(window);
