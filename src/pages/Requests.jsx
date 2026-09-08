import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }
function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function Requests() {
  const { g, s, logActivity } = useData();
  const { currentUser, users } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const requests = g('requests');
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [issuing, setIssuing] = useState(null); // request being issued
  const [rejecting, setRejecting] = useState(null); // request being rejected
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  const list = requests.filter(r => {
    if (tab === 'pending' && r.status !== 'Pending') return false;
    const u = users.find(x => x.id === r.userId) || {};
    const f = forms.find(x => x.id === r.formId) || {};
    return [u.firstName, u.lastName, u.designation, f.name, f.code, r.status].join(' ').toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function reject(reqId, reason) {
    const list2 = requests.slice();
    const req = list2.find(r => r.id === reqId);
    if (req) { req.status = 'Rejected'; req.resolvedAt = nowISO(); req.rejectReason = reason; s('requests', list2); }
    const u = users.find(x => x.id === (req && req.userId)) || {};
    logActivity('Reject', `Rejected request from ${u.firstName || ''} ${u.lastName || ''}`, FN());
    toast('Rejected.', 'warn');
    setRejecting(null);
  }

  function issue(reqId, data) {
    const forms2 = forms.slice();
    const fi = forms2.findIndex(f => f.id === data.formId);
    if (fi < 0) return 'Form not found.';
    const isSerial = forms2[fi].formType === 'serial';
    const availStubs = forms2[fi].stubs ? forms2[fi].stubs.filter(x => x.status === 'available').length : 0;
    if (availStubs < data.stubDetails.length) return `Only ${availStubs} stub(s) available.`;

    const issuances = g('issuances');
    const issId = uid();
    s('issuances', [...issuances, {
      id: issId, reqId, userId: data.userId, formId: data.formId,
      recipName: data.recip, stubDetails: data.stubDetails, qty: data.stubDetails.length,
      remarks: data.remarks, issuedBy: FN(), issuedAt: nowISO(),
    }]);

    const stubs = forms2[fi].stubs.slice();
    const matchKey = s2 => isSerial ? s2.status === 'available' && data.stubDetails.some(d => d.codeNo === s2.codeNo)
      : s2.status === 'available' && data.stubDetails.some(d => d.label === s2.label);
    let marked = 0;
    stubs.forEach((s2, i) => { if (marked < data.stubDetails.length && matchKey(s2)) { stubs[i] = { ...s2, status: 'issued', issuanceId: issId }; marked++; } });
    if (marked < data.stubDetails.length) {
      let needed = data.stubDetails.length - marked;
      stubs.forEach((s2, i) => { if (needed > 0 && s2.status === 'available') { stubs[i] = { ...s2, status: 'issued', issuanceId: issId }; needed--; } });
    }
    forms2[fi] = { ...forms2[fi], stubs, remainingStubs: stubs.filter(x => x.status === 'available').length, totalStubs: stubs.length };
    s('forms', forms2);

    const reqs2 = requests.slice();
    const req = reqs2.find(r => r.id === reqId);
    if (req) { req.status = 'Issued'; req.resolvedAt = nowISO(); }
    s('requests', reqs2);

    const u = users.find(x => x.id === data.userId) || {};
    const pcsNote = !isSerial ? ` (${data.stubDetails.reduce((a, x) => a + (x.pieces || 0), 0).toLocaleString()} pcs)` : '';
    logActivity('Issue', `Issued ${data.stubDetails.length} stub(s)${pcsNote} of ${forms2[fi].name} to ${u.firstName || ''} ${u.lastName || ''}`, FN());
    toast('Issued successfully!', 'ok');
    setIssuing(null);
    return null;
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Form Requests</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="batch-mode-tabs" style={{ marginBottom: 0, width: 'auto' }}>
              <button className={'batch-tab' + (tab === 'pending' ? ' active' : '')} onClick={() => setTab('pending')}>Pending</button>
              <button className={'batch-tab' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>All History</button>
            </div>
            <div className="sbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" /></div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Requested By</th><th>Designation</th><th>Form</th><th>Stubs Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7}><div className="empty" style={{ padding: 20 }}><p>{tab === 'pending' ? 'No pending requests.' : 'No requests found.'}</p></div></td></tr>
              ) : list.map(r => {
                const u = users.find(x => x.id === r.userId) || {};
                const f = forms.find(x => x.id === r.formId) || {};
                return (
                  <tr key={r.id}>
                    <td>{fd(r.createdAt)}</td>
                    <td><strong>{u.firstName} {u.lastName}</strong></td>
                    <td><span className="badge b-desig">{u.designation || '—'}</span></td>
                    <td><strong>{f.name || '—'}</strong><br /><span className="mono" style={{ fontSize: 12, color: 'var(--g500)' }}>{f.code || ''}</span></td>
                    <td className="mono">{r.qty} stub{r.qty !== 1 ? 's' : ''}</td>
                    <td><span className={'badge b-' + r.status.toLowerCase()}>{r.status}</span></td>
                    <td>
                      {r.status === 'Pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-green btn-sm" onClick={() => setIssuing(r)}>Issue</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setRejecting(r)}>Reject</button>
                        </div>
                      ) : <span style={{ fontSize: 12, color: 'var(--g500)' }}>{fd(r.resolvedAt)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {issuing && <IssueModal req={issuing} onClose={() => setIssuing(null)} onIssue={issue} />}
      {rejecting && <RejectModal req={rejecting} onClose={() => setRejecting(null)} onReject={reject} />}
    </div>
  );
}

function IssueModal({ req, onClose, onIssue }) {
  const { g } = useData();
  const { users } = useAuth();
  const forms = g('forms');
  const u = users.find(x => x.id === req.userId) || {};
  const f = forms.find(x => x.id === req.formId) || {};
  const isSerial = f.formType === 'serial';
  const availStubs = f.stubs ? f.stubs.filter(s => s.status === 'available').length : 0;
  const avail = f.stubs ? f.stubs.filter(s => s.status === 'available') : [];

  const [recip, setRecip] = useState(u.firstName + ' ' + u.lastName);
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState(() => Array.from({ length: req.qty }, (_, i) => {
    const pre = avail[i] || null;
    return isSerial
      ? { code: pre?.codeNo || '', from: pre?.seriesFrom || '', to: pre?.seriesTo || '' }
      : { label: pre?.label || 'Stub #' + (i + 1), pieces: pre?.pieces || f.piecesDefault || 2500 };
  }));
  const [errMsg, setErrMsg] = useState('');

  function updateRow(i, field, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }
  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)); }

  function submit() {
    setErrMsg('');
    if (!recip.trim()) { setErrMsg('Recipient name is required.'); return; }
    if (!rows.length) { setErrMsg('Please enter at least one stub.'); return; }
    let stubDetails;
    if (isSerial) {
      for (const row of rows) if (!row.code || !row.from || !row.to) { setErrMsg('Code No., Series From, and Series To are required for every stub.'); return; }
      stubDetails = rows.map(r => ({ codeNo: r.code.trim(), seriesFrom: r.from.trim(), seriesTo: r.to.trim() }));
    } else {
      for (const row of rows) if (!row.label) { setErrMsg('Every stub needs a label.'); return; }
      stubDetails = rows.map(r => ({ label: r.label.trim(), pieces: parseInt(r.pieces) || 0, isPiece: true }));
    }
    const e = onIssue(req.id, { formId: f.id, userId: req.userId, recip: recip.trim(), remarks: remarks.trim(), stubDetails });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="lg" title="Issue Form" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Confirm Issuance</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="row2" style={{ marginBottom: 10 }}>
        <div className="iitem"><label>Requested By</label><span>{u.firstName} {u.lastName}</span></div>
        <div className="iitem"><label>Designation</label><span>{u.designation || '—'}</span></div>
        <div className="iitem"><label>Form</label><span>{f.name || '—'}</span></div>
        <div className="iitem"><label>Form Code</label><span className="mono">{f.code || '—'}</span></div>
        <div className="iitem"><label>Stubs Requested</label><span className="mono">{req.qty}</span></div>
        <div className="iitem"><label>Stubs Available</label><span className="mono">{availStubs}</span></div>
      </div>
      <div className="fg"><label>Recipient Name</label><input value={recip} onChange={e => setRecip(e.target.value)} /></div>
      <div className="fg"><label>Remarks</label><input value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
      <div className="hint" style={{ marginBottom: 8 }}>Requested: {req.qty} stub(s) | Available: {availStubs} stub(s)</div>
      {rows.map((row, i) => (
        <div key={i} className={'stub-row ' + (isSerial ? 'serial-row' : 'piece-row')}>
          <span className="stub-num">Stub {i + 1}</span>
          {isSerial ? (
            <>
              <div><input placeholder="Code No." value={row.code} onChange={e => updateRow(i, 'code', e.target.value)} /></div>
              <div><input placeholder="Series From" value={row.from} onChange={e => updateRow(i, 'from', e.target.value)} /></div>
              <div><input placeholder="Series To" value={row.to} onChange={e => updateRow(i, 'to', e.target.value)} /></div>
            </>
          ) : (
            <>
              <div><input placeholder="Stub Label" value={row.label} onChange={e => updateRow(i, 'label', e.target.value)} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" placeholder="Pieces" value={row.pieces} onChange={e => updateRow(i, 'pieces', e.target.value)} style={{ maxWidth: 120 }} />
                <span style={{ fontSize: 12, color: 'var(--teal)', whiteSpace: 'nowrap' }}>pcs</span>
              </div>
            </>
          )}
          <button className="del-stub" onClick={() => removeRow(i)}>×</button>
        </div>
      ))}
    </Modal>
  );
}

function RejectModal({ req, onClose, onReject }) {
  const [reason, setReason] = useState('');
  return (
    <Modal size="sm" title="Reject Request" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-danger" onClick={() => onReject(req.id, reason)}>Reject Request</button>
    </>}>
      <div className="fg"><label>Reason (optional)</label><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Let the requester know why…" /></div>
    </Modal>
  );
}
