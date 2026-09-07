import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Firebase queda deshabilitado hasta que .env tenga las credenciales reales
// (ver .env.example). Mientras tanto la app corre en "modo local".
export const firebaseEnabled = Boolean(config.apiKey && config.projectId)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

if (firebaseEnabled) {
  app = initializeApp(config)
  authInstance = getAuth(app)
  dbInstance = getFirestore(app)
  enableIndexedDbPersistence(dbInstance).catch(() => {
    // varias pestañas abiertas, o el navegador no soporta persistencia — no es fatal
  })
}

export const auth = authInstance
export const db = dbInstance
