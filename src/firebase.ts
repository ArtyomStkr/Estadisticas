import { getApps, initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const app = getApps()[0] ?? initializeApp({ apiKey: 'AIzaSyAzN4Tf-XQkDCdEyrcL0co1L6rEAkc-b1Y', appId: '1:617748511820:web:cbb1e550104d11b82948e9', messagingSenderId: '617748511820', projectId: 'feedarancelbob', authDomain: 'feedarancelbob.firebaseapp.com', storageBucket: 'feedarancelbob.firebasestorage.app' })
const auth: Auth = getAuth(app)
const db: Firestore = getFirestore(app)
export { auth, db }