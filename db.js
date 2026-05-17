/**
 * ═══════════════════════════════════════════════════════════
 *  NTILA MARKETING — BASE DE DADOS CENTRALIZADA
 *  db.js  |  Versão 1.0  |  Partilhado entre site e admin
 * ═══════════════════════════════════════════════════════════
 *
 *  Armazenamento: localStorage (client-side)
 *  Encriptação:   AES-256-GCM via Web Crypto API (chats)
 *                 XOR+Base64 (legado, sessões antigas)
 *
 *  Tabelas (chaves localStorage):
 *  ┌─────────────────────┬──────────────────────────────────┐
 *  │ sgm_receipts        │ Recibos de pagamentos            │
 *  │ sgm_comments        │ Comentários dos utilizadores     │
 *  │ sgm_ip_db           │ Registo de endereços IP          │
 *  │ sgm_txs             │ Transacções e tentativas fraude  │
 *  │ sgm_proofs          │ Comprovativos de pagamento       │
 *  │ sgm_downloads       │ Registo de downloads             │
 *  │ sgm_likes           │ Contador de gostos               │
 *  │ sgm_liked           │ Estado like do utilizador actual │
 *  │ adm_dl_perms        │ Permissões de download (admin)   │
 *  │ adm_creds           │ Credenciais do administrador     │
 *  │ adm_e2e_k           │ Chave AES-256 do admin           │
 *  │ sgm_chat_{id}       │ Mensagens do chat (XOR)          │
 *  │ sgm_chat_meta_{id}  │ Metadata da sessão de chat       │
 *  │ adm_chat_{id}       │ Respostas do admin (AES-256-GCM) │
 *  │ sgm_dl_perm_change  │ Canal de notificação admin→site  │
 *  │ adm_reply_{id}      │ Canal de notificação admin→chat  │
 *  └─────────────────────┴──────────────────────────────────┘
 */

'use strict';

// ═══════════════════════════════════════════════════════════
//   ENCRIPTAÇÃO AES-256-GCM (ponta-a-ponta para chats)
// ═══════════════════════════════════════════════════════════
const NtilaE2E = {
  _key: null,

  /** Obter ou gerar chave AES-256 persistente */
  async key() {
    if (this._key) return this._key;
    try {
      const stored = localStorage.getItem('adm_e2e_k');
      if (stored) {
        const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        this._key = await crypto.subtle.importKey(
          'raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
        );
      } else {
        this._key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
        );
        const raw = await crypto.subtle.exportKey('raw', this._key);
        localStorage.setItem('adm_e2e_k',
          btoa(String.fromCharCode(...new Uint8Array(raw)))
        );
      }
    } catch (e) {
      console.warn('E2E key error:', e);
    }
    return this._key;
  },

  /** Encriptar texto → base64 (IV + ciphertext) */
  async encrypt(text) {
    try {
      const k = await this.key();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)
      );
      const out = new Uint8Array(12 + ct.byteLength);
      out.set(iv); out.set(new Uint8Array(ct), 12);
      return btoa(String.fromCharCode(...out));
    } catch {
      return btoa(unescape(encodeURIComponent(text)));
    }
  },

  /** Desencriptar base64 → texto */
  async decrypt(b64) {
    try {
      const k = await this.key();
      const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12)
      );
      return new TextDecoder().decode(plain);
    } catch {
      try { return decodeURIComponent(escape(atob(b64))); } catch { return b64; }
    }
  }
};

// ═══════════════════════════════════════════════════════════
//   ENCRIPTAÇÃO XOR (legado — sessões antigas do site)
// ═══════════════════════════════════════════════════════════
function ntilaXorDecrypt(enc, key = 'SGM2025') {
  try {
    const s = decodeURIComponent(escape(atob(enc)));
    let r = '';
    for (let i = 0; i < s.length; i++)
      r += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return r;
  } catch { return '[ENCRIPTADO]'; }
}

async function ntilaXorEncrypt(str, key = 'SGM2025') {
  let r = '';
  for (let i = 0; i < str.length; i++)
    r += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return btoa(unescape(encodeURIComponent(r)));
}

