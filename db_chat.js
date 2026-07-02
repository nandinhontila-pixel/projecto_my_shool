/**
 * ═══════════════════════════════════════════════
 *  NTILA — BASE DE DADOS DE CHAT v1.0
 *  localStorage  |  BroadcastChannel sync
 * ═══════════════════════════════════════════════
 */
;(function(global){
'use strict';
const BC=(typeof BroadcastChannel!=='undefined')?new BroadcastChannel('ntila_chat_sync'):null;
const _cbs={};
function _emit(k,d){if(BC)BC.postMessage({k,d});(_cbs[k]||[]).forEach(cb=>{try{cb(d);}catch(e){}});}
if(BC)BC.onmessage=({data:m})=>{if(m&&m.k)(_cbs[m.k]||[]).forEach(cb=>{try{cb(m.d);}catch(e){}});};
function _arr(k){try{return JSON.parse(localStorage.getItem(k)||'[]');}catch{return[];}}
function _obj(k){try{const v=JSON.parse(localStorage.getItem(k)||'{}');return(v&&typeof v==='object'&&!Array.isArray(v))?v:{};}catch{return{};}}
function _save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
async function getIP(){try{return(await(await fetch('https://api.ipify.org?format=json')).json()).ip||'unknown';}catch{return'unknown';}}

const ChatDB = {
  getSessionId(){
    let sid=localStorage.getItem('ntila_chat_sid');
    if(!sid){sid=uid();localStorage.setItem('ntila_chat_sid',sid);}
    return sid;
  },
  newSession(){
    const sid=uid(); localStorage.setItem('ntila_chat_sid',sid); return sid;
  },
  async send(sessionId,{text,sender='user',name=''}){
    const ip=await getIP();
    const msg={id:uid(),sessionId,text:(text||'').trim(),sender,
      name:name||(sender==='admin'?'Administrador':'Utilizador'),ip,
      createdAt:new Date().toISOString(),read:false};
    const key=`ntila_chat_${sessionId}`;
    const arr=_arr(key); arr.push(msg); _save(key,arr);
    // Actualizar sessões
    const sessions=_arr('ntila_chat_sessions');
    const si=sessions.findIndex(s=>s.sessionId===sessionId);
    const sd={sessionId,lastMessage:text.slice(0,60),lastActivity:msg.createdAt,
      userName:name||msg.name,ip,
      unread:sender==='user'?((si>=0?sessions[si].unread:0)||0)+1:0};
    if(si>=0)sessions[si]=sd; else sessions.unshift(sd);
    sessions.sort((a,b)=>new Date(b.lastActivity)-new Date(a.lastActivity));
    _save('ntila_chat_sessions',sessions);
    _emit(key,arr); _emit('ntila_chat_sessions',sessions);
    return msg;
  },
  getMessages(sessionId){ return _arr(`ntila_chat_${sessionId}`); },
  getSessions(){ return _arr('ntila_chat_sessions'); },
  listen(sessionId,cb){
    const key=`ntila_chat_${sessionId}`; cb(_arr(key));
    if(!_cbs[key])_cbs[key]=[]; _cbs[key].push(cb);
    return()=>{_cbs[key]=_cbs[key].filter(f=>f!==cb);};
  },
  listenSessions(cb){
    const key='ntila_chat_sessions'; cb(_arr(key));
    if(!_cbs[key])_cbs[key]=[]; _cbs[key].push(cb);
    return()=>{_cbs[key]=_cbs[key].filter(f=>f!==cb);};
  },
  markRead(sessionId){
    const sessions=_arr('ntila_chat_sessions');
    const s=sessions.find(x=>x.sessionId===sessionId);
    if(s){s.unread=0;_save('ntila_chat_sessions',sessions);}
  },
  deleteSession(sessionId){
    localStorage.removeItem(`ntila_chat_${sessionId}`);
    const sessions=_arr('ntila_chat_sessions').filter(s=>s.sessionId!==sessionId);
    _save('ntila_chat_sessions',sessions);
    _emit('ntila_chat_sessions',sessions);
  }
};
global.ChatDB=ChatDB;
console.log('[ChatDB v1.0] ✅ Pronta');
})(window);
