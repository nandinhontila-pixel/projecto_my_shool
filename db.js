// Configuração do Firebase atualizada para o teu portal de estudos
const firebaseConfig = {
  apiKey: "AIzaSyBb_R6NPgacf_bMT5kQEmI1Ji3mdbzDfZw",
  authDomain: "projecto-my-shool.firebaseapp.com",
  projectId: "projecto-my-shool",
  storageBucket: "projecto-my-shool.firebasestorage.app",
  messagingSenderId: "670537010590",
  appId: "1:670537010590:web:1f02e946f41f908dcd1a8f",
  measurementId: "G-FE0D9MMYC1"
};

// Inicializar o Firebase no formato compatível com o teu site
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
