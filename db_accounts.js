/**
 * ═══════════════════════════════════════════════════════
 *  NTILA — BASE DE DADOS DE CONTAS v1.0
 *  Admins, convites, permissões, código de aprovação
 * ═══════════════════════════════════════════════════════
 */
;(function(global){
'use strict';

function _get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}}
function _set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function _arr(k){const v=_get(k);return Array.isArray(v)?v:[];}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function now(){return new Date().toISOString();}

// Conta principal (imutável)
const SUPER_ADMIN = {
  id: 'super',
  name: 'Fernando Ntila',
  username: 'admin',
  role: 'super_admin',
  createdAt: '2025-05-23T00:00:00.000Z',
  permissions: ['all']
};

// Código de aprovação (rotativo — cada uso invalida o código)
const APPROVAL_CODES_KEY = 'ntila_approval_codes';
const ACCOUNTS_KEY       = 'ntila_admin_accounts';
const PENDING_KEY        = 'ntila_pending_accounts';
const INVITES_KEY        = 'ntila_invite_links';
const PENDING_IPS_KEY    = 'ntila_pending_ips';

// Permissões disponíveis
const ALL_PERMISSIONS = [
  { id: 'view_topics',      label: 'Ver Matérias' },
  { id: 'manage_topics',    label: 'Gerir Matérias' },
  { id: 'view_comments',    label: 'Ver Comentários' },
  { id: 'manage_comments',  label: 'Moderar Comentários' },
  { id: 'view_chats',       label: 'Ver Chats' },
  { id: 'reply_chats',      label: 'Responder Chats' },
  { id: 'view_stats',       label: 'Ver Estatísticas' },
  { id: 'view_security',    label: 'Ver Segurança' },
  { id: 'manage_security',  label: 'Gerir Segurança (Ban/Unban)' },
];

// ─── Primeiro arranque: inicializar código padrão ───
(function init(){
  const codes = _arr(APPROVAL_CODES_KEY);
  if(codes.length===0){
    // Código inicial definido pelo proprietário
    _set(APPROVAL_CODES_KEY, [
      {code:'851917', used:false, usedBy:null, createdAt:now()}
    ]);
  }
  // Garantir que super admin existe
  const accounts = _arr(ACCOUNTS_KEY);
  if(!accounts.find(a=>a.id==='super')){
    accounts.unshift(SUPER_ADMIN);
    _set(ACCOUNTS_KEY, accounts);
  }
})();

