import React, { useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import ReportPreviewModal from '../../components/ReportPreviewModal.jsx';
import { fd, MONTH_NAMES, buildRaafHtml } from '../../lib/reports.js';
import { IcView, IcDelete } from '../../components/icons.jsx';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }

export default function MyRaaf() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const rcds = g('rcds');
  const raafs = g('raafs').filter(r => r.userId === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function save({ month, year, reportNo }) {
    const all = g('raafs');
    if (all.some(r => r.userId === currentUser.id && r.reportNo.toLowerCase() === reportNo.toLowerCase())) {
      return 'That Report No. is already in use.';
    }
    const rec = { id: uid(), userId: currentUser.id, userName: FN(), designation: currentUser.designation, reportNo, month, year, createdAt: nowISO() };
    s('raafs', [...all, rec]);
    logActivity('Create RAAF', `${FN()} generated RAAF ${reportNo} for ${MONTH_NAMES[month - 1]} ${year}`, FN());
    toast('RAAF generated.', 'ok');
    setCreating(false);
    view(rec);
    return null;
  }

  function view(r) {
    const html = buildRaafHtml(r.userId, r.year, r.month, r.reportNo, { forms, issuances, rcds, users: [currentUser] });
    if (!html) { toast('Unable to generate RAAF.', 'err'); return; }
    setPreviewing({ title: `RAAF Preview — ${r.reportNo}`, html });
  }

  function del(raafId) {
    const r = raafs.find(x => x.id === raafId);
    if (!r) { toast('RAAF not found.', 'err'); return; }
    if (!confirm(`Delete ${r.reportNo}? This cannot be undone.`)) return;
    s('raafs', g('raafs').filter(x => x.id !== raafId));
    logActivity('Delete RAAF', `${FN()} deleted RAAF ${r.reportNo}`, FN());
    toast('RAAF deleted.', 'warn');
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Report of Accountability for Accountable Forms (RAAF)</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New RAAF</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Report No.</th><th>Period</th><th>Date Generated</th><th>Actions</th></tr></thead>
            <tbody>
              {raafs.length === 0 ? (
                <tr><td colSpan={4}><div className="empty" style={{ padding: 24 }}><p>No RAAF generated yet. Click "+ New RAAF" to create one.</p></div></td></tr>
              ) : raafs.map(r => (
                <tr key={r.id}>
                  <td className="mono"><strong>{r.reportNo}</strong></td>
                  <td>{MONTH_NAMES[r.month - 1]} {r.year}</td>
                  <td>{fd(r.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="icon-btn view" title="View" onClick={() => view(r)}><IcView /></button>
                      <button className="icon-btn del" title="Delete" onClick={() => del(r.id)}><IcDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <CreateRaafModal onClose={() => setCreating(false)} onSave={save} />}
      {previewing && <ReportPreviewModal title={previewing.title} html={previewing.html} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function CreateRaafModal({ onClose, onSave }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reportNo, setReportNo] = useState('');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    if (!month || !year) { setErrMsg('Select the month and year.'); return; }
    if (!reportNo.trim()) { setErrMsg('Enter a Report No.'); return; }
    const e = onSave({ month: parseInt(month), year: parseInt(year), reportNo: reportNo.trim() });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="sm" title="Generate RAAF" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Generate</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="row2">
        <div className="fg">
          <label>Month</label>
          <select value={month} onChange={e => setMonth(e.target.value)}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="fg"><label>Year</label><input type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
      </div>
      <div className="fg"><label>Report No. <span className="req">*</span></label><input value={reportNo} onChange={e => setReportNo(e.target.value)} placeholder="e.g. RAAF-2026-001" /></div>
    </Modal>
  );
}
