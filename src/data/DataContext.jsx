import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { fbStore, FIREBASE_NOT_CONFIGURED } from '../firebaseConfig.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { nowISO } from '../lib/db.js';

export const STATE_KEYS = ['forms', 'requests', 'issuances', 'rcds', 'raafs', 'craafs', 'funds', 'designations', 'activity'];

function uid() { return Math.random().toString(36).substr(2, 9); }

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { screen } = useAuth();
  const signedIn = screen === 'signed-in';

  const [data, setDataState] = useState(() => {
    const init = {};
    STATE_KEYS.forEach(k => { init[k] = []; });
    return init;
  });
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const [loadedKeys, setLoadedKeys] = useState(() => new Set());
  const ready = loadedKeys.size >= STATE_KEYS.length;

  // (Re)attaches all Firestore listeners. Same reasoning as the users
  // listener in AuthContext: a listener opened while signed out and denied
  // by security rules does not auto-retry once authenticated, so this only
  // runs while signed in, and detaches cleanly on sign-out.
  useEffect(() => {
    if (!signedIn || FIREBASE_NOT_CONFIGURED) return;
    setLoadedKeys(new Set());
    const unsubs = STATE_KEYS.map(key => onSnapshot(
      doc(fbStore, 'state', key),
      snap => {
        const arr = (snap.exists() && Array.isArray(snap.data().data)) ? snap.data().data : [];
        setDataState(d => ({ ...d, [key]: arr }));
        setLoadedKeys(s => new Set(s).add(key));
      },
      e => {
        console.error('Firestore listen error (' + key + '):', e);
        setLoadedKeys(s => new Set(s).add(key));
      },
    ));
    return () => unsubs.forEach(u => u());
  }, [signedIn]);

  const g = useCallback(key => dataRef.current[key] || [], []);

  const s = useCallback((key, value) => {
    // Optimistic local update so callers reading right after s() see it immediately.
    dataRef.current = { ...dataRef.current, [key]: value };
    setDataState(d => ({ ...d, [key]: value }));
    if (FIREBASE_NOT_CONFIGURED) return Promise.resolve();
    return setDoc(doc(fbStore, 'state', key), { data: value }).catch(e => {
      console.error('Firestore write failed (' + key + '):', e);
      throw e;
    });
  }, []);

  const logActivity = useCallback((t, det, by) => {
    const a = g('activity').slice();
    a.push({ id: uid(), t, det, by, d: nowISO() });
    if (a.length > 100) a.splice(0, a.length - 100);
    return s('activity', a);
  }, [g, s]);

  return (
    <DataContext.Provider value={{ data, ready, g, s, logActivity }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
