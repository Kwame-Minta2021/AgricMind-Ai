// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlNUrYfD37CqtrwTaXxBc0mLcgsLN1Poc",
  authDomain: "agrimind-a79c9.firebaseapp.com",
  projectId: "agrimind-a79c9",
  storageBucket: "agrimind-a79c9.appspot.com",
  messagingSenderId: "442318399013",
  appId: "1:442318399013:web:d4f1a3f5277b0a150e81cc",
  databaseURL: "https://agrimind-a79c9-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database };
