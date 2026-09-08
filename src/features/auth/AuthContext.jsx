import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { fbAuth, FIREBASE_NOT_CONFIGURED, usernameToEmail } from '../../firebaseConfig.jsx';
import { checkHasAnyUsers, markBootstrapped, createUserProfile, subscribeUsers, nowISO } from '../../lib/db.js';

const AuthContext = createContext(null);

// After signing in, the user's Firestore profile doc may not have streamed
// into the local users list yet — poll briefly rather than racing it.
function waitForUserProfile(getUsers, uidVal, attempts = 0) {
  return new Promise(resolve => {
    const tryFind = () => {
      const p = getUsers().find(x => x.id === uidVal);
      if (p) return resolve(p);
      if (attempts >= 40) return resolve(null); // ~4s timeout
      attempts++;
      setTimeout(tryFind, 100);
    };
    tryFind();
  });
}

export function AuthProvider({ children }) {
  // 'config' | 'loading' | 'setup' | 'login' | 'signed-in'
  const [screen, setScreen] = useState(FIREBASE_NOT_CONFIGURED ? 'config' : 'loading');
  const [currentUser, setCurrentUser] = useState(null); // Firestore profile doc of the signed-in account
  const [sessionPassword, setSessionPassword] = useState(''); // kept only in memory; never persisted
  const usersRef = useRef([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const cuRef = useRef(null); // mirrors currentUser for use inside async callbacks

  useEffect(() => { cuRef.current = currentUser; }, [currentUser]);
  const getUsers = useCallback(() => usersRef.current, []);

  // (Re)attaches the users listener. Safe to call more than once — e.g. right
  // after sign-in — because a listener opened while signed out and denied by
  // security rules does NOT automatically retry once you're authenticated;
  // it has to be re-opened. We detach any previous listener first.
  const usersUnsubRef = useRef(null);
  const attachUsersListener = useCallback(() => {
    if (usersUnsubRef.current) { try { usersUnsubRef.current(); } catch (e) { /* noop */ } }
    usersUnsubRef.current = subscribeUsers(list => {
      usersRef.current = list;
      setUsersLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (FIREBASE_NOT_CONFIGURED) return;

    // Live users list is needed regardless of screen (Setup/Login decisions,
    // and looking up the signed-in profile after auth).
    attachUsersListener();

    // Wait for Firebase Auth to report the real auth state (including any
    // persisted session) before deciding which screen to show. Re-attach the
    // users listener on every auth change too, since sign-in/sign-out both
    // invalidate a listener opened under the previous auth state.
    const unsubAuth = onAuthStateChanged(fbAuth, user => {
      attachUsersListener();
      if (cuRef.current) return; // already signed in this session via login()/createFirstAdmin()
      if (user) {
        waitForUserProfile(getUsers, user.uid).then(profile => {
          if (cuRef.current) return;
          if (profile) {
            setCurrentUser(profile);
            setScreen('signed-in');
          } else {
            // Signed in but no matching profile doc (e.g. account was removed).
            checkHasAnyUsers().then(hasUsers => {
              if (hasUsers === false) setScreen('setup');
              else { signOut(fbAuth); setScreen('login'); }
            });
          }
        });
      } else {
        checkHasAnyUsers().then(hasUsers => {
          // unknown (null) defaults to login, never re-shows Setup by mistake
          setScreen(hasUsers === false ? 'setup' : 'login');
        });
      }
    });

    return () => { if (usersUnsubRef.current) usersUnsubRef.current(); unsubAuth(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((username, password) => {
    return signInWithEmailAndPassword(fbAuth, usernameToEmail(username), password)
      .then(cred => {
        setSessionPassword(password);
        attachUsersListener();
        return waitForUserProfile(getUsers, cred.user.uid);
      })
      .then(profile => {
        if (!profile) {
          signOut(fbAuth);
          throw { code: 'afis/account-removed' };
        }
        setCurrentUser(profile);
        setScreen('signed-in');
      });
  }, [getUsers]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setSessionPassword('');
    signOut(fbAuth);
    setScreen('loading');
    checkHasAnyUsers().then(hasUsers => {
      setScreen(hasUsers === false ? 'setup' : 'login');
    });
  }, []);

  const createFirstAdmin = useCallback(({ firstName, lastName, username, password }) => {
    return checkHasAnyUsers()
      .then(hasUsers => {
        if (hasUsers) throw { code: 'afis/already-set-up' };
        return createUserWithEmailAndPassword(fbAuth, usernameToEmail(username), password);
      })
      .then(cred => createUserProfile(cred.user.uid, {
        username, firstName, lastName, role: 'Admin', designation: '', createdAt: nowISO(),
      }).then(() => markBootstrapped()).then(() => cred))
      .then(cred => { attachUsersListener(); return waitForUserProfile(getUsers, cred.user.uid); })
      .then(profile => {
        setSessionPassword(password);
        setCurrentUser(profile);
        setScreen('signed-in');
      });
  }, [getUsers]);

  const changePassword = useCallback((currentPw, newPw) => {
    const user = fbAuth.currentUser;
    const credential = EmailAuthProvider.credential(usernameToEmail(currentUser.username), currentPw);
    return reauthenticateWithCredential(user, credential)
      .then(() => updatePassword(user, newPw))
      .then(() => setSessionPassword(newPw));
  }, [currentUser]);

  const value = {
    screen, currentUser, sessionPassword, usersLoaded,
    users: usersRef.current,
    login, logout, createFirstAdmin, changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
