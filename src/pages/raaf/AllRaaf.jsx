import React, { useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import ReportPreviewModal from '../../components/ReportPreviewModal.jsx';
import { fd, MONTH_NAMES, buildRaafHtml } from '../../lib/reports.js';
import { IcView, IcDelete } from '../../components/icons.jsx';

export default function AllRaaf() {
  const { g, s, logActivity } = useData();
  const { currentUser, users } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const rcds = g('rcds');
  const [q, setQ] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  const raafs = g('raafs').filter(r => {
    const u = users.find(x => x.id === r.userId) || {};
    return [r.reportNo, u.firstName, u.lastName, u.username, r.designation, u.designation].join(' ').toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function view(r) {
    const html = buildRaafHtml(r.userId, r.year, r.month, r.reportNo, { forms, issuances, rcds, users });
    if (!html) { toast('Unable to generate RAAF.', 'err'); return; }
    setPreviewing({ title: `RAAF Preview — ${r.reportNo}`, html });
  }

  function del(raafId) {
    const r = g('raafs').find(x => x.id === raafId);
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
          <span className="card-title">All RAAF</span>
          <div className="sbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" /></div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Report No.</th><th>Officer</th><th>Designation</th><th>Period</th><th>Date Generated</th><th>Actions</th></tr></thead>
            <tbody>
              {raafs.length === 0 ? (
                <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}><p>No RAAF filed by any user yet.</p></div></td></tr>
              ) : raafs.map(r => {
                const u = users.find(x => x.id === r.userId) || {};
                return (
                  <tr key={r.id}>
                    <td className="mono"><strong>{r.reportNo}</strong></td>
                    <td><strong>{r.userName || (u.firstName + ' ' + u.lastName)}</strong></td>
                    <td><span className="badge b-desig">{r.designation || u.designation || ''}</span></td>
                    <td>{MONTH_NAMES[r.month - 1]} {r.year}</td>
                    <td>{fd(r.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn view" title="View" onClick={() => view(r)}><IcView /></button>
                        <button className="icon-btn del" title="Delete" onClick={() => del(r.id)}><IcDelete /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {previewing && <ReportPreviewModal title={previewing.title} html={previewing.html} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
