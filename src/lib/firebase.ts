import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDS9jas6glRKF8Gyzy3B-xhpPiffDPSOX0",
  authDomain: "financas-pro-313d2.firebaseapp.com",
  projectId: "financas-pro-313d2",
  storageBucket: "financas-pro-313d2.firebasestorage.app",
  messagingSenderId: "236962762522",
  appId: "1:236962762522:web:7cc3c537f3bc15644726a3"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
