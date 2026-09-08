import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Funds() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  let funds = g('funds');
  if (!funds.length) { funds = ['General Fund', 'General/SEF', 'Trust Fund', 'CEC']; s('funds', funds); }

  function add() {
    setErrMsg('');
    const n = name.trim();
    if (!n) { setErrMsg('Enter a fund name.'); return; }
    if (funds.some(f => f.toLowerCase() === n.toLowerCase())) { setErrMsg('That fund already exists.'); return; }
    s('funds', [...funds, n]);
    setName('');
    logActivity('Add Fund', `${FN()} added fund "${n}"`, FN());
    toast('Fund added!', 'ok');
  }

  function remove(idx) {
    if (!confirm('Remove this fund? Stubs already tagged with it will keep the old value.')) return;
    const nm = funds[idx];
    const next = funds.slice(); next.splice(idx, 1);
    s('funds', next);
    logActivity('Remove Fund', `${FN()} removed fund "${nm || ''}"`, FN());
    toast('Removed.', 'warn');
  }

  return (
    <div className="pg active">
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-hd"><span className="card-title">Funds</span></div>
        <div className="mbody" style={{ padding: '16px 22px 4px' }}>
          <div className="row3" style={{ gridTemplateColumns: '1fr auto' }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label>New Fund Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Special Education Fund"
                onKeyDown={e => { if (e.key === 'Enter') add(); }} />
            </div>
            <div className="fg" style={{ marginBottom: 0, alignSelf: 'end' }}>
              <button className="btn btn-primary" onClick={add}>+ Add Fund</button>
            </div>
          </div>
          {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
        </div>
        <div className="flist-hd"><span>Fund Name</span><span>Actions</span></div>
        {funds.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}><p>No funds yet.</p></div>
        ) : funds.map((f, i) => (
          <div className="frow" key={i}>
            <span className="fname">{f}</span>
            <button className="btn btn-danger btn-sm" onClick={() => remove(i)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
