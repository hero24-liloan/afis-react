import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import ReportPreviewModal from '../components/ReportPreviewModal.jsx';
import { fd, MONTH_NAMES, craafRows, buildCraafHtml } from '../lib/reports.js';
import { IcView, IcDelete } from '../components/icons.jsx';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }

export default function Craaf() {
  const { g, s, logActivity } = useData();
  const { currentUser, users } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const rcds = g('rcds');
  const craafs = g('craafs').slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function save({ month, year, reportNo }) {
    const all = g('craafs');
    if (all.some(c => c.reportNo.toLowerCase() === reportNo.toLowerCase())) return 'That Report No. is already in use.';
    const rows = craafRows(year, month, users, forms, issuances, rcds);
    if (!rows.length) return 'No user RAAF data found for that month — nothing to consolidate.';
    const rec = { id: uid(), reportNo, month, year, treasurerName: FN(), createdBy: FN(), createdAt: nowISO() };
    s('craafs', [...all, rec]);
    logActivity('Generate CRAAF', `${FN()} generated CRAAF ${reportNo} for ${MONTH_NAMES[month - 1]} ${year}`, FN());
    toast('CRAAF generated.', 'ok');
    setCreating(false);
    view(rec);
    return null;
  }

  function view(c) {
    const html = buildCraafHtml(c.year, c.month, c.reportNo, c.treasurerName, { forms, issuances, rcds, users });
    if (!html) { toast('Unable to generate CRAAF.', 'err'); return; }
    setPreviewing({ title: `CRAAF Preview — ${c.reportNo}`, html });
  }

  function del(craafId) {
    const c = g('craafs').find(x => x.id === craafId);
    if (!c) { toast('CRAAF not found.', 'err'); return; }
    if (!confirm(`Delete ${c.reportNo}? This cannot be undone.`)) return;
    s('craafs', g('craafs').filter(x => x.id !== craafId));
    logActivity('Delete CRAAF', `${FN()} deleted CRAAF ${c.reportNo}`, FN());
    toast('CRAAF deleted.', 'warn');
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Consolidated Report of Accountability for Accountable Forms (CRAAF)</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Generate CRAAF</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Report No.</th><th>Period</th><th>Treasurer</th><th>Date Generated</th><th>Actions</th></tr></thead>
            <tbody>
              {craafs.length === 0 ? (
                <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}><p>No CRAAF generated yet. Click "+ Generate CRAAF" to consolidate all officers' RAAF for a month.</p></div></td></tr>
              ) : craafs.map(c => (
                <tr key={c.id}>
                  <td className="mono"><strong>{c.reportNo}</strong></td>
                  <td>{MONTH_NAMES[c.month - 1]} {c.year}</td>
                  <td>{c.treasurerName || ''}</td>
                  <td>{fd(c.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="icon-btn view" title="View" onClick={() => view(c)}><IcView /></button>
                      <button className="icon-btn del" title="Delete" onClick={() => del(c.id)}><IcDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <CreateCraafModal onClose={() => setCreating(false)} onSave={save} />}
      {previewing && <ReportPreviewModal title={previewing.title} html={previewing.html} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function CreateCraafModal({ onClose, onSave }) {
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
    <Modal size="sm" title="Generate CRAAF" onClose={onClose} footer={<>
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
      <div className="fg"><label>Report No. <span className="req">*</span></label><input value={reportNo} onChange={e => setReportNo(e.target.value)} placeholder="e.g. CRAAF-2026-01" /></div>
    </Modal>
  );
}
