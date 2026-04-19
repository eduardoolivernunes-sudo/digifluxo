// Configuração do Firebase para o projeto Digifluxo
const firebaseConfig = {
  apiKey: "AIzaSyDxMLad25StwnLtWP06txwoMkOUEjbRAY",
  authDomain: "digifluxo.firebaseapp.com",
  databaseURL: "https://digifluxo-default-rtdb.firebaseio.com",
  projectId: "digifluxo",
  storageBucket: "digifluxo.firebasestorage.app",
  messagingSenderId: "1055810449921",
  appId: "1:1055810449921:web:e9ceb07a4758ed43738600"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('✅ Firebase conectado com sucesso!');