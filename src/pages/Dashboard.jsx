import React, { useMemo } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { IcStack, IcBoxCheck, IcSend, IcCheckCircle, IcClock, IcAlertTriangle } from '../components/icons.jsx';
import { MUNICIPALITY_NAME } from '../lib/reports.js';

// ── Per-user, per-fund stub status (Not Consumed vs Consumed) for serial (OR-type) forms ──
function computeUserFundStubStats(forms, issuances, users) {
  const validForms = forms.filter(f => f.stubs && f.stubs.length);
  const map = {};
  validForms.forEach(f => {
    (f.stubs || []).forEach(s => {
      if (!(s.status === 'issued' || s.status === 'consumed')) return;
      if (!s.issuanceId) return;
      const iss = issuances.find(i => i.id === s.issuanceId);
      if (!iss) return;
      const fund = s.fund || 'Unassigned';
      const key = iss.userId + '|' + fund;
      if (!map[key]) map[key] = { userId: iss.userId, fund, consumed: 0, notConsumed: 0 };
      if (s.consumedAt) map[key].consumed++; else map[key].notConsumed++;
      if (s.isDivided && s.splitFund) {
        // Divided stubs also carry a slice under the split fund — count it there too.
        const key2 = iss.userId + '|' + s.splitFund;
        if (!map[key2]) map[key2] = { userId: iss.userId, fund: s.splitFund, consumed: 0, notConsumed: 0 };
        if (s.consumedAt) map[key2].consumed++; else map[key2].notConsumed++;
      }
    });
  });
  return Object.values(map).map(row => {
    const u = users.find(x => x.id === row.userId) || {};
    row.userName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || 'Unknown User';
    row.designation = u.designation || '—';
    return row;
  }).sort((a, b) => a.userName.localeCompare(b.userName) || a.fund.localeCompare(b.fund));
}

export default function Dashboard() {
  const { ready, data } = useData();
  const { users } = useAuth();
  const forms = data.forms || [];
  const reqs = data.requests || [];
  const iss = data.issuances || [];

  const stats = useMemo(() => {
    const totStubs = forms.reduce((a, f) => a + (f.stubs ? f.stubs.length : 0), 0);
    const remStubs = forms.reduce((a, f) => a + (f.stubs ? f.stubs.filter(s => s.status === 'available').length : 0), 0);
    const issdStubs = iss.reduce((a, i) => a + (i.stubDetails ? i.stubDetails.length : 0), 0);
    const consumedStubs = forms.reduce((a, f) => a + (f.stubs ? f.stubs.filter(s => s.status === 'consumed').length : 0), 0);
    const pend = reqs.filter(r => r.status === 'Pending').length;
    const draftForms = forms.filter(f => !f.stubs || f.stubs.length === 0).length;
    return { totStubs, remStubs, issdStubs, consumedStubs, pend, draftForms, formsCount: forms.length, issCount: iss.length };
  }, [forms, reqs, iss]);

  const rows = useMemo(() => computeUserFundStubStats(forms, iss, users), [forms, iss, users]);

  if (!ready) {
    return <div className="empty" style={{ padding: 40 }}><p>Loading…</p></div>;
  }

  return (
    <div className="pg active">
      <div className="masthead">
        <div>
          <div className="masthead-eyebrow">{MUNICIPALITY_NAME}</div>
          <div className="masthead-title">Office of the Municipal Treasurer</div>
          <div className="masthead-sub">Accountable Forms Inventory — system overview</div>
        </div>
        <div className="masthead-date">
          <div>As of</div>
          <div className="d">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
      <div className="stat-grid">
        <div className="scard c-navy">
          <div className="scard-ic"><IcStack /></div>
          <div className="slabel">Total Stubs</div><div className="sval">{stats.totStubs.toLocaleString()}</div><div className="ssub">{stats.formsCount} form type(s)</div></div>
        <div className="scard c-green">
          <div className="scard-ic"><IcBoxCheck /></div>
          <div className="slabel">Available</div><div className="sval">{stats.remStubs.toLocaleString()}</div><div className="ssub">Stubs in stock</div></div>
        <div className="scard c-gold">
          <div className="scard-ic"><IcSend /></div>
          <div className="slabel">Issued Stubs</div><div className="sval">{stats.issdStubs.toLocaleString()}</div><div className="ssub">{stats.issCount} issuance record(s)</div></div>
        <div className="scard c-teal">
          <div className="scard-ic"><IcCheckCircle /></div>
          <div className="slabel">Consumed</div><div className="sval">{stats.consumedStubs.toLocaleString()}</div>
          <div className="ssub">Stubs fully used</div>
        </div>
        <div className="scard c-orange">
          <div className="scard-ic"><IcClock /></div>
          <div className="slabel">Pending</div><div className="sval">{stats.pend}</div><div className="ssub">Requests awaiting action</div></div>
        {stats.draftForms > 0 && (
          <div className="scard c-purple">
            <div className="scard-ic"><IcAlertTriangle /></div>
            <div className="slabel">No Stubs Yet</div><div className="sval">{stats.draftForms}</div><div className="ssub">Form(s) need stubs added</div></div>
        )}
      </div>
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Accountable Form Stubs by User &amp; Fund</span>
          <span style={{ fontSize: 11.5, color: 'var(--g500)' }}>Consumed vs. not-consumed stub counts, per fund, for every user</span>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Fund</th><th>Not Consumed</th><th>Consumed</th><th>Total</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}><p>No accountable form stubs have been issued yet.</p></div></td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.userName}</strong></td>
                  <td><span className="mono" style={{ fontSize: 11, color: 'var(--g500)' }}>{r.designation}</span></td>
                  <td><span className="badge b-stub" style={{ fontSize: 10.5 }}>{r.fund}</span></td>
                  <td><span className="badge b-ok">{r.notConsumed}</span></td>
                  <td><span className="badge b-consumed">{r.consumed}</span></td>
                  <td className="mono">{r.notConsumed + r.consumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
