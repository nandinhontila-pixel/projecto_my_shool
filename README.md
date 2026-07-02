# 📚 Ntila Estudos — Portal de História v2.0

> Portal de estudos responsivo (Mobile-First) com design glassmorphism iOS,  
> Firebase Firestore em tempo real, painel de administração completo e suporte PWA.

---

## 📁 Estrutura de Ficheiros

```
ntila_portal/
├── index.html          ← Portal principal (utilizadores)
├── admin_painel.html   ← Painel de controlo (administrador)
├── db.js               ← Base de dados centralizada (Firebase + localStorage)
├── manifest.json       ← Configuração PWA
├── sw.js               ← Service Worker (modo offline)
└── README.md           ← Este ficheiro
```

---

## 🔥 1. Configurar o Firebase

### Passo 1 — Criar Projecto Firebase

1. Acede a [console.firebase.google.com](https://console.firebase.google.com)
2. Clica em **"Adicionar projecto"**
3. Dá um nome (ex: `ntila-estudos`)
4. Desactiva o Google Analytics (opcional) → **Criar projecto**

### Passo 2 — Activar Firestore

1. No menu lateral → **Firestore Database**
2. Clica **"Criar base de dados"**
3. Escolhe **"Iniciar no modo de teste"** (podes restringir depois)
4. Selecciona a região mais próxima (ex: `europe-west3`)

### Passo 3 — Obter as Credenciais

1. Clica no ⚙️ → **Definições do projecto**
2. Na aba **"As tuas apps"** → clica no ícone **`</>`** (Web)
3. Regista a app (ex: `ntila-web`)
4. Copia o objecto `firebaseConfig`

### Passo 4 — Colar no db.js

Abre `db.js` e substitui o bloco `FIREBASE_CONFIG`:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",          // ← a tua chave
  authDomain:        "ntila-estudos.firebaseapp.com",
  projectId:         "ntila-estudos",
  storageBucket:     "ntila-estudos.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

## 🔒 2. Regras de Segurança Firestore

Cola estas regras em **Firestore → Regras**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Temas: leitura pública, escrita apenas autenticada (ou via admin)
    match /topics/{topicId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Reacções: leitura/escrita pública
    match /reactions/{topicId} {
      allow read, write: if true;
    }

    // Comentários: leitura pública, escrita pública (com validação)
    match /comments/{topicId}/items/{commentId} {
      allow read: if true;
      allow create: if request.resource.data.text.size() > 0
                    && request.resource.data.text.size() <= 2000;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['likes']);
      allow delete: if request.auth != null;
    }

    // Chats: leitura/escrita pública (identificados por sessionId)
    match /chats/{sessionId} {
      allow read, write: if true;
      match /messages/{msgId} {
        allow read, write: if true;
      }
    }

    // Analytics: escrita pública, leitura apenas admin
    match /analytics/{docId} {
      allow create: if true;
      allow read: if request.auth != null;
    }

    // Registo IP: escrita pública, leitura apenas admin
    match /ip_registry/{ipDoc} {
      allow create, update: if true;
      allow read: if request.auth != null;
    }

    // Transacções: escrita pública, leitura apenas admin
    match /transactions/{txId} {
      allow create: if true;
      allow read: if request.auth != null;
    }
  }
}
```

---

## 🚀 3. Publicar o Site

### Opção A — Firebase Hosting (recomendado, grátis)

```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Inicializar na pasta do projecto
cd ntila_portal
firebase init hosting

# Configuração:
# → "Use an existing project" → selecciona o teu projecto
# → Public directory: . (ponto — pasta actual)
# → Configure as a single-page app: No
# → Set up automatic builds: No

# 4. Publicar
firebase deploy --only hosting
```

O site fica disponível em: `https://ntila-estudos.web.app`

### Opção B — Netlify (drag & drop)

