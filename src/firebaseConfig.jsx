// ═══════════════════════════════════════════════
//  FIREBASE CONFIG — replace with your own project's config
//  (Firebase Console ▸ Project settings ▸ General ▸ Your apps ▸ SDK setup)
// ═══════════════════════════════════════════════
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey:            'AIzaSyAqUik8-oWpMw69kryJK58lwNVWNhaV3Xs',
  authDomain:        'afis-e21b6.firebaseapp.com',
  projectId:         'afis-e21b6',
  storageBucket:     'afis-e21b6.firebasestorage.app',
  messagingSenderId: '493597771348',
  appId:             '1:493597771348:web:0275972e8571238aa38fc1',
};

export const FIREBASE_NOT_CONFIGURED = firebaseConfig.apiKey === 'YOUR_API_KEY';

// Primary app = the session actually logged in.
export const fbApp = FIREBASE_NOT_CONFIGURED ? null : initializeApp(firebaseConfig);
export const fbAuth = FIREBASE_NOT_CONFIGURED ? null : getAuth(fbApp);
export const fbStore = FIREBASE_NOT_CONFIGURED ? null : getFirestore(fbApp);
export const fbFunctions = FIREBASE_NOT_CONFIGURED ? null : getFunctions(fbApp);

// Safety net: the Firestore SDK throws (synchronously, before ever reaching the network)
// if any field in a written document is the literal value `undefined` rather than just
// being omitted. Unlike the compat SDK, the modular SDK doesn't expose a global
// `ignoreUndefinedProperties` settings call on the default getFirestore() instance in
// the same way — so callers writing to Firestore should still avoid sending `undefined`
// fields explicitly (e.g. `foo: cond ? val : null` instead of `undefined`).

// Secondary app = used only to create new Auth accounts (Admin action) without
// disturbing the Admin's own logged-in session (createUser signs the new
// account in on whichever app instance made the call).
let fbSecondaryApp = null;
export function getSecondaryAuth() {
  if (!fbSecondaryApp) {
    fbSecondaryApp = getApps().find(a => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
  }
  return getAuth(fbSecondaryApp);
}

// Firebase Auth needs an email address — usernames are mapped to a synthetic
// address under a fixed fake domain so people can keep logging in with a
// plain username, exactly like before.
export function usernameToEmail(u) {
  return String(u).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@afis.local';
}
