/**
 * ═══════════════════════════════════════════════════════════════════
 *  NTILA ESTUDOS — BASE DE DADOS v3.0
 *  100% localStorage — Sem Firebase, sem internet, funciona em
 *  qualquer ambiente incluindo claudeusercontent.com
 *  Sincronização entre abas via BroadcastChannel + storage events
 * ═══════════════════════════════════════════════════════════════════
 *
 *  TABELAS (chaves localStorage):
 *  ┌─────────────────────────┬────────────────────────────────────┐
 *  │ ntila_topics            │ Temas publicados pelo admin        │
 *  │ ntila_comments_{id}     │ Comentários por tema               │
 *  │ ntila_reactions         │ Gostos/Não-Gostos por tema         │
 *  │ ntila_chat_{sid}        │ Mensagens de chat por sessão       │
 *  │ ntila_chat_sessions     │ Lista de sessões de chat           │
 *  │ ntila_ip_db             │ Registo de IPs                     │
 *  │ ntila_txs               │ Transacções e pagamentos           │
 *  │ ntila_analytics         │ Registo de acessos                 │
 *  │ ntila_adm_creds         │ Credenciais do administrador       │
 *  │ ntila_chat_sid          │ ID de sessão do utilizador         │
 *  └─────────────────────────┴────────────────────────────────────┘
 */

/* ── Prevenir redeclaração se o script for incluído duas vezes ── */
if (window.__NtilaDBLoaded) {
  console.log('[NtilaDB] Já inicializado — a ignorar redeclaração.');
} else {
window.__NtilaDBLoaded = true;

'use strict';

// ═══════════════════════════════════════════════════════════
//  CANAL DE SINCRONIZAÇÃO ENTRE ABAS (BroadcastChannel)
// ═══════════════════════════════════════════════════════════
const _BC = (typeof BroadcastChannel !== 'undefined')
  ? new BroadcastChannel('ntila_sync')
  : null;

const _listeners = {};   // { evento: [callbacks] }

function _emit(event, data) {
  if (_BC) _BC.postMessage({ event, data, ts: Date.now() });
  _triggerLocal(event, data);
}

function _triggerLocal(event, data) {
  (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e){} });
}

function _on(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
  return () => { _listeners[event] = _listeners[event].filter(f => f !== cb); };
}

if (_BC) {
  _BC.onmessage = ({ data: msg }) => {
    if (msg && msg.event) _triggerLocal(msg.event, msg.data);
  };
}

// ═══════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

function ntilaUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function ntilaFmt(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60)     return 'agora mesmo';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm atrás';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h atrás';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd atrás';
    return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(iso); }
}

function ntilaHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [u, d] = email.split('@');
  return u.slice(0, 2) + '***@' + d;
}

async function getClientIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    return (await r.json()).ip || 'unknown';
  } catch { return 'unknown'; }
}