1. Acede a [netlify.com](https://netlify.com) → Login
2. Arrasta a pasta `ntila_portal` para a área de deploy
3. O site fica online em segundos

### Opção C — GitHub Pages

1. Cria repositório no GitHub
2. Faz upload dos ficheiros
3. Settings → Pages → Branch: main → Save

---

## 🔑 4. Credenciais do Admin

Por defeito (sem Firebase Auth):
- **Utilizador:** `admin`
- **Senha:** `ntila2025`

Para alterar, abre `admin_painel.html` e procura:
```javascript
const DEFAULT_CREDS = { user: 'admin', pass: 'ntila2025' };
```

> ⚠️ **Importante:** Para produção, usa Firebase Authentication com email/password e protege o painel com regras de segurança adequadas.

---

## 📱 5. Instalar como App (PWA)

### No Android (Chrome):
1. Abre o site no Chrome
2. Menu (⋮) → **"Adicionar ao ecrã inicial"**
3. Confirma → A app aparece no ecrã inicial

### No iPhone (Safari):
1. Abre o site no Safari
2. Botão de partilha (□↑) → **"Adicionar ao ecrã de início"**
3. Confirma → A app aparece no ecrã inicial

---

## 🗄️ 6. Colecções Firestore (Estrutura)

```
Firestore
├── topics/                    ← Temas publicados
│   └── {topicId}
│       ├── id, title, slug
│       ├── coverImage, intro, content
│       ├── era, order
│       ├── allowComments, allowReactions
│       └── publishedAt, updatedAt
│
├── reactions/                 ← Gostos por tema
│   └── {topicId}
│       ├── likes: number
│       └── dislikes: number
│
├── comments/                  ← Comentários por tema
│   └── {topicId}
│       └── items/
│           └── {commentId}
│               ├── id, topicId, parentId
│               ├── name, email, emailMasked
│               ├── text, likes
│               ├── isAdmin, ip
│               └── createdAt
│
├── chats/                     ← Sessões de chat
│   └── {sessionId}
│       ├── lastMessage, lastActivity
│       ├── userName, ip
│       └── messages/
│           └── {msgId}
│               ├── text, sender
│               ├── name, ip
│               └── createdAt
│
├── analytics/                 ← Registo de acessos
│   └── {autoId}
│       ├── page, ip
│       ├── timestamp, date
│
├── ip_registry/               ← IPs registados
│   └── {ip_com_underscores}
│       ├── ip, status (ok/banned)
│       ├── visits, actions[]
│       └── firstSeen, lastSeen
│
└── transactions/              ← Transacções
    └── {txId}
        ├── method, amount, currency
        ├── phone (mascarado), ip
        ├── status, product
        └── timestamp
```

---

## 🎨 7. Personalizar o Design

### Mudar Cores Principais

Em `index.html` e `admin_painel.html`, edita as variáveis CSS:

```css
[data-theme="dark"] {
  --accent:   #4F8EF7;   /* Azul principal → muda para a tua cor */
  --accent-2: #7B61FF;   /* Roxo secundário */
  --gold:     #D4A843;   /* Dourado para destaques */
}
```

### Adicionar Novo Tema/Matéria

**Via Painel Admin (recomendado):**
1. Abre `admin_painel.html`
2. Login → Aba "Publicar"
3. Preenche os campos → "Publicar no Site"

**Manualmente no `index.html`:**
Adiciona ao array `DEFAULT_TOPICS`:
```javascript
{
  id: 'meu-tema',
  title: 'Nome do Tema',
  slug: 'nome-do-tema',
  coverImage: 'https://url-da-imagem.jpg',
  intro: 'Introdução curta...',
  era: '1950 — 2000',
  tag: 'Tag',
  emoji: '🌍',
  order: 3,
  allowComments: true,
  allowReactions: true,
  content: `<h2>Título</h2><p>Conteúdo...</p>`
}
```

---

## 💳 8. Integrar Pagamentos Reais

### M-Pesa (Vodacom Moçambique)
Substitui a função `handlePayment` em `index.html`:
```javascript
function handlePayment(method) {
  if (method === 'mpesa') {
    // Documentação: developers.vodacom.co.mz
    // Redireciona para o gateway M-Pesa
    window.location.href = 'https://api.mpesa.com/checkout?amount=150&ref=NTILA001';
  }
}
```

### eMola (Tmcel Moçambique)
```javascript
// Documentação: emola.co.mz/developers
window.location.href = 'https://api.emola.co.mz/pay?amount=150';
```

---

## 🛡️ 9. Sistema Antifraude

O sistema detecta automaticamente padrões suspeitos:

| Evento | Acção Automática |
|--------|-----------------|
| 3+ falhas de pagamento em 30 min | Ban automático do IP |
| IP já banido tenta aceder | Bloqueado silenciosamente |
| Comentário de IP banido | Rejeitado |

Para ver os IPs banidos: **Admin → Aba Segurança**

---

## 📞 10. Suporte & Contacto

- **WhatsApp:** [Botão de partilha no site]
- **Facebook:** [Botão de partilha no site]
- **Admin Chat:** Botão flutuante 💬 no canto inferior direito

---

## 📋 Changelog

### v2.0 (Actual)
- ✅ Reescrita completa com design iOS glassmorphism
- ✅ Firebase Firestore em tempo real
- ✅ Portal multi-tema (PGM, SGM, Guerra Fria)
- ✅ Sistema de comentários com respostas aninhadas
- ✅ Reacções (Gostos/Não-Gostos) em tempo real
- ✅ Chat utilizador ↔ Admin em tempo real
- ✅ Painel Admin com CMS, estatísticas e antifraude
- ✅ PWA (instalável, funciona offline)
- ✅ Modo Dark/Light
- ✅ Carrossel automático com suporte a swipe
- ✅ Pesquisa em tempo real
- ✅ Botões M-Pesa, eMola, WhatsApp, Facebook

### v1.0 (Anterior)
- Segunda Guerra Mundial (tema único)
- localStorage (sem nuvem)
- Admin básico

---

*Ntila Estudos © 2025 — Todos os direitos reservados*
