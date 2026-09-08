import React, { useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import ReportPreviewModal from '../../components/ReportPreviewModal.jsx';
import { fd, peso, buildRcdHtml, recomputeStubFromRemainingRcds } from '../../lib/reports.js';
import { IcView, IcDelete, IcComplete, IcReopen } from '../../components/icons.jsx';

function nowISO() { return new Date().toISOString(); }

export default function AllRcds() {
  const { g, s, logActivity } = useData();
  const { currentUser, users, sessionPassword } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const allRcds = g('rcds');
  const [q, setQ] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [exporting, setExporting] = useState(false);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function exportExcel() {
    setExporting(true);
    import('../../lib/excelExport.js')
      .then(({ exportRcdsToExcel }) => exportRcdsToExcel(allRcds, users, sessionPassword))
      .then(() => {
        logActivity('Export RCDs', `${FN()} exported all RCDs to a password-protected Excel file`, FN());
        toast('RCD report exported.', 'ok');
      })
      .catch(e => { console.error(e); toast('Could not export — please try again.', 'err'); })
      .finally(() => setExporting(false));
  }

  const rcds = allRcds.filter(r => {
    const u = users.find(x => x.id === r.userId) || {};
    return [r.rcdNo, r.fund, u.firstName, u.lastName, u.username].join(' ').toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function viewRcd(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    const html = buildRcdHtml(rcdId, { forms, issuances, rcds: allRcds });
    if (!html) { toast('Unable to generate RCD.', 'err'); return; }
    setPreviewing({ title: `RCD Preview — ${r.rcdNo}`, html });
  }

  function markComplete(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    if (!r) { toast('RCD not found.', 'err'); return; }
    if (r.completed) { toast('Already marked complete.', 'warn'); return; }
    if (!confirm(`Mark ${r.rcdNo} as complete? ${r.userName || 'The filer'} will no longer be able to edit or delete this report until it is reopened.`)) return;
    const list = allRcds.map(x => {
      if (x.id === r.id) return { ...x, completed: true, completedAt: nowISO(), completedBy: FN() };
      if (Array.isArray(r.linkedRcdNos) && r.linkedRcdNos.includes(x.rcdNo)) return { ...x, completed: true, completedAt: nowISO(), completedBy: FN() };
      return x;
    });
    s('rcds', list);
    logActivity('Mark RCD Complete', `${FN()} marked ${r.rcdNo} as complete`, FN());
    toast(`${r.rcdNo} marked as complete.`, 'ok');
  }

  function unmarkComplete(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    if (!r) { toast('RCD not found.', 'err'); return; }
    if (!r.completed) { toast('This RCD is not marked complete.', 'warn'); return; }
    if (!confirm(`Reopen ${r.rcdNo}? This will allow ${r.userName || 'the filer'} to edit or delete it again.`)) return;
    const list = allRcds.map(x => {
      if (x.id === r.id) { const { completedAt, completedBy, ...rest } = x; return { ...rest, completed: false }; }
      if (Array.isArray(r.linkedRcdNos) && r.linkedRcdNos.includes(x.rcdNo)) { const { completedAt, completedBy, ...rest } = x; return { ...rest, completed: false }; }
      return x;
    });
    s('rcds', list);
    logActivity('Reopen RCD', `${FN()} reopened ${r.rcdNo}`, FN());
    toast(`${r.rcdNo} reopened.`, 'ok');
  }

  function deleteRcd(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    if (!r) { toast('RCD not found.', 'err'); return; }
    if (r.completed) { toast('This RCD is marked complete and can no longer be deleted. Ask an admin to reopen it first.', 'err'); return; }
    const group = [r, ...allRcds.filter(x => x.id !== r.id && ((r.linkedRcdNos || []).includes(x.rcdNo) || (x.linkedRcdNos || []).includes(r.rcdNo)))];
    const groupNos = group.map(x => x.rcdNo).join(', ');
    const msg = group.length > 1
      ? `Delete ${groupNos}? These RCDs are linked as a divided-fund pair and will be deleted together. Affected OR stubs will have their reported series/amount rolled back. This cannot be undone.`
      : `Delete ${r.rcdNo}? The affected OR stub's reported series/amount will be rolled back. This cannot be undone.`;
    if (!confirm(msg)) return;

    const touched = new Set();
    group.forEach(x => (x.items || []).forEach(it => touched.add(it.formId + '__' + it.stubIdx)));
    const groupIds = new Set(group.map(x => x.id));
    const remaining = allRcds.filter(x => !groupIds.has(x.id));
    s('rcds', remaining);

    let updatedForms = forms.slice();
    touched.forEach(key => {
      const [formId, stubIdxStr] = key.split('__');
      updatedForms = recomputeStubFromRemainingRcds(updatedForms, formId, parseInt(stubIdxStr), remaining, FN(), nowISO);
    });
    s('forms', updatedForms);

    logActivity('Delete RCD', `${FN()} deleted ${groupNos}`, FN());
    toast(group.length > 1 ? 'RCDs deleted.' : 'RCD deleted.', 'warn');
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">All RCDs</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" disabled={exporting} onClick={exportExcel}>{exporting ? 'Exporting…' : '⬇ Export to Excel'}</button>
            <div className="sbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" /></div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>RCD No.</th><th>Date</th><th>Filed By</th><th>Fund</th><th>OR Series Covered</th><th>Total Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rcds.length === 0 ? (
                <tr><td colSpan={8}><div className="empty" style={{ padding: 20 }}><p>No RCDs filed yet.</p></div></td></tr>
              ) : rcds.map(r => {
                const u = users.find(x => x.id === r.userId) || {};
                return (
                  <tr key={r.id}>
                    <td className="mono"><strong>{r.rcdNo}</strong></td>
                    <td>{fd(r.date)}</td>
                    <td><strong>{r.userName || (u.firstName + ' ' + u.lastName)}</strong><br /><span className="mono" style={{ fontSize: 11, color: 'var(--g500)' }}>{r.designation || u.designation || ''}</span></td>
                    <td>
                      <span className="badge b-stub" style={{ fontSize: 10.5 }}>{r.fund || '—'}</span>
                      {r.linkedRcdNos && r.linkedRcdNos.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--g500)', marginTop: 2 }}>split w/ {r.linkedRcdNos.join(', ')}</div>}
                    </td>
                    <td>{r.items.length === 0
                      ? <span style={{ fontSize: 12, color: 'var(--g500)', fontStyle: 'italic' }}>No collection</span>
                      : r.items.map((it, idx) => <div key={idx} className="mono" style={{ fontSize: 12 }}>{it.codeNo || it.formCode}: {it.seriesFrom}–{it.seriesTo}</div>)}</td>
                    <td className="mono">{peso(r.totalAmount)}</td>
                    <td>{r.completed
                      ? <><span className="badge b-complete">✓ Completed</span><div style={{ fontSize: 10.5, color: 'var(--g500)', marginTop: 3 }}>{fd(r.completedAt)}</div></>
                      : <span className="badge b-pending">Open</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="icon-btn view" title="View" onClick={() => viewRcd(r.id)}><IcView /></button>
                        {r.completed
                          ? <button className="icon-btn reopen" title="Reopen" onClick={() => unmarkComplete(r.id)}><IcReopen /></button>
                          : <button className="icon-btn complete" title="Mark Complete" onClick={() => markComplete(r.id)}><IcComplete /></button>}
                        <button className="icon-btn del" title="Delete" onClick={() => deleteRcd(r.id)}><IcDelete /></button>
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
