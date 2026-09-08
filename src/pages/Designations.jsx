import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Designations() {
  const { g, s, logActivity } = useData();
  const { currentUser, users } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  let desigs = g('designations');
  if (!desigs.length) { desigs = ['Collector', 'Brgy Treasurer']; s('designations', desigs); }

  function add() {
    setErrMsg('');
    const n = name.trim();
    if (!n) { setErrMsg('Enter a designation name.'); return; }
    if (desigs.some(d => d.toLowerCase() === n.toLowerCase())) { setErrMsg('That designation already exists.'); return; }
    s('designations', [...desigs, n]);
    setName('');
    logActivity('Add Designation', `${FN()} added designation "${n}"`, FN());
    toast('Designation added!', 'ok');
  }

  function remove(idx) {
    const nm = desigs[idx];
    const inUse = users.filter(u => u.designation === nm).length;
    const msg = inUse > 0 ? `Remove this designation? ${inUse} user account(s) currently use it and will keep the old value.` : 'Remove this designation?';
    if (!confirm(msg)) return;
    const next = desigs.slice(); next.splice(idx, 1);
    s('designations', next);
    logActivity('Remove Designation', `${FN()} removed designation "${nm || ''}"`, FN());
    toast('Removed.', 'warn');
  }

  return (
    <div className="pg active">
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-hd"><span className="card-title">Designations</span></div>
        <div className="mbody" style={{ padding: '16px 22px 4px' }}>
          <div className="row3" style={{ gridTemplateColumns: '1fr auto' }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label>New Designation Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Market Collector"
                onKeyDown={e => { if (e.key === 'Enter') add(); }} />
            </div>
            <div className="fg" style={{ marginBottom: 0, alignSelf: 'end' }}>
              <button className="btn btn-primary" onClick={add}>+ Add Designation</button>
            </div>
          </div>
          {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
        </div>
        <div className="flist-hd"><span>Designation</span><span>Actions</span></div>
        {desigs.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}><p>No designations yet.</p></div>
        ) : desigs.map((d, i) => (
          <div className="frow" key={i}>
            <span className="fname">{d}</span>
            <button className="btn btn-danger btn-sm" onClick={() => remove(i)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
