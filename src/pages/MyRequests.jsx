import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }
function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function MyRequests() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const requests = g('requests').filter(r => r.userId === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [newOpen, setNewOpen] = useState(false);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function submit(data) {
    const f = forms.find(x => x.id === data.formId);
    if (!f) return 'Form not found.';
    const avail = f.stubs ? f.stubs.filter(x => x.status === 'available').length : 0;
    if (avail < data.qty) return `Only ${avail} stub(s) available.`;
    const reqs = g('requests');
    s('requests', [...reqs, { id: uid(), userId: currentUser.id, formId: data.formId, qty: data.qty, remarks: data.remarks, status: 'Pending', createdAt: nowISO() }]);
    logActivity('Request', `${FN()} requested ${data.qty} stub(s) of ${f.name}`, FN());
    toast('Request submitted!', 'ok');
    setNewOpen(false);
    return null;
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">My Requests</span>
          <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>+ New Request</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Form</th><th>Stubs Requested</th><th>Status</th><th>Stubs Issued</th><th>Remarks</th></tr></thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={6}><div className="empty"><p>No requests yet.</p></div></td></tr>
              ) : requests.map(r => {
                const f = forms.find(x => x.id === r.formId) || {};
                const iss = issuances.find(i => i.reqId === r.id);
                const isSerial = f.formType === 'serial';
                return (
                  <tr key={r.id}>
                    <td>{fd(r.createdAt)}</td>
                    <td><strong>{f.name || '—'}</strong><br /><span className="mono" style={{ fontSize: 12, color: 'var(--g500)' }}>{f.code || ''}</span></td>
                    <td className="mono">{r.qty} stub{r.qty !== 1 ? 's' : ''}</td>
                    <td><span className={'badge b-' + r.status.toLowerCase()}>{r.status}</span></td>
                    <td>
                      {iss ? (iss.stubDetails || []).map((st, idx) => (
                        <div key={idx} className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
                          {idx + 1}. {(!isSerial || st.isPiece) ? `${st.label || st.codeNo}: ${(st.pieces || 0).toLocaleString()} pcs` : `${st.codeNo}: ${st.seriesFrom}–${st.seriesTo}`}
                        </div>
                      )) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--g500)' }}>{r.rejectReason || r.remarks || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {newOpen && <NewRequestModal forms={forms} onClose={() => setNewOpen(false)} onSubmit={submit} />}
    </div>
  );
}

function NewRequestModal({ forms, onClose, onSubmit }) {
  const requestable = forms.filter(f => f.stubs && f.stubs.filter(s => s.status === 'available').length > 0);
  const [formId, setFormId] = useState('');
  const [qty, setQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const selected = requestable.find(f => f.id === formId);
  const avail = selected ? selected.stubs.filter(s => s.status === 'available').length : 0;

  function submit() {
    setErrMsg('');
    const q = parseInt(qty);
    if (!formId || !q || q < 1) { setErrMsg('Select a form type and enter a quantity.'); return; }
    const e = onSubmit({ formId, qty: q, remarks: remarks.trim() });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="sm" title="Request Accountable Form" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Submit Request</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="fg">
        <label>Form Type <span className="req">*</span></label>
        <select value={formId} onChange={e => setFormId(e.target.value)}>
          <option value="">Select form type…</option>
          {requestable.map(f => <option key={f.id} value={f.id}>{f.name} ({f.code}) — {f.stubs.filter(s => s.status === 'available').length} stub(s) avail.</option>)}
        </select>
      </div>
      <div className="fg">
        <label>Number of Stubs Needed <span className="req">*</span></label>
        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 5" />
        <div className="hint">{selected ? `${avail} stub(s) available in stock` : ''}</div>
      </div>
      <div className="fg"><label>Purpose / Remarks</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Brief reason…" /></div>
    </Modal>
  );
}
