import {
  collection, doc, onSnapshot, getDoc, setDoc,
} from 'firebase/firestore';
import { fbStore } from '../firebaseConfig.jsx';

// Whether ANY account exists — read from a small public doc rather than the
// protected 'users' collection, because 'users' can't be read until you're
// already signed in, which makes it useless for deciding "should I show
// Setup or Login" to a signed-out visitor. Requires the /meta/{doc} rule
// described in FIREBASE-SETUP.md (publicly readable, write requires auth).
export function checkHasAnyUsers() {
  return getDoc(doc(fbStore, 'meta', 'bootstrap'))
    .then(snap => !!(snap.exists() && snap.data().hasUsers))
    .catch(e => { console.error('meta/bootstrap read failed:', e); return null; }); // null = unknown
}

export function markBootstrapped() {
  return setDoc(doc(fbStore, 'meta', 'bootstrap'), { hasUsers: true });
}

export function createUserProfile(uid, profile) {
  return setDoc(doc(fbStore, 'users', uid), profile);
}

// Live subscription to the users collection. Calls onChange(usersArray) on
// every update. Returns an unsubscribe function.
export function subscribeUsers(onChange, onError) {
  return onSnapshot(
    collection(fbStore, 'users'),
    snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => { console.error('Firestore listen error (users):', e); onError && onError(e); },
  );
}

export function nowISO() { return new Date().toISOString(); }