// ═══════════════════════════════════════════════════════════
//  HELPERS localStorage
// ═══════════════════════════════════════════════════════════
function _get(key)      { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function _set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
function _arr(key)      { const v = _get(key); return Array.isArray(v) ? v : []; }
function _obj(key)      { const v = _get(key); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

// ═══════════════════════════════════════════════════════════
//  BASE DE DADOS PRINCIPAL — NtilaDB
// ═══════════════════════════════════════════════════════════
const NtilaDB = {

  // ══════════════════════════════════════
  //  TEMAS
  // ══════════════════════════════════════

  /** Guardar ou actualizar tema */
  async saveTopic(data) {
    const topics = _arr('ntila_topics');
    const topic = {
      id:             data.id || ntilaUID(),
      title:          data.title || '',
      slug:           (data.title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      coverImage:     data.coverImage || '',
      intro:          data.intro || '',
      content:        data.content || '',
      era:            data.era || '',
      tag:            data.tag || '',
      emoji:          data.emoji || '📖',
      order:          data.order ?? topics.length,
      allowComments:  data.allowComments !== false,
      allowReactions: data.allowReactions !== false,
      publishedAt:    data.publishedAt || new Date().toISOString(),
      updatedAt:      new Date().toISOString()
    };
    const idx = topics.findIndex(t => t.id === topic.id);
    if (idx >= 0) topics[idx] = topic; else topics.push(topic);
    topics.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    _set('ntila_topics', topics);
    _emit('topics_changed', topics);
    return topic;
  },

  /** Obter todos os temas */
  async getTopics() {
    return _arr('ntila_topics');
  },

  /** Obter tema por ID */
  async getTopic(id) {
    return _arr('ntila_topics').find(t => t.id === id) || null;
  },

  /** Eliminar tema */
  async deleteTopic(id) {
    const topics = _arr('ntila_topics').filter(t => t.id !== id);
    _set('ntila_topics', topics);
    _emit('topics_changed', topics);
  },

  /** Escutar alterações de temas em tempo real */
  listenTopics(cb) {
    cb(_arr('ntila_topics'));                    // emitir imediatamente
    return _on('topics_changed', cb);           // retorna função de cancelamento
  },

  // ══════════════════════════════════════
  //  REACÇÕES (GOSTOS / NÃO-GOSTOS)
  // ══════════════════════════════════════

  async getReactions(topicId) {
    const all = _obj('ntila_reactions');
    return all[topicId] || { likes: 0, dislikes: 0 };
  },

  async toggleReaction(topicId, type) {
    const all      = _obj('ntila_reactions');
    const r        = all[topicId] || { likes: 0, dislikes: 0 };
    const key      = `ntila_reacted_${topicId}`;
    const previous = localStorage.getItem(key);

    // Remover voto anterior
    if (previous === 'like')    r.likes    = Math.max(0, (r.likes    || 0) - 1);
    if (previous === 'dislike') r.dislikes = Math.max(0, (r.dislikes || 0) - 1);

    // Adicionar ou remover novo voto
    if (previous !== type) {
      if (type === 'like')    r.likes++;
      if (type === 'dislike') r.dislikes++;
      localStorage.setItem(key, type);
    } else {
      localStorage.removeItem(key);
    }

    all[topicId] = r;
    _set('ntila_reactions', all);
    _emit('reactions_' + topicId, r);
    return r;
  },

  getUserReaction(topicId) {
    return localStorage.getItem(`ntila_reacted_${topicId}`) || null;
  },

  listenReactions(topicId, cb) {
    this.getReactions(topicId).then(cb);
    return _on('reactions_' + topicId, cb);
  },

  // ══════════════════════════════════════
  //  COMENTÁRIOS
  // ══════════════════════════════════════

  async addComment(topicId, { name, email, text, parentId = null, isAdmin = false }) {
    const ip = await getClientIP();
    const comment = {
      id:          ntilaUID(),
      topicId,
      parentId:    parentId || null,
      name:        (name || 'Anónimo').trim(),
      email:       email || '',
      emailMasked: email ? maskEmail(email) : '',
      emailHash:   email ? ntilaHash(email) : '',
      text:        (text || '').trim(),
      likes:       0,
      likedBy:     [],
      isAdmin:     !!isAdmin,
      ip,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    };
    const key  = `ntila_comments_${topicId}`;
    const arr  = _arr(key);
    arr.unshift(comment);
    _set(key, arr);
    _emit('comments_' + topicId, arr);
    return comment;
  },

  async getComments(topicId, sortBy = 'recent') {
    const all = _arr(`ntila_comments_${topicId}`);
    const sorted = [...all];
    if (sortBy === 'recent')   sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sortBy === 'oldest')   sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sortBy === 'relevant') sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return sorted;
  },

  async likeComment(topicId, commentId) {
    const key     = `ntila_comments_${topicId}`;
    const arr     = _arr(key);
    const item    = arr.find(c => c.id === commentId);
    if (!item) return false;
    const likedKey = `ntila_comment_liked_${commentId}`;
    const liked    = localStorage.getItem(likedKey) === '1';
    item.likes = liked ? Math.max(0, (item.likes || 0) - 1) : (item.likes || 0) + 1;
    localStorage.setItem(likedKey, liked ? '0' : '1');
    _set(key, arr);
    _emit('comments_' + topicId, arr);
    return !liked;
  },

  isCommentLiked(commentId) {
    return localStorage.getItem(`ntila_comment_liked_${commentId}`) === '1';
  },

  async deleteComment(topicId, commentId) {
    const key = `ntila_comments_${topicId}`;
    const arr = _arr(key).filter(c => c.id !== commentId && c.parentId !== commentId);
    _set(key, arr);
    _emit('comments_' + topicId, arr);
  },

  listenComments(topicId, cb, sortBy = 'recent') {
    this.getComments(topicId, sortBy).then(cb);
    return _on('comments_' + topicId, data => {
      const sorted = [...data];
      if (sortBy === 'recent')   sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (sortBy === 'oldest')   sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (sortBy === 'relevant') sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      cb(sorted);
    });
  },

  // ══════════════════════════════════════
  //  CHAT UTILIZADOR ↔ ADMINISTRADOR
  // ══════════════════════════════════════

  getChatSessionId() {
    let sid = localStorage.getItem('ntila_chat_sid');
    if (!sid) { sid = ntilaUID(); localStorage.setItem('ntila_chat_sid', sid); }
    return sid;
  },

  newChatSession() {
    const sid = ntilaUID();
    localStorage.setItem('ntila_chat_sid', sid);
    return sid;
  },

  async sendChatMessage(sessionId, { text, sender = 'user', name = '' }) {
    const ip = await getClientIP();
    const msg = {
      id:        ntilaUID(),
      sessionId,
      text:      (text || '').trim(),
      sender,
      name:      name || (sender === 'admin' ? 'Administrador' : 'Utilizador'),
      ip,
      createdAt: new Date().toISOString(),
      read:      false
    };

    // Guardar mensagem na sessão
    const key = `ntila_chat_${sessionId}`;
    const arr = _arr(key);
    arr.push(msg);
    _set(key, arr);

    // Actualizar lista de sessões
    const sessions = _arr('ntila_chat_sessions');
    const si = sessions.findIndex(s => s.sessionId === sessionId);
    const sData = {
      sessionId,
      lastMessage:  text.slice(0, 60),
      lastActivity: msg.createdAt,
      userName:     name || msg.name,
      ip,
      unread:       sender === 'user'
        ? ((si >= 0 ? sessions[si].unread : 0) || 0) + 1
        : 0
    };
    if (si >= 0) sessions[si] = sData; else sessions.unshift(sData);
    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    _set('ntila_chat_sessions', sessions);

    _emit('chat_' + sessionId, arr);
    _emit('chat_sessions', sessions);
    return msg;
  },

  listenChat(sessionId, cb) {
    cb(_arr(`ntila_chat_${sessionId}`));
    return _on('chat_' + sessionId, cb);
  },

  async getChatSessions() {
    return _arr('ntila_chat_sessions');
  },

  listenChatSessions(cb) {
    cb(_arr('ntila_chat_sessions'));
    return _on('chat_sessions', cb);
  },

  async markChatRead(sessionId) {
    const sessions = _arr('ntila_chat_sessions');
    const s = sessions.find(x => x.sessionId === sessionId);
    if (s) { s.unread = 0; _set('ntila_chat_sessions', sessions); }
  },

  // ══════════════════════════════════════
  //  REGISTO DE IPs & ANTIFRAUDE
  // ══════════════════════════════════════

  async registerIP(ip, action = 'visit') {
    if (!ip || ip === 'unknown') return;
    const db  = _arr('ntila_ip_db');
    const now = new Date().toISOString();
    const ex  = db.find(r => r.ip === ip);
    if (ex) {
      ex.visits   = (ex.visits || 0) + 1;
      ex.lastSeen = now;
      ex.actions  = [...(ex.actions || []).slice(-49), { action, ts: now }];
    } else {
      db.push({ ip, status: 'ok', visits: 1, actions: [{ action, ts: now }],
                firstSeen: now, lastSeen: now });
    }
    _set('ntila_ip_db', db);
    _emit('ip_registry', db);
  },

  async isBanned(ip) {
    return _arr('ntila_ip_db').some(r => r.ip === ip && r.status === 'banned');
  },

  async banIP(ip, reason = 'Manual') {
    const db  = _arr('ntila_ip_db');
    const now = new Date().toISOString();
    const ex  = db.find(r => r.ip === ip);
    if (ex) { ex.status = 'banned'; ex.reason = reason; ex.bannedAt = now; }
    else db.push({ ip, status: 'banned', reason, bannedAt: now,
                   visits: 1, firstSeen: now, lastSeen: now, actions: [] });
    _set('ntila_ip_db', db);
    _emit('ip_registry', db);
  },

  async unbanIP(ip) {
    const db = _arr('ntila_ip_db');
    const ex = db.find(r => r.ip === ip);
    if (ex) { ex.status = 'ok'; delete ex.reason; delete ex.bannedAt; }
    _set('ntila_ip_db', db);
    _emit('ip_registry', db);
  },

  async getIPRegistry() {
    return _arr('ntila_ip_db');
  },

  listenIPRegistry(cb) {
    cb(_arr('ntila_ip_db'));
    return _on('ip_registry', cb);
  },

  async checkFraudRisk(ip) {
    const db     = _arr('ntila_ip_db');
    const record = db.find(r => r.ip === ip);
    if (!record) return { risk: 'low', banned: false, failedAttempts: 0 };
    const recentFails = (record.actions || []).filter(a => {
      return a.action === 'payment_failed' &&
             (Date.now() - new Date(a.ts)) / 1000 / 60 < 30;
    });
    if (recentFails.length >= 3) {
      await this.banIP(ip, `Auto-ban: ${recentFails.length} falhas em 30 min`);
      return { risk: 'high', banned: true, failedAttempts: recentFails.length };
    }
    return {
      risk: recentFails.length >= 1 ? 'medium' : 'low',
      banned: false,
      failedAttempts: recentFails.length
    };
  },

  // ══════════════════════════════════════
  //  TRANSACÇÕES & PAGAMENTOS
  // ══════════════════════════════════════

  async addTransaction({ method, phone, amount, currency = 'MZN', product, status, ip = '' }) {
    const tx = {
      id:        'TXN-' + ntilaUID().toUpperCase(),
      method, amount, currency, product, status,
      phone:     phone ? '***' + String(phone).slice(-4) : '',
      ip,
      timestamp: new Date().toISOString(),
      date:      new Date().toISOString().slice(0, 10)
    };
    const arr = _arr('ntila_txs');
    arr.unshift(tx);
    _set('ntila_txs', arr);
    _emit('transactions', arr);

    // Registar acção de IP para antifraude
    if (ip) {
      await this.registerIP(ip, status === 'failed' ? 'payment_failed' : 'payment_ok');
      await this.checkFraudRisk(ip);
    }
    return tx;
  },

  async getTransactions(filter = {}) {
    let txs = _arr('ntila_txs');
    if (filter.days && filter.days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - filter.days);
      txs = txs.filter(t => new Date(t.timestamp) >= since);
    }
    return txs;
  },

  async getTransactionsByIP(ip) {
    return _arr('ntila_txs').filter(t => t.ip === ip);
  },

  // ══════════════════════════════════════
  //  ANALYTICS / TRÁFEGO
  // ══════════════════════════════════════

  async logPageView(page) {
    const ip  = await getClientIP();
    const now = new Date().toISOString();
    const arr = _arr('ntila_analytics');
    arr.push({ page, ip, timestamp: now, date: now.slice(0, 10) });
    // Guardar apenas os últimos 2000 registos
    if (arr.length > 2000) arr.splice(0, arr.length - 2000);
    _set('ntila_analytics', arr);
  },

  async getAnalytics(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - (days || 1));
    return _arr('ntila_analytics').filter(e => new Date(e.timestamp) >= since);
  },

  // ══════════════════════════════════════
  //  CREDENCIAIS ADMIN
  // ══════════════════════════════════════

  getCreds() {
    try {
      const raw = _get('ntila_adm_creds');
      return (raw && raw.user && raw.pass) ? raw : null;
    } catch { return null; }
  },

  saveCreds(user, pass) {
    _set('ntila_adm_creds', { user, pass });
  },

  // ══════════════════════════════════════
  //  EXPORTAÇÃO COMPLETA
  // ══════════════════════════════════════

  async exportAll() {
    const topics   = await this.getTopics();
    const txs      = await this.getTransactions();
    const ips      = await this.getIPRegistry();
    const analytics = await this.getAnalytics(365);
    const sessions = await this.getChatSessions();

    let totalComments = 0;
    const commentsByTopic = {};
    for (const t of topics) {
      const cs = await this.getComments(t.id);
      commentsByTopic[t.id] = cs;
      totalComments += cs.length;
    }

    return {
      exportedAt:      new Date().toISOString(),
      version:         '3.0',
      summary: {
        topics:        topics.length,
        totalComments,
        transactions:  txs.length,
        chatSessions:  sessions.length,
        ipRecords:     ips.length,
        bannedIPs:     ips.filter(i => i.status === 'banned').length,
        pageViews:     analytics.length
      },
      topics,
      commentsByTopic,
      transactions:    txs,
      chatSessions:    sessions,
      ipRegistry:      ips,
      analytics
    };
  },

  /** Limpar todos os dados (reset total) */
  clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ntila_'));
    keys.forEach(k => localStorage.removeItem(k));
    _emit('topics_changed', []);
    console.log('[NtilaDB] Base de dados limpa.');
  }
};

// ═══════════════════════════════════════════════════════════
//  EXPORTAÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════
window.NtilaDB     = NtilaDB;
window.ntilaFmt    = ntilaFmt;
window.ntilaUID    = ntilaUID;
window.ntilaHash   = ntilaHash;
window.maskEmail   = maskEmail;
window.getClientIP = getClientIP;

console.log('[NtilaDB v3.0] ✅ Inicializado — localStorage mode (sem Firebase)');

} // fim do guard __NtilaDBLoaded
