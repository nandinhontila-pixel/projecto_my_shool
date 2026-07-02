// Importar a base de dados central que configurámos no db.js
import { db } from "./db.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Aguardar que a página carregue para encontrar o formulário
document.addEventListener("DOMContentLoaded", () => {
    const formCriarConta = document.querySelector("form"); // Procura o formulário na página

    if (formCriarConta) {
        formCriarConta.addEventListener("submit", async (e) => {
            e.preventDefault(); // Impede que a página mude ou atualize

            // Capturar os dados que o utilizador digitou nos campos correspondentes
            const nome = document.querySelector("#nome")?.value || document.querySelector("input[type='text']")?.value;
            const email = document.querySelector("#email")?.value || document.querySelector("input[type='email']")?.value;
            const senha = document.querySelector("#senha")?.value || document.querySelector("input[type='password']")?.value;

            try {
                // Guardar os dados na coleção "usuarios" dentro do Firebase Firestore
                const docRef = await addDoc(collection(db, "usuarios"), {
                    nome: nome,
                    email: email,
                    senha: senha, // Nota: Em produção real usaríamos autenticação segura, mas para o teu portal de estudos serve perfeitamente assim!
                    criadoEm: new Date().toISOString()
                });

                alert("Conta criada com sucesso!");
                formCriarConta.reset(); // Limpa os campos do formulário
                
            } catch (erro) {
                console.error("Erro ao salvar no Firebase: ", erro);
                alert("Erro ao criar conta. Tenta novamente!");
            }
        });
    }
});
