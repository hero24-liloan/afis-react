import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { IcUnlock, IcDelete } from '../components/icons.jsx';

function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

// Deterministic color per fund name, drawn from the app's existing accent palette.
const FUND_PALETTE = [
  { bg: 'rgba(15,32,54,.09)', c: 'var(--navy)' },
  { bg: 'rgba(169,121,31,.14)', c: 'var(--gold)' },
  { bg: 'rgba(14,125,115,.13)', c: 'var(--teal)' },
  { bg: 'rgba(47,111,237,.13)', c: 'var(--blue)' },
  { bg: 'rgba(109,63,202,.13)', c: 'var(--purple)' },
  { bg: 'rgba(21,128,61,.13)', c: 'var(--green)' },
  { bg: 'rgba(193,95,20,.13)', c: 'var(--orange)' },
  { bg: 'rgba(192,54,44,.13)', c: 'var(--red)' },
];
function fundColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FUND_PALETTE[h % FUND_PALETTE.length];
}

export default function Issuances() {
  const { g, s, logActivity } = useData();
  const { currentUser, users, sessionPassword } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  function exportExcel() {
    setExporting(true);
    import('../lib/excelExport.js')
      .then(({ exportIssuancesToExcel }) => exportIssuancesToExcel(issuances, users, forms, sessionPassword))
      .then(() => {
        logActivity('Export Issuances', `${FN()} exported issuance records to a password-protected Excel file`, FN());
        toast('Issuance records exported.', 'ok');
      })
      .catch(e => { console.error(e); toast('Could not export — please try again.', 'err'); })
      .finally(() => setExporting(false));
  }

  const filteredIss = issuances.filter(iss => {
    const u = users.find(x => x.id === iss.userId) || {};
    const f = forms.find(x => x.id === iss.formId) || {};
    return [u.firstName, u.lastName, f.name, f.code, iss.recipName].join(' ').toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));

  function clearIssuance(issId) {
    const iss = issuances.find(x => x.id === issId);
    if (!iss) { toast('Issuance not found.', 'err'); return; }
    const list = forms.slice();
    const touched = [];
    list.forEach((f, fIdx) => { (f.stubs || []).forEach((st, si) => { if (st.issuanceId === issId) touched.push({ fIdx, si }); }); });
    const usedCount = touched.filter(({ fIdx, si }) => { const st = list[fIdx].stubs[si]; return st.consumedAt || st.reportedSeriesTo; }).length;
    if (usedCount > 0) { toast(`Cannot clear — ${usedCount} stub(s) in this issuance have already been reported or consumed.`, 'err'); return; }
    if (!confirm(`Clear this issuance? ${touched.length} stub(s) will be returned to available stock and the issuance record will be deleted. This cannot be undone.`)) return;
    touched.forEach(({ fIdx, si }) => {
      const stubs = list[fIdx].stubs.slice();
      stubs[si] = { ...stubs[si], status: 'available', issuanceId: null, fund: null, isDivided: false, splitFund: null };
      list[fIdx] = { ...list[fIdx], stubs, remainingStubs: stubs.filter(x => x.status === 'available').length };
    });
    s('forms', list);
    s('issuances', issuances.filter(x => x.id !== issId));
    logActivity('Clear Issuance', `${FN()} cleared an issuance of ${touched.length} stub(s) issued to ${iss.recipName || ''}`, FN());
    toast('Issuance cleared.', 'warn');
  }

  function unlockFund(formId, stubIdx) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    if (fi < 0 || !list[fi].stubs?.[stubIdx]) { toast('Stub not found.', 'err'); return; }
    const st = list[fi].stubs[stubIdx];
    if (!st.fund) { toast('This stub has no fund set.', 'warn'); return; }
    if (st.reportedSeriesTo) { toast('Cannot unlock — this stub already has collections reported against it in an RCD.', 'err'); return; }
    if (!confirm(`Unlock the fund ("${st.fund}") for this stub? The user will be able to choose a new fund for it.`)) return;
    const stubs = list[fi].stubs.slice();
    stubs[stubIdx] = { ...stubs[stubIdx], fund: null, isDivided: false, splitFund: null };
    list[fi] = { ...list[fi], stubs };
    s('forms', list);
    logActivity('Unlock Stub Fund', `${FN()} unlocked the fund selection for a ${list[fi].name} stub`, FN());
    toast('Fund unlocked.', 'warn');
  }

  const rows = [];
  filteredIss.forEach(iss => {
    const u = users.find(x => x.id === iss.userId) || {};
    const f = forms.find(x => x.id === iss.formId) || {};
    const isSerial = f.formType === 'serial';
    const formStubs = (f.stubs || []).map((st, fi) => ({ ...st, _fi: fi })).filter(st => st.issuanceId === iss.id);
    const details = iss.stubDetails || [];
    const count = Math.max(formStubs.length, details.length);
    for (let i = 0; i < count; i++) {
      const fs = formStubs[i] || null;
      const sd = details[i] || null;
      if (tab === 'consumed' && !(fs && fs.consumedAt)) continue;
      rows.push({ iss, u, f, fs, sd, i, isFirst: i === 0 });
    }
  });

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Issuance Records</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" disabled={exporting} onClick={exportExcel}>{exporting ? 'Exporting…' : '⬇ Export to Excel'}</button>
            <div className="batch-mode-tabs" style={{ marginBottom: 0, width: 'auto' }}>
              <button className={'batch-tab' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>All</button>
              <button className={'batch-tab' + (tab === 'consumed' ? ' active' : '')} onClick={() => setTab('consumed')}>Consumed</button>
            </div>
            <div className="sbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" /></div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date Issued</th><th>Issued To</th><th>Form</th><th>Stub</th><th>Batch</th><th>Fund</th><th>Consumed</th><th>Manage</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><div className="empty" style={{ padding: 20 }}><p>{tab === 'consumed' ? 'No consumed stubs yet.' : 'No issuances yet.'}</p></div></td></tr>
              ) : rows.map((row, ri) => {
                const { iss, u, f, fs, sd, i, isFirst } = row;
                const isSerial = f.formType === 'serial';
                let stubLabel;
                if (isSerial) {
                  const code = (fs && fs.codeNo) || (sd && sd.codeNo) || `Stub ${i + 1}`;
                  const from = (fs && fs.seriesFrom) || (sd && sd.seriesFrom) || '';
                  const to = (fs && fs.seriesTo) || (sd && sd.seriesTo) || '';
                  stubLabel = <span className="mono" style={{ fontSize: 12 }}><strong>{code}</strong>{from && <><br /><span style={{ color: 'var(--g500)' }}>{from}–{to}</span></>}</span>;
                } else {
                  const label = (fs && fs.label) || (sd && sd.label) || `Stub ${i + 1}`;
                  const pcs = (fs && fs.pieces) || (sd && sd.pieces) || 0;
                  stubLabel = <span className="mono" style={{ fontSize: 12 }}><strong>{label}</strong><br /><span style={{ color: 'var(--g500)' }}>{pcs.toLocaleString()} pcs</span></span>;
                }
                let consumedCell;
                if (fs && fs.consumedAt) {
                  consumedCell = <><span className="badge b-consumed">✓ Consumed</span><div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 2 }}>{fd(fs.consumedAt)}</div>{fs.consumedNotes && <div style={{ fontSize: 10, color: 'var(--g400)', marginTop: 1 }}>{fs.consumedNotes}</div>}</>;
                } else {
                  consumedCell = <span style={{ fontSize: 11, color: 'var(--g300)' }}>—</span>;
                }
                let fundCell = <span style={{ fontSize: 11, color: 'var(--g300)' }}>—</span>;
                if (fs) {
                  if (fs.fund) {
                    const fc = fundColor(fs.fund);
                    fundCell = (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span className="badge" style={{ fontSize: 10.5, background: fc.bg, color: fc.c }}>{fs.fund}</span>
                        {fs.isDivided && fs.splitFund && (() => { const fc2 = fundColor(fs.splitFund); return <span className="badge" style={{ fontSize: 10.5, background: fc2.bg, color: fc2.c }}>{fs.splitFund}</span>; })()}
                      </div>
                    );
                  } else {
                    fundCell = <span style={{ fontSize: 11, color: 'var(--g400)' }}>Not set</span>;
                  }
                }
                return (
                  <tr key={ri}>
                    <td>{fd(iss.issuedAt)}</td>
                    <td><strong>{iss.recipName}</strong><br /><span className="badge b-desig" style={{ marginTop: 3 }}>{u.designation || '—'}</span></td>
                    <td><strong>{f.name || '—'}</strong><br /><span className="mono" style={{ fontSize: 11, color: 'var(--g500)' }}>{f.code || ''}</span></td>
                    <td>{stubLabel}</td>
                    <td><span className="badge b-stub" style={{ fontSize: 10 }}>{(fs && fs.batchNo) || '—'}</span></td>
                    <td>{fundCell}</td>
                    <td>{consumedCell}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {fs && fs.fund && <button className="icon-btn reopen" title="Unlock Fund" onClick={() => unlockFund(iss.formId, fs._fi)}><IcUnlock /></button>}
                        {isFirst && <button className="icon-btn del" title="Clear Issuance" onClick={() => clearIssuance(iss.id)}><IcDelete /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
