# Ntila Marketing — Projeto Completo
## Segunda Guerra Mundial + Painel Administrativo

---

## Ficheiros do Projecto

| Ficheiro                       | Descrição                                      |
|-------------------------------|------------------------------------------------|
| `segunda_guerra_mundial.html` | Site principal — conteúdo + sistema de vendas  |
| `admin_painel.html`           | Painel administrativo protegido por senha      |
| `db.js`                       | Base de dados centralizada (partilhada)        |

---

## Como Usar

1. **Abrir o site** → abrir `segunda_guerra_mundial.html` no browser
2. **Abrir o painel admin** → abrir `admin_painel.html` no browser
3. **Os dois ficheiros devem estar na mesma pasta** para partilharem o `db.js`

> ⚠️ O `db.js` deve estar na mesma directoria que os ficheiros HTML.

---

## Credenciais do Painel Admin

As credenciais são definidas no primeiro acesso ou via botão "Repor credenciais".  
Após entrar, altere imediatamente em **⚙️ Config → Alterar Senha**.

---

## Base de Dados (localStorage)

| Tabela                | Conteúdo                            |
|----------------------|-------------------------------------|
| `sgm_receipts`       | Recibos de pagamentos confirmados   |
| `sgm_comments`       | Comentários dos visitantes          |
| `sgm_ip_db`          | Registo de IPs e banimentos         |
| `sgm_txs`            | Transacções e tentativas de fraude  |
| `sgm_proofs`         | Comprovativos de pagamento          |
| `sgm_downloads`      | Registo de downloads do livro       |
| `sgm_likes`          | Contador de gostos                  |
| `adm_dl_perms`       | Permissões de download (admin)      |
| `adm_creds`          | Credenciais do admin (encriptadas)  |
| `adm_e2e_k`          | Chave AES-256-GCM do chat           |
| `sgm_chat_{id}`      | Sessões de chat (XOR encriptado)    |
| `adm_chat_{id}`      | Respostas admin (AES-256-GCM)       |

---

## Segurança

- **Chat**: Encriptação ponta-a-ponta AES-256-GCM via Web Crypto API
- **Pagamentos**: PIN nunca guardado; número encriptado em Base64
- **Anti-fraude**: IPs banidos automaticamente após tentativa fraudulenta
- **Admin**: Senha mínima 8 caracteres; bloqueio após 5 tentativas falhadas

---

## Conta de Pagamento

- **M-PESA / e-Mola**: 852 260 828 — Antônio Ntila
- **Preço do livro**: 150 MZN
- **Entrega**: Via WhatsApp após confirmação admin

---

## Contacto

- **Email**: nandinhontila@gmail.com
- **WhatsApp**: https://wa.link/pib4h7
- **Facebook**: https://www.facebook.com/share/1BnFJ8K9nP/