const AccountsDB = {

  MAX_ACCOUNTS: 10,  // Máximo de 10 contas (excluindo super admin)

  // ── CONTAS ──────────────────────────────────────────
  getAccounts(){
    return _arr(ACCOUNTS_KEY);
  },

  getAccount(id){
    return _arr(ACCOUNTS_KEY).find(a=>a.id===id)||null;
  },

  getAccountByUsername(username){
    return _arr(ACCOUNTS_KEY).find(a=>a.username===username)||null;
  },

  saveAccount(account){
    const accounts = _arr(ACCOUNTS_KEY);
    const idx = accounts.findIndex(a=>a.id===account.id);
    if(idx>=0) accounts[idx]=account;
    else accounts.push(account);
    _set(ACCOUNTS_KEY, accounts);
    return account;
  },

  deleteAccount(id){
    if(id==='super') return false; // Super admin não pode ser eliminado
    const accounts = _arr(ACCOUNTS_KEY).filter(a=>a.id!==id);
    _set(ACCOUNTS_KEY, accounts);
    // Limpar sessão se activa
    if(localStorage.getItem('ntila_admin_session_id')===id){
      localStorage.removeItem('ntila_admin_session_id');
    }
    return true;
  },

  updatePermissions(id, permissions){
    if(id==='super') return false;
    const accounts = _arr(ACCOUNTS_KEY);
    const acc = accounts.find(a=>a.id===id);
    if(!acc) return false;
    acc.permissions = permissions;
    acc.updatedAt = now();
    _set(ACCOUNTS_KEY, accounts);
    return true;
  },

  promoteAccount(id, newRole){
    const accounts = _arr(ACCOUNTS_KEY);
    const acc = accounts.find(a=>a.id===id);
    if(!acc||id==='super') return false;
    acc.role = newRole;
    acc.updatedAt = now();
    _set(ACCOUNTS_KEY, accounts);
    return true;
  },

  countNonSuper(){
    return _arr(ACCOUNTS_KEY).filter(a=>a.id!=='super'&&a.status==='active').length;
  },

  // ── CONTAS PENDENTES (aguardam aprovação) ──────────
  getPending(){
    return _arr(PENDING_KEY);
  },

  getPendingByIP(ip){
    return _arr(PENDING_KEY).find(p=>p.ip===ip&&p.status==='waiting')||null;
  },

  savePending(data){
    const pending = _arr(PENDING_KEY);
    const idx = pending.findIndex(p=>p.id===data.id);
    if(idx>=0) pending[idx]=data;
    else pending.push(data);
    _set(PENDING_KEY, pending);
    return data;
  },

  approvePending(pendingId, username, password){
    const pending = _arr(PENDING_KEY);
    const p = pending.find(x=>x.id===pendingId);
    if(!p) return null;

    // Verificar vagas
    if(this.countNonSuper() >= this.MAX_ACCOUNTS) return null;

    const account = {
      id:          uid(),
      pendingId:   pendingId,
      name:        p.name,
      username,
      password:    btoa(password), // codificação simples
      email:       p.email,
      phone:       p.phone,
      birthdate:   p.birthdate,
      ip:          p.ip,
      role:        'moderator',
      permissions: ['view_topics','view_comments','view_chats','reply_chats'],
      status:      'active',
      inviteCode:  p.inviteCode,
      createdAt:   now(),
      approvedAt:  now()
    };

    // Marcar pending como aprovado
    p.status = 'approved';
    p.approvedAt = now();
    p.accountId = account.id;
    _set(PENDING_KEY, pending);

    this.saveAccount(account);
    return account;
  },

  rejectPending(pendingId){
    const pending = _arr(PENDING_KEY);
    const p = pending.find(x=>x.id===pendingId);
    if(p){ p.status='rejected'; p.rejectedAt=now(); }
    _set(PENDING_KEY, pending);
  },

  // ── CÓDIGOS DE APROVAÇÃO ────────────────────────────
  validateCode(code){
    const codes = _arr(APPROVAL_CODES_KEY);
    const c = codes.find(x=>x.code===code&&!x.used);
    return !!c;
  },

  useCode(code, usedBy){
    const codes = _arr(APPROVAL_CODES_KEY);
    const c = codes.find(x=>x.code===code&&!x.used);
    if(!c) return false;
    c.used=true; c.usedBy=usedBy; c.usedAt=now();
    _set(APPROVAL_CODES_KEY, codes);
    return true;
  },

  addCode(code){
    const codes = _arr(APPROVAL_CODES_KEY);
    if(codes.find(x=>x.code===code)) return false; // já existe
    codes.push({code, used:false, usedBy:null, createdAt:now()});
    _set(APPROVAL_CODES_KEY, codes);
    return true;
  },

  getCodes(){
    return _arr(APPROVAL_CODES_KEY);
  },

  // ── LINKS DE CONVITE ────────────────────────────────
  generateInvite(createdBy='super'){
    const invites = _arr(INVITES_KEY);
    const token = uid()+uid();
    const invite = {
      id:        uid(),
      token,
      url:       `${location.origin}${location.pathname}?invite=${token}`,
      createdBy,
      used:      false,
      usedBy:    null,
      createdAt: now(),
      expiresAt: new Date(Date.now()+7*24*3600*1000).toISOString() // 7 dias
    };
    invites.push(invite);
    _set(INVITES_KEY, invites);
    return invite;
  },

  validateInvite(token){
    const inv = _arr(INVITES_KEY).find(i=>i.token===token);
    if(!inv||inv.used) return false;
    if(new Date(inv.expiresAt)<new Date()) return false;
    return inv;
  },

  useInvite(token, usedBy){
    const invites = _arr(INVITES_KEY);
    const inv = invites.find(i=>i.token===token);
    if(!inv) return false;
    inv.used=true; inv.usedBy=usedBy; inv.usedAt=now();
    _set(INVITES_KEY, invites);
    return true;
  },

  getInvites(){
    return _arr(INVITES_KEY);
  },

  deleteInvite(id){
    _set(INVITES_KEY, _arr(INVITES_KEY).filter(i=>i.id!==id));
  },

  // ── RASTREIO DE IPs EM ESPERA ───────────────────────
  saveIPProgress(ip, data){
    const ips = _get(PENDING_IPS_KEY)||{};
    ips[ip.replace(/\./g,'_')] = {...data, ip, savedAt:now()};
    _set(PENDING_IPS_KEY, ips);
  },

  getIPProgress(ip){
    const ips = _get(PENDING_IPS_KEY)||{};
    return ips[ip.replace(/\./g,'_')]||null;
  },

  clearIPProgress(ip){
    const ips = _get(PENDING_IPS_KEY)||{};
    delete ips[ip.replace(/\./g,'_')];
    _set(PENDING_IPS_KEY, ips);
  },

  // ── AUTENTICAÇÃO ────────────────────────────────────
  login(username, password){
    const accounts = _arr(ACCOUNTS_KEY);
    const acc = accounts.find(a=>
      a.username===username &&
      (a.id==='super'
        ? (password==='ntila2025'||btoa(password)===a.password)
        : btoa(password)===a.password
      ) &&
      (a.status==='active'||a.id==='super')
    );
    if(!acc) return null;
    const session = {id:acc.id, role:acc.role, permissions:acc.permissions, loginAt:now()};
    _set('ntila_admin_session', session);
    return session;
  },

  logout(){
    localStorage.removeItem('ntila_admin_session');
  },

  getSession(){
    return _get('ntila_admin_session');
  },

  hasPermission(perm){
    const s = this.getSession();
    if(!s) return false;
    if(s.role==='super_admin') return true;
    return (s.permissions||[]).includes(perm)||s.permissions==='all';
  },

  isSuperAdmin(){
    const s = this.getSession();
    return s&&s.role==='super_admin';
  },

  // ── RESET TOTAL ─────────────────────────────────────
  resetAll(confirmPass){
    if(confirmPass!=='ntila2025') return false;
    const keysToKeep = ['ntila_admin_accounts','ntila_approval_codes'];
    Object.keys(localStorage)
      .filter(k=>k.startsWith('ntila_')&&!keysToKeep.includes(k))
      .forEach(k=>localStorage.removeItem(k));
    return true;
  },

  changePassword(currentPass, newPass){
    if(currentPass!=='ntila2025'&&btoa(currentPass)!==(_get('ntila_adm_creds')||{}).pass) return false;
    _set('ntila_adm_creds',{user:'admin',pass:btoa(newPass)});
    // Actualizar na conta super
    const accounts = _arr(ACCOUNTS_KEY);
    const super_acc = accounts.find(a=>a.id==='super');
    if(super_acc){ super_acc.password=btoa(newPass); _set(ACCOUNTS_KEY,accounts); }
    return true;
  },

  getAllPermissions(){ return ALL_PERMISSIONS; }
};

global.AccountsDB = AccountsDB;
console.log('[AccountsDB v1.0] ✅ Pronta');
})(window);
