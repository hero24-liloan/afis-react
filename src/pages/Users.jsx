import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { fbStore, fbFunctions, getSecondaryAuth, usernameToEmail } from '../firebaseConfig.jsx';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

function nowISO() { return new Date().toISOString(); }
function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function Users() {
  const { logActivity } = useData();
  const { currentUser, users } = useAuth();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function resetPassword(target) {
    if (!confirm(`Reset ${target.firstName} ${target.lastName}'s password to their default (their username, "${target.username}")?`)) return;
    if (!fbFunctions) { toast('Cloud Functions is not set up — see FIREBASE-SETUP.md.', 'err'); return; }
    toast('Resetting password…');
    const resetUserPassword = httpsCallable(fbFunctions, 'resetUserPassword');
    resetUserPassword({ targetUserId: target.id })
      .then(() => {
        logActivity('Reset Password', `${FN()} reset the password for ${target.firstName} ${target.lastName} to their default`, FN());
        toast('Password reset to default (their username).', 'ok');
      })
      .catch(e => { console.error(e); toast(e.message || 'Could not reset that password.', 'err'); });
  }

  function removeUser(target) {
    if (currentUser.id === target.id) { toast('You cannot remove your own account while logged in.', 'warn'); return; }
    if (target.role === 'Admin' && users.filter(u => u.role === 'Admin').length <= 1) { toast('At least one Admin account must remain.', 'warn'); return; }
    if (!confirm('Remove this user? They will immediately lose access to the system.')) return;
    deleteDoc(doc(fbStore, 'users', target.id))
      .then(() => toast('Removed.', 'warn'))
      .catch(e => { console.error(e); toast('Could not remove the account.', 'err'); });
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">User Accounts</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Add User</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Designation</th><th>Date Added</th><th>Actions</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}><p>No users yet.</p></div></td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.firstName} {u.lastName}</strong></td>
                  <td className="mono">{u.username}</td>
                  <td><span className={'badge ' + (u.role === 'Admin' ? 'b-admin' : 'b-user')}>{u.role || 'User'}</span></td>
                  <td>{u.designation ? <span className="badge b-desig">{u.designation}</span> : <span style={{ color: 'var(--g500)' }}>—</span>}</td>
                  <td>{fd(u.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} onClick={() => resetPassword(u)}>Reset Password</button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeUser(u)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddUserModal({ onClose }) {
  const { g, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const designations = g('designations').length ? g('designations') : ['Collector', 'Brgy Treasurer'];
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [un, setUn] = useState('');
  const [role, setRole] = useState('');
  const [des, setDes] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [okMsg, setOkMsg] = useState(false);
  const [busy, setBusy] = useState(false);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function submit() {
    setErrMsg(''); setOkMsg(false);
    if (!fn || !ln || !un || !role) { setErrMsg('All fields required.'); return; }
    if (role === 'User' && !des) { setErrMsg('Select a designation.'); return; }
    if (un.length < 6) { setErrMsg('Username must be at least 6 characters (it doubles as the default password).'); return; }
    setBusy(true);
    const secAuth = getSecondaryAuth();
    createUserWithEmailAndPassword(secAuth, usernameToEmail(un), un)
      .then(cred => setDoc(doc(fbStore, 'users', cred.user.uid), {
        username: un, firstName: fn, lastName: ln, role, designation: role === 'User' ? des : '', createdAt: nowISO(),
      }))
      .then(() => signOut(secAuth))
      .then(() => {
        logActivity('Add User', `Created ${role} account for ${fn} ${ln}${des ? ' (' + des + ')' : ''}`, FN());
        setOkMsg(true);
        setFn(''); setLn(''); setUn(''); setRole(''); setDes('');
        toast('User created! Default password is their username.', 'ok');
      })
      .catch(e => {
        console.error(e);
        let msg = 'Could not create the account.';
        if (e.code === 'auth/email-already-in-use') msg = 'Username already taken.';
        else if (e.code === 'auth/weak-password') msg = 'Password is too weak.';
        setErrMsg(msg);
      })
      .finally(() => setBusy(false));
  }

  return (
    <Modal title="Add User Account" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Close</button>
      <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create Account'}</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      {okMsg && <div className="smsg" style={{ display: 'block' }}>Account created.</div>}
      <div className="row2">
        <div className="fg"><label>First Name</label><input value={fn} onChange={e => setFn(e.target.value)} /></div>
        <div className="fg"><label>Last Name</label><input value={ln} onChange={e => setLn(e.target.value)} /></div>
      </div>
      <div className="fg"><label>Username</label><input value={un} onChange={e => setUn(e.target.value)} /><div className="hint">Min. 6 characters — this will also be their default password.</div></div>
      <div className="fg">
        <label>Role</label>
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="">Select…</option>
          <option value="Admin">Admin</option>
          <option value="User">User</option>
        </select>
      </div>
      {role !== 'Admin' && (
        <div className="fg">
          <label>Designation {role === 'User' && <span className="req">*</span>}</label>
          <select value={des} onChange={e => setDes(e.target.value)}>
            <option value="">Select…</option>
            {designations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
    </Modal>
  );
}
