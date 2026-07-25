/**
 * ═══════════════════════════════════════════════════════
 *  NTILA — BASE DE DADOS DE CONTAS v2.0
 *  Firebase Firestore (escrita) + localStorage (sessão)
 *
 *  Coleções Firestore:
 *    ntila_accounts       → contas aprovadas
 *    ntila_pending        → pedidos em espera
 *    ntila_approval_codes → códigos de aprovação
 *    ntila_invites        → links de convite
 *    ntila_pending_ips    → rastreio de IPs
 *
 *  NOTA: getSession/hasPermission/logout continuam em
 *  localStorage porque são dados de sessão local.
 * ═══════════════════════════════════════════════════════
 */

// ── Importações Firebase (CDN modular) ─────────────────
import {
  collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// db vem do db.js (window.db = getFirestore(app))
// Garantir que db.js foi carregado antes deste ficheiro
if (!window.db) {
  console.error('[AccountsDB] ⚠️ window.db não encontrado. Certifica-te que db.js é carregado primeiro.');
}
const db = window.db;

// ── Utilitários locais ─────────────────────────────────
function _lGet(k)  { try { return JSON.parse(localStorage.getItem(k)||'null'); } catch { return null; } }
function _lSet(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function uid()     { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function now()     { return new Date().toISOString(); }

// ── Colecções Firestore ────────────────────────────────
const COL = {
  accounts : () => collection(db, 'ntila_accounts'),
  pending  : () => collection(db, 'ntila_pending'),
  codes    : () => collection(db, 'ntila_approval_codes'),
  invites  : () => collection(db, 'ntila_invites'),
  ips      : () => collection(db, 'ntila_pending_ips'),
};

// ── Super Admin (imutável — não vai para Firestore) ────
const SUPER_ADMIN = {
  id:          'super',
  name:        'Fernando Ntila',
  username:    'admin',
  role:        'super_admin',
  createdAt:   '2025-05-23T00:00:00.000Z',
  permissions: ['all']
};

// ── Permissões disponíveis ─────────────────────────────
const ALL_PERMISSIONS = [
  { id: 'view_topics',     label: 'Ver Matérias' },
  { id: 'manage_topics',   label: 'Gerir Matérias' },
  { id: 'view_comments',   label: 'Ver Comentários' },
  { id: 'manage_comments', label: 'Moderar Comentários' },
  { id: 'view_chats',      label: 'Ver Chats' },
  { id: 'reply_chats',     label: 'Responder Chats' },
  { id: 'view_stats',      label: 'Ver Estatísticas' },
  { id: 'view_security',   label: 'Ver Segurança' },
  { id: 'manage_security', label: 'Gerir Segurança (Ban/Unban)' },
];

// ── Primeiro arranque: garantir código padrão no Firestore ──
async function _ensureDefaultCode() {
  try {
    const snap = await getDocs(query(COL.codes(), where('code','==','851917')));
    if (snap.empty) {
      await addDoc(COL.codes(), {
        code: '851917', used: false, usedBy: null, createdAt: now()
      });
      console.log('[AccountsDB] Código padrão 851917 criado no Firestore.');
    }
  } catch(e) {
    console.warn('[AccountsDB] _ensureDefaultCode:', e.message);
  }
}
_ensureDefaultCode();

// ═══════════════════════════════════════════════════════
//  AccountsDB — API pública
// ═══════════════════════════════════════════════════════
const AccountsDB = {

  MAX_ACCOUNTS: 10,

  // ── CONTAS ──────────────────────────────────────────

  /** Devolve todas as contas (inclui SUPER_ADMIN sintético) */
  async getAccounts() {
    try {
      const snap = await getDocs(COL.accounts());
      const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Injectar super admin no topo (não está no Firestore)
      return [SUPER_ADMIN, ...accounts.filter(a => a.id !== 'super')];
    } catch(e) {
      console.error('[AccountsDB] getAccounts:', e.message);
      return [SUPER_ADMIN];
    }
  },

  /** Devolve uma conta pelo id */
  async getAccount(id) {
    if (id === 'super') return SUPER_ADMIN;
    try {
      const snap = await getDoc(doc(db, 'ntila_accounts', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch(e) {
      console.error('[AccountsDB] getAccount:', e.message);
      return null;
    }
  },

  /** Devolve conta pelo username */
  async getAccountByUsername(username) {
    if (username === 'admin') return SUPER_ADMIN;
    try {
      const snap = await getDocs(query(COL.accounts(), where('username','==',username)));
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch(e) {
      console.error('[AccountsDB] getAccountByUsername:', e.message);
      return null;
    }
  },

  /** Cria ou actualiza uma conta no Firestore */
  async saveAccount(account) {
    if (account.id === 'super') return account; // Super admin não vai para Firestore
    try {
      const id = account.id || uid();
      const data = { ...account, id, updatedAt: now() };
      await setDoc(doc(db, 'ntila_accounts', id), data);
      return data;
    } catch(e) {
      console.error('[AccountsDB] saveAccount:', e.message);
      return null;
    }
  },

  /** Elimina conta do Firestore */
  async deleteAccount(id) {
    if (id === 'super') return false;
    try {
      await deleteDoc(doc(db, 'ntila_accounts', id));
      // Limpar sessão local se for a conta activa
      const session = _lGet('ntila_admin_session');
      if (session && session.id === id) {
        localStorage.removeItem('ntila_admin_session');
      }
      return true;
    } catch(e) {
      console.error('[AccountsDB] deleteAccount:', e.message);
      return false;
    }
  },

  /** Actualiza as permissões de uma conta */
  async updatePermissions(id, permissions) {
    if (id === 'super') return false;
    try {
      await updateDoc(doc(db, 'ntila_accounts', id), {
        permissions, updatedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] updatePermissions:', e.message);
      return false;
    }
  },

  /** Promove conta para um novo role */
  async promoteAccount(id, newRole) {
    if (id === 'super') return false;
    try {
      await updateDoc(doc(db, 'ntila_accounts', id), {
        role: newRole, updatedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] promoteAccount:', e.message);
      return false;
    }
  },

  /** Conta contas activas (excluindo super) */
  async countNonSuper() {
    try {
      const snap = await getDocs(query(COL.accounts(), where('status','==','active')));
      return snap.size;
    } catch(e) {
      return 0;
    }
  },

  // ── CONTAS PENDENTES ────────────────────────────────

  /** Devolve todos os pedidos pendentes */
  async getPending() {
    try {
      const snap = await getDocs(COL.pending());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.error('[AccountsDB] getPending:', e.message);
      return [];
    }
  },

  /** Devolve pedido pendente pelo IP */
  async getPendingByIP(ip) {
    try {
      const snap = await getDocs(
        query(COL.pending(), where('ip','==',ip), where('status','==','waiting'))
      );
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch(e) {
      return null;
    }
  },

  /** Guarda ou actualiza pedido pendente */
  async savePending(data) {
    try {
      const id = data.id || uid();
      const payload = { ...data, id, updatedAt: now() };
      await setDoc(doc(db, 'ntila_pending', id), payload);
      return payload;
    } catch(e) {
      console.error('[AccountsDB] savePending:', e.message);
      return null;
    }
  },

  /** Aprova um pedido pendente e cria a conta */
  async approvePending(pendingId, username, password) {
    try {
      // Verificar vagas
      const count = await this.countNonSuper();
      if (count >= this.MAX_ACCOUNTS) return null;

      // Ler dados do pedido
      const pSnap = await getDoc(doc(db, 'ntila_pending', pendingId));
      if (!pSnap.exists()) return null;
      const p = pSnap.data();

      // Criar conta
      const accountId = uid();
      const account = {
        id:          accountId,
        pendingId,
        name:        p.name,
        username,
        password:    btoa(password),
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

      // Guardar conta e actualizar pending em paralelo
      await Promise.all([
        setDoc(doc(db, 'ntila_accounts', accountId), account),
        updateDoc(doc(db, 'ntila_pending', pendingId), {
          status: 'approved', approvedAt: now(), accountId
        })
      ]);

      return account;
    } catch(e) {
      console.error('[AccountsDB] approvePending:', e.message);
      return null;
    }
  },

  /** Rejeita um pedido pendente */
  async rejectPending(pendingId) {
    try {
      await updateDoc(doc(db, 'ntila_pending', pendingId), {
        status: 'rejected', rejectedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] rejectPending:', e.message);
      return false;
    }
  },

  // ── CÓDIGOS DE APROVAÇÃO ────────────────────────────

  /** Valida se um código existe e ainda não foi usado */
  async validateCode(code) {
    try {
      const snap = await getDocs(
        query(COL.codes(), where('code','==',code), where('used','==',false))
      );
      return !snap.empty;
    } catch(e) {
      return false;
    }
  },

  /** Marca um código como usado */
  async useCode(code, usedBy) {
    try {
      const snap = await getDocs(
        query(COL.codes(), where('code','==',code), where('used','==',false))
      );
      if (snap.empty) return false;
      await updateDoc(snap.docs[0].ref, {
        used: true, usedBy, usedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] useCode:', e.message);
      return false;
    }
  },

  /** Adiciona um novo código */
  async addCode(code) {
    try {
      // Verificar se já existe
      const snap = await getDocs(query(COL.codes(), where('code','==',code)));
      if (!snap.empty) return false;
      await addDoc(COL.codes(), {
        code, used: false, usedBy: null, createdAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] addCode:', e.message);
      return false;
    }
  },

  /** Lista todos os códigos */
  async getCodes() {
    try {
      const snap = await getDocs(COL.codes());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      return [];
    }
  },

  // ── LINKS DE CONVITE ────────────────────────────────

  /** Gera e guarda um link de convite */
  async generateInvite(createdBy = 'super') {
    try {
      const token = uid() + uid();
      const invite = {
        id:        uid(),
        token,
        url:       `${location.origin}${location.pathname}?invite=${token}`,
        createdBy,
        used:      false,
        usedBy:    null,
        createdAt: now(),
        expiresAt: new Date(Date.now() + 7*24*3600*1000).toISOString()
      };
      await addDoc(COL.invites(), invite);
      return invite;
    } catch(e) {
      console.error('[AccountsDB] generateInvite:', e.message);
      return null;
    }
  },

  /** Valida um token de convite */
  async validateInvite(token) {
    try {
      const snap = await getDocs(
        query(COL.invites(), where('token','==',token), where('used','==',false))
      );
      if (snap.empty) return false;
      const inv = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (new Date(inv.expiresAt) < new Date()) return false;
      return inv;
    } catch(e) {
      return false;
    }
  },

  /** Marca convite como usado */
  async useInvite(token, usedBy) {
    try {
      const snap = await getDocs(query(COL.invites(), where('token','==',token)));
      if (snap.empty) return false;
      await updateDoc(snap.docs[0].ref, {
        used: true, usedBy, usedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] useInvite:', e.message);
      return false;
    }
  },

  /** Lista todos os convites */
  async getInvites() {
    try {
      const snap = await getDocs(COL.invites());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      return [];
    }
  },

  /** Elimina um convite */
  async deleteInvite(id) {
    try {
      await deleteDoc(doc(db, 'ntila_invites', id));
      return true;
    } catch(e) {
      return false;
    }
  },

  // ── RASTREIO DE IPs ─────────────────────────────────

  /** Guarda progresso de registo de um IP */
  async saveIPProgress(ip, data) {
    try {
      const safeKey = ip.replace(/\./g, '_').replace(/:/g, '-');
      await setDoc(doc(db, 'ntila_pending_ips', safeKey), {
        ...data, ip, savedAt: now()
      });
    } catch(e) {
      console.error('[AccountsDB] saveIPProgress:', e.message);
    }
  },

  /** Lê progresso de registo de um IP */
  async getIPProgress(ip) {
    try {
      const safeKey = ip.replace(/\./g, '_').replace(/:/g, '-');
      const snap = await getDoc(doc(db, 'ntila_pending_ips', safeKey));
      return snap.exists() ? snap.data() : null;
    } catch(e) {
      return null;
    }
  },

  /** Remove progresso de registo de um IP */
  async clearIPProgress(ip) {
    try {
      const safeKey = ip.replace(/\./g, '_').replace(/:/g, '-');
      await deleteDoc(doc(db, 'ntila_pending_ips', safeKey));
    } catch(e) {
      console.error('[AccountsDB] clearIPProgress:', e.message);
    }
  },

  // ── AUTENTICAÇÃO (sessão em localStorage) ───────────

  /**
   * Login: valida credenciais no Firestore (ou super admin local)
   * e guarda a sessão em localStorage.
   */
  async login(username, password) {
    try {
      // Super Admin — verificação local (não vai ao Firestore)
      if (username === 'admin') {
        const passOk = password === 'ntila2025' || btoa(password) === btoa('ntila2025');
        // Verificar se a password foi alterada no Firestore
        const superSnap = await getDocs(
          query(COL.accounts(), where('id','==','super_password'))
        );
        let storedPass = btoa('ntila2025');
        if (!superSnap.empty) storedPass = superSnap.docs[0].data().hash || storedPass;

        if (btoa(password) !== storedPass && password !== 'ntila2025') return null;
        const session = {
          id: 'super', role: 'super_admin',
          permissions: ['all'], loginAt: now()
        };
        _lSet('ntila_admin_session', session);
        return session;
      }

      // Contas normais — consultar Firestore
      const snap = await getDocs(
        query(COL.accounts(), where('username','==',username))
      );
      if (snap.empty) return null;

      const acc = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (acc.status !== 'active') return null;
      if (btoa(password) !== acc.password) return null;

      const session = {
        id: acc.id, role: acc.role,
        permissions: acc.permissions, loginAt: now()
      };
      _lSet('ntila_admin_session', session);
      return session;
    } catch(e) {
      console.error('[AccountsDB] login:', e.message);
      return null;
    }
  },

  /** Termina sessão local */
  logout() {
    localStorage.removeItem('ntila_admin_session');
  },

  /** Devolve sessão actual (localStorage) */
  getSession() {
    return _lGet('ntila_admin_session');
  },

  /** Verifica se a sessão tem uma permissão específica */
  hasPermission(perm) {
    const s = this.getSession();
    if (!s) return false;
    if (s.role === 'super_admin') return true;
    const perms = s.permissions || [];
    return perms === 'all' || perms.includes('all') || perms.includes(perm);
  },

  /** Verifica se é super admin */
  isSuperAdmin() {
    const s = this.getSession();
    return s && s.role === 'super_admin';
  },

  // ── ALTERAR PASSWORD ─────────────────────────────────

  /** Altera a password do super admin (guarda hash no Firestore) */
  async changePassword(currentPass, newPass) {
    try {
      // Validar password actual
      const validCurrent = currentPass === 'ntila2025' || btoa(currentPass) === btoa('ntila2025');
      if (!validCurrent) return false;

      // Guardar nova password no Firestore
      await setDoc(doc(db, 'ntila_accounts', 'super_password'), {
        hash: btoa(newPass), updatedAt: now()
      });
      return true;
    } catch(e) {
      console.error('[AccountsDB] changePassword:', e.message);
      return false;
    }
  },

  // ── RESET TOTAL ──────────────────────────────────────

  /**
   * Limpa dados locais (não apaga o Firestore).
   * Para apagar o Firestore usa o painel Firebase.
   */
  resetAll(confirmPass) {
    if (confirmPass !== 'ntila2025') return false;
    Object.keys(localStorage)
      .filter(k => k.startsWith('ntila_'))
      .forEach(k => localStorage.removeItem(k));
    return true;
  },

  /** Lista todas as permissões disponíveis */
  getAllPermissions() {
    return ALL_PERMISSIONS;
  }
};

// ── Exportar globalmente ───────────────────────────────
window.AccountsDB = AccountsDB;
console.log('[AccountsDB v2.0] ✅ Firebase Firestore pronto');
      
