import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const PAGE_SIZE = 20;
function fd(d) { return d ? new Date(d).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

export default function Activities() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const act = g('activity').slice().reverse();
  const totalPages = Math.max(1, Math.ceil(act.length / PAGE_SIZE));
  const curPage = Math.min(Math.max(page, 1), totalPages);
  const start = (curPage - 1) * PAGE_SIZE;
  const pageRows = act.slice(start, start + PAGE_SIZE);

  function clearLog() {
    if (!(currentUser && currentUser.role === 'Admin')) return;
    const count = g('activity').length;
    if (!count) { toast('Activity log is already empty.', 'err'); return; }
    if (!confirm(`Clear all ${count} activity log entr${count === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
    s('activity', []);
    const fn = currentUser.firstName + ' ' + currentUser.lastName;
    logActivity('Admin', `${fn} cleared the activity log (${count} entr${count === 1 ? 'y' : 'ies'} removed).`, fn);
    setPage(1);
    toast('Activity log cleared.', 'ok');
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Activities</span>
          {currentUser.role === 'Admin' && <button className="btn btn-outline btn-sm" onClick={clearLog}>Clear Log</button>}
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Detail</th><th>By</th></tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={4}><div className="empty" style={{ padding: 20 }}><p>No activity yet.</p></div></td></tr>
              ) : pageRows.map((a, i) => (
                <tr key={a.id || i}>
                  <td>{fd(a.d)}</td>
                  <td><span className={'badge b-' + (a.t === 'Request' ? 'pending' : a.t === 'Issue' ? 'issued' : 'admin')}>{a.t}</span></td>
                  <td>{a.det}</td>
                  <td>{a.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px' }}>
          <span style={{ fontSize: 12, color: 'var(--g500)' }}>
            {act.length === 0 ? 'No activity yet.' : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, act.length)} of ${act.length} · Page ${curPage} of ${totalPages}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-outline btn-sm" disabled={curPage >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
