import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function LoginScreen() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    setErrMsg('');
    if (!user || !pass) { setErrMsg('Enter your username and password.'); return; }
    setBusy(true);
    login(user, pass)
      .catch(e => {
        console.error(e);
        setErrMsg(e.code === 'afis/account-removed'
          ? 'This account no longer exists. Contact your administrator.'
          : 'Invalid username or password.');
      })
      .finally(() => setBusy(false));
  }

  return (
    <div id="login-screen">
      <div className="login-shell">
        <div className="login-brand">
          <div>
            <div className="brand-tag mono">SYSTEM ACCESS · MTO&#8209;01</div>
            <div className="brand-logo">
              <img src="/LGULogo.png" alt="LGU Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }}
                onError={e => { e.currentTarget.parentElement.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2L14.85 8.3L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.15 8.3L12 2Z"/></svg>'; }} />
            </div>
            <h1>Accountable Forms<br />Inventory System</h1>
            <p className="brand-office">Office of the Municipal Treasurer<br />Municipality of Liloan, Southern Leyte</p>
          </div>
          <div className="ledger-lines" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-inner">
            <div className="eyebrow-sm mono">SIGN IN</div>
            <h2>Welcome back</h2>
            <p className="form-sub">Enter your credentials to access your account.</p>
            {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
            <div className="fg">
              <label>Username</label>
              <input type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="Enter your username" autoComplete="username" />
            </div>
            <div className="fg">
              <label>Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
            </div>
            <button className="btn btn-primary btn-full" disabled={busy} onClick={submit}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="form-help">Trouble signing in? Contact your system administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
