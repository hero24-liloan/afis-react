import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useData } from '../../data/DataContext.jsx';

export default function ChangePasswordModal({ open, onClose }) {
  const { changePassword, currentUser } = useAuth();
  const { logActivity } = useData();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() { setCur(''); setN1(''); setN2(''); setErrMsg(''); setOk(false); }
  function close() { reset(); onClose(); }

  function submit() {
    setErrMsg(''); setOk(false);
    if (!cur || !n1 || !n2) { setErrMsg('All fields are required.'); return; }
    if (n1.length < 6) { setErrMsg('New password must be at least 6 characters.'); return; }
    if (n1 !== n2) { setErrMsg('New passwords do not match.'); return; }
    setBusy(true);
    changePassword(cur, n1)
      .then(() => {
        const fullName = currentUser ? currentUser.firstName + ' ' + currentUser.lastName : '—';
        logActivity('Change Password', fullName + ' changed their own password', fullName);
        setOk(true);
        setCur(''); setN1(''); setN2('');
        toast('Password updated!', 'ok');
      })
      .catch(e => {
        console.error(e);
        let msg = 'Could not update your password.';
        if (e.code === 'auth/wrong-password') msg = 'Current password is incorrect.';
        else if (e.code === 'auth/weak-password') msg = 'New password is too weak.';
        else if (e.code === 'auth/too-many-requests') msg = 'Too many attempts — try again later.';
        setErrMsg(msg);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className={'overlay' + (open ? ' show' : '')} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal sm">
        <div className="mhd"><span className="mtitle">Change Password</span><button className="mclose" onClick={close}>×</button></div>
        <div className="mbody">
          {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
          {ok && <div className="smsg" style={{ display: 'block' }}>Password updated successfully.</div>}
          <div className="fg"><label>Current Password <span className="req">*</span></label><input type="password" value={cur} onChange={e => setCur(e.target.value)} placeholder="Your current password" /></div>
          <div className="fg"><label>New Password <span className="req">*</span></label><input type="password" value={n1} onChange={e => setN1(e.target.value)} placeholder="Min. 6 characters" /></div>
          <div className="fg">
            <label>Confirm New Password <span className="req">*</span></label>
            <input type="password" value={n2} onChange={e => setN2(e.target.value)} placeholder="Re-enter new password"
              onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-outline" onClick={close}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Updating…' : 'Update Password'}</button>
        </div>
      </div>
    </div>
  );
}
