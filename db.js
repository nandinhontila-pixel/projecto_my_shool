// 1. Importar as funções necessárias dos módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. As tuas credenciais de configuração (as chaves do teu projeto)
const firebaseConfig = {
  apiKey: "AIzaSyBb_R6NPgacf_bMT5kQEmI1Ji3mdbzDfZw",
  authDomain: "projecto-my-shool.firebaseapp.com",
  projectId: "projecto-my-shool",
  storageBucket: "projecto-my-shool.firebasestorage.app",
  messagingSenderId: "670537010590",
  appId: "1:670537010590:web:1f02e946f41f908dcd1a8f",
  measurementId: "G-FE0D9MMYC1"
};

// 3. Inicializar o Firebase e o Banco de Dados (Firestore)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Exportar a variável 'db' para usares noutros ficheiros do site
export { db };
