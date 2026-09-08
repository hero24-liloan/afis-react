import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function SetupScreen() {
  const { createFirstAdmin } = useAuth();
  const toast = useToast();
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [un, setUn] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    setErrMsg('');
    if (!fn || !ln || !un || !pw || !pw2) { setErrMsg('All fields are required.'); return; }
    if (pw.length < 6) { setErrMsg('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setErrMsg('Passwords do not match.'); return; }
    setBusy(true);
    createFirstAdmin({ firstName: fn, lastName: ln, username: un, password: pw })
      .then(() => toast('Admin account created!', 'ok'))
      .catch(e => {
        console.error(e);
        let msg = 'Could not create the account.';
        if (e.code === 'afis/already-set-up') msg = 'An account already exists — please sign in instead.';
        else if (e.code === 'auth/email-already-in-use') msg = 'That username is already taken.';
        else if (e.code === 'auth/weak-password') msg = 'Password is too weak.';
        setErrMsg(msg);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,var(--navy) 0%,var(--navy-mid) 60%,var(--navy-light) 145%)', position: 'relative', overflow: 'hidden' }}>
      <div className="login-card">
        <div className="login-logo">
          <div className="seal"><svg viewBox="0 0 24 24"><path d="M12 2L14.85 8.3L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.15 8.3L12 2Z" /></svg></div>
          <div className="eyebrow">Municipality of Liloan, SL</div>
          <h1>Accountable Forms<br />Inventory System</h1>
          <p>First-Time Setup</p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--g600)', lineHeight: 1.55, marginBottom: 18 }}>
          No accounts exist in this Firebase project yet. Create the first <strong>Admin</strong> account below —
          it will be able to create every other account afterward.
        </p>
        {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
        <div className="row2">
          <div className="fg"><label>First Name</label><input type="text" value={fn} onChange={e => setFn(e.target.value)} placeholder="Juan" /></div>
          <div className="fg"><label>Last Name</label><input type="text" value={ln} onChange={e => setLn(e.target.value)} placeholder="dela Cruz" /></div>
        </div>
        <div className="fg"><label>Username</label><input type="text" value={un} onChange={e => setUn(e.target.value)} placeholder="admin" /></div>
        <div className="fg"><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min. 6 characters" /></div>
        <div className="fg">
          <label>Confirm Password</label>
          <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Re-enter password"
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        </div>
        <button className="btn btn-primary btn-full" disabled={busy} onClick={submit}>
          {busy ? 'Creating…' : 'Create Admin Account'}
        </button>
      </div>
    </div>
  );
}