// ═══════════════════════════════════════════════════════════
//   UTILITÁRIOS
// ═══════════════════════════════════════════════════════════
function ntilaSimpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function ntilaFmt(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('pt', { day: '2-digit', month: 'short' })
      + ' ' + d.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ═══════════════════════════════════════════════════════════
//   BASE DE DADOS PRINCIPAL — NtilaDB
// ═══════════════════════════════════════════════════════════
const NtilaDB = {

  /* ── Helpers internos ── */
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },
  _set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('NtilaDB._set error:', e); }
  },
  _getObj(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  },

  /* ════════════════════════════════
     GOSTOS (LIKES)
  ════════════════════════════════ */
  getLikes() { return parseInt(localStorage.getItem('sgm_likes') || '0'); },
  setLikes(n) { localStorage.setItem('sgm_likes', String(n)); },
  isLiked()   { return localStorage.getItem('sgm_liked') === '1'; },
  setLiked(v) { localStorage.setItem('sgm_liked', v ? '1' : '0'); },

  toggleLike() {
    const liked  = !this.isLiked();
    const count  = liked ? this.getLikes() + 1 : Math.max(0, this.getLikes() - 1);
    this.setLiked(liked);
    this.setLikes(count);
    return { liked, count };
  },

  /* ════════════════════════════════
     COMENTÁRIOS
  ════════════════════════════════ */
  getComments() { return this._get('sgm_comments'); },

  addComment({ email, text }) {
    const arr = this.getComments();
    const comment = {
      id:           Date.now(),
      email:        email,
      emailDisplay: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      emailHash:    btoa(email).replace(/=/g, ''),
      text:         text,
      date:         new Date().toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    arr.unshift(comment);
    this._set('sgm_comments', arr);
    return comment;
  },

  deleteComment(index) {
    const arr = this.getComments();
    arr.splice(index, 1);
    this._set('sgm_comments', arr);
  },

  /* ════════════════════════════════
     IPs
  ════════════════════════════════ */
  getIPs()      { return this._get('sgm_ip_db'); },
  saveIPs(data) { this._set('sgm_ip_db', data); },

  registerIP(ip, status = 'ok') {
    const db  = this.getIPs();
    const now = new Date().toISOString();
    const ex  = db.find(r => r.ip === ip);
    if (ex) {
      ex.visits   = (ex.visits || 0) + 1;
      ex.lastSeen = now;
      if (status !== 'ok') ex.status = status;
    } else {
      db.push({ ip, status, visits: 1, firstSeen: now, lastSeen: now });
    }
    this._set('sgm_ip_db', db);
  },

  isBanned(ip) { return this.getIPs().some(r => r.ip === ip && r.status === 'banned'); },

  banIP(ip, reason = 'Fraude') {
    const db = this.getIPs();
    const ex = db.find(r => r.ip === ip);
    if (ex) { ex.status = 'banned'; ex.bannedAt = new Date().toISOString(); ex.reason = reason; }
    else db.push({ ip, status: 'banned', reason, bannedAt: new Date().toISOString(), visits: 1, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() });
    this._set('sgm_ip_db', db);
  },

  /* ════════════════════════════════
     TRANSACÇÕES & RECIBOS
  ════════════════════════════════ */
  getTransactions() { return this._get('sgm_txs'); },
  saveTransactions(d) { this._set('sgm_txs', d); },
  getReceipts()     { return this._get('sgm_receipts'); },
  saveReceipts(d)   { this._set('sgm_receipts', d); },

  addTransaction({ method, phone, pin, amount, currency, product, status }) {
    const arr = this.getTransactions();
    const tx  = {
      method,
      phoneEncrypted: btoa(unescape(encodeURIComponent(phone + ':' + Date.now()))),
      pinHash:        (pin || '').split('').map(() => '*').join(''),
      amount,
      currency,
      product,
      status,
      timestamp: new Date().toISOString(),
      txId:      'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    };
    // PIN nunca guardado
    arr.push(tx);
    this._set('sgm_txs', arr);
    return tx;
  },

  addFraudAttempt({ buyerName, buyerPhone, numberEntered, expectedNumber, ip }) {
    const arr = this.getTransactions();
    arr.push({
      type:           'fraud_attempt',
      buyerName,
      buyerPhone,
      numberEntered,
      expectedNumber,
      ip:             btoa(unescape(encodeURIComponent(ip))),
      timestamp:      new Date().toISOString()
    });
    this._set('sgm_txs', arr);
  },

  addReceipt(data) {
    const arr = this.getReceipts();
    arr.push(data);
    this._set('sgm_receipts', arr);
  },

  /* ════════════════════════════════
     COMPROVATIVOS
  ════════════════════════════════ */
  getProofs()  { return this._get('sgm_proofs'); },

  addProof({ buyer, phone, method, imageDataUrl }) {
    const arr = this.getProofs();
    arr.push({
      id:          'PRF-' + Date.now(),
      buyer, phone, method, imageDataUrl,
      uploadedAt:  new Date().toISOString()
    });
    this._set('sgm_proofs', arr);
  },

  /* ════════════════════════════════
     DOWNLOADS
  ════════════════════════════════ */
  getDownloads()  { return this._get('sgm_downloads'); },

  addDownload({ receiptId, buyer, ip }) {
    const arr = this.getDownloads();
    arr.push({
      receiptId,
      buyer,
      ipEncrypted: btoa(unescape(encodeURIComponent(ip))),
      downloadedAt: new Date().toISOString()
    });
    this._set('sgm_downloads', arr);
  },

  /* ════════════════════════════════
     PERMISSÕES DE DOWNLOAD (admin)
  ════════════════════════════════ */
  getDownloadPerms() { return this._getObj('adm_dl_perms'); },

  setDownloadPerm(sessionId, granted) {
    const p = this.getDownloadPerms();
    p[sessionId] = { granted, grantedAt: granted ? new Date().toISOString() : null };
    this._set('adm_dl_perms', p);
    // Notificar site principal via localStorage
    localStorage.setItem('sgm_dl_perm_change',
      JSON.stringify({ sid: sessionId, granted, ts: Date.now() })
    );
  },

  hasDownloadPerm(sessionId) {
    return this.getDownloadPerms()[sessionId]?.granted === true;
  },

  /* ════════════════════════════════
     CHAT — SESSÕES
  ════════════════════════════════ */
  getChatSessions() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith('sgm_chat_') && !k.includes('_meta_'))
      .map(k => {
        const id   = k.replace('sgm_chat_', '');
        let   msgs = [];
        try {
          const raw = localStorage.getItem(k);
          msgs = raw ? JSON.parse(ntilaXorDecrypt(raw)) : [];
        } catch {}
        return { id, msgs, ...this.getChatMeta(id) };
      })
      .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
  },

  getChatMeta(id) {
    try { return JSON.parse(localStorage.getItem('sgm_chat_meta_' + id) || '{}'); }
    catch { return {}; }
  },

  saveChatMeta(id, meta) {
    localStorage.setItem('sgm_chat_meta_' + id, JSON.stringify(meta));
  },

  async saveChatMessage(sessionId, message) {
    const existing = localStorage.getItem('sgm_chat_' + sessionId);
    let msgs = [];
    try { msgs = existing ? JSON.parse(ntilaXorDecrypt(existing)) : []; } catch {}
    msgs.push(message);
    const encrypted = await ntilaXorEncrypt(JSON.stringify(msgs));
    localStorage.setItem('sgm_chat_' + sessionId, encrypted);
  },

  /* ════════════════════════════════
     CHAT — MENSAGENS ADMIN (E2E)
  ════════════════════════════════ */
  getAdminMessages(sessionId) {
    try { return JSON.parse(localStorage.getItem('adm_chat_' + sessionId) || '[]'); }
    catch { return []; }
  },

  async addAdminMessage(sessionId, text) {
    const msgs = this.getAdminMessages(sessionId);
    const enc  = await NtilaE2E.encrypt(text);
    const msg  = {
      id:      Date.now(),
      type:    'admin',
      enc,
      preview: text.slice(0, 40),
      time:    new Date().toISOString()
    };
    msgs.push(msg);
    localStorage.setItem('adm_chat_' + sessionId, JSON.stringify(msgs));
    // Notificar site
    localStorage.setItem('adm_reply_' + sessionId,
      JSON.stringify({ text: msg.preview, time: msg.time, ts: Date.now() })
    );
    return msg;
  },

  async getAdminMessagesDecrypted(sessionId) {
    const msgs = this.getAdminMessages(sessionId);
    const out  = [];
    for (const m of msgs) {
      const text = await NtilaE2E.decrypt(m.enc);
      out.push({ ...m, text });
    }
    return out;
  },

  /* ════════════════════════════════
     CREDENCIAIS ADMIN
  ════════════════════════════════ */
  getCreds() {
    try {
      const raw = localStorage.getItem('adm_creds');
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.user === 'string' && typeof p.pass === 'string'
          && p.user.length > 0 && p.pass.length > 0) return p;
      return null;
    } catch { return null; }
  },

  saveCreds(user, pass) {
    try { localStorage.setItem('adm_creds', JSON.stringify({ user, pass })); }
    catch (e) { console.error('saveCreds error:', e); }
  },

  resetCreds() {
    localStorage.removeItem('adm_creds');
  },

  /* ════════════════════════════════
     EXPORTAÇÃO
  ════════════════════════════════ */
  exportAll() {
    return {
      exportedAt:   new Date().toISOString(),
      version:      '1.0',
      receipts:     this.getReceipts(),
      comments:     this.getComments(),
      ips:          this.getIPs(),
      transactions: this.getTransactions(),
      proofs:       this.getProofs().map(p => ({ ...p, imageDataUrl: '[OMITIDO]' })),
      downloads:    this.getDownloads(),
      likes:        this.getLikes(),
      chatSessions: this.getChatSessions().map(s => ({
        id: s.id, buyerName: s.buyerName, buyerPhone: s.buyerPhone,
        messageCount: s.msgs.length, lastActivity: s.lastActivity
      }))
    };
  },

  exportReceiptsText() {
    const rs = this.getReceipts();
    let t = 'EXTRATO DE RECIBOS — NTILA MARKETING\n';
    t += '='.repeat(48) + '\n';
    t += 'Exportado: ' + new Date().toLocaleString('pt') + '\n';
    t += 'Total vendas: ' + rs.length + ' · Receita: ' + (rs.length * 150) + ' MZN\n';
    t += '='.repeat(48) + '\n\n';
    rs.forEach((r, i) => {
      t += '[' + (i + 1) + '] ' + (r.id || '—') + '\n';
      t += '    Comprador : ' + (r.buyer || '—') + '\n';
      t += '    Telefone  : ' + (r.phone || '—') + '\n';
      t += '    Metodo    : ' + (r.method || '—') + '\n';
      t += '    Valor     : ' + (r.amount || '150 MZN') + '\n';
      t += '    Data      : ' + (r.date || '—') + ' ' + (r.time || '') + '\n';
      t += '    Hash      : ' + (r.hash || '—') + '\n\n';
    });
    return t;
  },

  exportReceiptsCSV() {
    let c = 'ID,Comprador,Telefone,Metodo,Valor,Data,Status,Hash\n';
    this.getReceipts().forEach(r => {
      c += '"' + (r.id||'') + '","' + (r.buyer||'') + '","' + (r.phone||'')
        + '","' + (r.method||'') + '","' + (r.amount||'')
        + '","' + (r.date||'') + ' ' + (r.time||'')
        + '","' + (r.status||'') + '","' + (r.hash||'') + '"\n';
    });
    return c;
  },

  /* ════════════════════════════════
     LIMPEZA
  ════════════════════════════════ */
  clearBanned() {
    const db = this.getIPs();
    db.forEach(ip => { ip.status = 'ok'; delete ip.bannedAt; delete ip.reason; });
    this.saveIPs(db);
  },

  clearFraudRecords() {
    this.saveTransactions(this.getTransactions().filter(t => t.type !== 'fraud_attempt'));
  },

  clearAll() {
    const keys = [
      'sgm_receipts', 'sgm_comments', 'sgm_ip_db', 'sgm_txs',
      'sgm_proofs', 'sgm_downloads', 'sgm_likes', 'sgm_liked', 'adm_dl_perms'
    ];
    keys.forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage)
      .filter(k => k.startsWith('sgm_chat_') || k.startsWith('adm_chat_') || k.startsWith('sgm_chat_meta_'))
      .forEach(k => localStorage.removeItem(k));
  }
};

// Expor globalmente
window.NtilaDB  = NtilaDB;
window.NtilaE2E = NtilaE2E;
window.ntilaXorDecrypt  = ntilaXorDecrypt;
window.ntilaXorEncrypt  = ntilaXorEncrypt;
window.ntilaSimpleHash  = ntilaSimpleHash;
window.ntilaFmt         = ntilaFmt;

console.log('[NtilaDB] Base de dados inicializada. Versão 1.0');
