/**
 * ═══════════════════════════════════════════════
 *  NTILA — BASE DE DADOS DE COMENTÁRIOS v1.0
 *  localStorage  |  BroadcastChannel sync
 * ═══════════════════════════════════════════════
 */
;(function(global){
'use strict';
const BC = (typeof BroadcastChannel!=='undefined') ? new BroadcastChannel('ntila_comments_sync') : null;
const _cbs = {};
function _emit(k,d){ if(BC)BC.postMessage({k,d}); (_cbs[k]||[]).forEach(cb=>{try{cb(d);}catch(e){}}); }
if(BC) BC.onmessage=({data:m})=>{ if(m&&m.k) (_cbs[m.k]||[]).forEach(cb=>{try{cb(m.d);}catch(e){}}); };
function _arr(k){ try{return JSON.parse(localStorage.getItem(k)||'[]');}catch{return[];} }
function _save(k,v){ try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;} }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function maskEmail(e){ if(!e||!e.includes('@'))return e; const[u,d]=e.split('@'); return u.slice(0,2)+'***@'+d; }
async function getIP(){ try{return(await(await fetch('https://api.ipify.org?format=json')).json()).ip||'unknown';}catch{return'unknown';} }

const CommentsDB = {
  async add(topicId,{name,email,text,parentId=null,isAdmin=false}){
    const ip=await getIP();
    const c={id:uid(),topicId,parentId:parentId||null,name:(name||'Anónimo').trim(),
      email:email||'',emailMasked:email?maskEmail(email):'',text:(text||'').trim(),
      likes:0,isAdmin:!!isAdmin,ip,createdAt:new Date().toISOString()};
    const key=`ntila_comments_${topicId}`;
    const arr=_arr(key); arr.unshift(c); _save(key,arr); _emit(key,arr); return c;
  },
  get(topicId,sort='recent'){
    const arr=[..._arr(`ntila_comments_${topicId}`)];
    if(sort==='recent')  arr.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(sort==='oldest')  arr.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    if(sort==='relevant')arr.sort((a,b)=>(b.likes||0)-(a.likes||0));
    return arr;
  },
  like(topicId,commentId){
    const key=`ntila_comments_${topicId}`,arr=_arr(key),item=arr.find(c=>c.id===commentId);
    if(!item)return false;
    const lk=`ntila_clk_${commentId}`,liked=localStorage.getItem(lk)==='1';
    item.likes=liked?Math.max(0,(item.likes||0)-1):(item.likes||0)+1;
    localStorage.setItem(lk,liked?'0':'1'); _save(key,arr); _emit(key,arr); return !liked;
  },
  isLiked(cid){ return localStorage.getItem(`ntila_clk_${cid}`)==='1'; },
  delete(topicId,commentId){
    const key=`ntila_comments_${topicId}`;
    const arr=_arr(key).filter(c=>c.id!==commentId&&c.parentId!==commentId);
    _save(key,arr); _emit(key,arr);
  },
  listen(topicId,cb,sort='recent'){
    const key=`ntila_comments_${topicId}`; cb(this.get(topicId,sort));
    const fn=(d)=>cb([...d].sort((a,b)=>sort==='oldest'?new Date(a.createdAt)-new Date(b.createdAt):sort==='relevant'?(b.likes||0)-(a.likes||0):new Date(b.createdAt)-new Date(a.createdAt)));
    if(!_cbs[key])_cbs[key]=[]; _cbs[key].push(fn);
    return ()=>{ _cbs[key]=_cbs[key].filter(f=>f!==fn); };
  },
  getAll(){
    let all=[];
    Object.keys(localStorage).filter(k=>k.startsWith('ntila_comments_'))
      .forEach(k=>{try{all=all.concat(JSON.parse(localStorage.getItem(k)||'[]'));}catch{}});
    return all.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },
  countAll(){
    return Object.keys(localStorage).filter(k=>k.startsWith('ntila_comments_'))
      .reduce((s,k)=>{try{return s+(JSON.parse(localStorage.getItem(k)||'[]').length);}catch{return s;}},0);
  }
};
global.CommentsDB=CommentsDB;
console.log('[CommentsDB v1.0] ✅ Pronta');
})(window);
