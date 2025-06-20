import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDwOWQ9FruxKVbPSKZyweqs0ejbdc_bGaU",
  authDomain: "cofi-auth.firebaseapp.com",
  projectId: "cofi-auth",
  storageBucket: "cofi-auth.firebasestorage.app",
  messagingSenderId: "6133589505",
  appId: "1:6133589505:web:96a9b295b1cb0c6a3b0200"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
