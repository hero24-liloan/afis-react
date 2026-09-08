import React, { useMemo, useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import ReportPreviewModal from '../../components/ReportPreviewModal.jsx';
import { IcView, IcEdit, IcDelete } from '../../components/icons.jsx';
import {
  fd, peso, serNum, padSeries, stubNextSeries, otherFundOf, resolveSeriesTo,
  nextRcdNo, nextRcdNoAvoiding, eligibleRcdStubs, recomputeStubFromRemainingRcds, buildRcdHtml,
} from '../../lib/reports.js';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }

// For a divided-fund stub, the sibling RCD (other fund's half) shares the SAME physical
// series range as this RCD — reporting the same collection event split into two funds'
// bookkeeping. Used to widen exclusion sets when checking what's available to edit, so the
// sibling's claim on that shared range doesn't make the stub look "already fully used up."
function siblingIdsOf(rcd, allRcds) {
  if (!rcd) return [];
  return allRcds.filter(x => x.id !== rcd.id && (
    (rcd.linkedRcdNos || []).includes(x.rcdNo) || (x.linkedRcdNos || []).includes(rcd.rcdNo)
  )).map(x => x.id);
}

export default function MyRcds() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');
  const rcds = g('rcds').filter(r => r.userId === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const allRcds = g('rcds');
  const funds = g('funds').length ? g('funds') : ['General Fund', 'General/SEF', 'Trust Fund', 'CEC'];

  const [creating, setCreating] = useState(false);
  const [editingRcd, setEditingRcd] = useState(null);
  const [previewing, setPreviewing] = useState(null); // { title, html }

  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

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

  function viewRcd(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    const html = buildRcdHtml(rcdId, { forms, issuances, rcds: allRcds });
    if (!html) { toast('Unable to generate RCD.', 'err'); return; }
    setPreviewing({ title: `RCD Preview — ${r.rcdNo}`, html });
  }

  function saveRcd(data, isEdit, editingGroupIds, originalRcd) {
    // data: { rcdNo, fund, date, remarks, checksByFund: { [fund]: [{checkNo,payee,amount}] }, rows: [{formId, stubIdx, toVal, amtVal}] }
    let rcdsList = allRcds.slice();
    if (rcdsList.some(x => x.rcdNo === data.rcdNo && !(isEdit && editingGroupIds.includes(x.id)))) {
      return 'That Report No. is already in use.';
    }

    let originalGroup = [], originalCreatedAt = nowISO(), originalUserId = currentUser.id, originalUserName = FN(), originalDesignation = currentUser.designation;
    let formsList = forms.slice();

    if (isEdit) {
      originalGroup = rcdsList.filter(x => editingGroupIds.includes(x.id));
      originalCreatedAt = originalRcd.createdAt || nowISO();
      originalUserId = originalRcd.userId || currentUser.id;
      originalUserName = originalRcd.userName || FN();
      originalDesignation = originalRcd.designation || currentUser.designation;

      const originalTouchedKeys = new Set();
      originalGroup.forEach(g2 => (g2.items || []).forEach(it => originalTouchedKeys.add(it.formId + '__' + it.stubIdx)));
      rcdsList = rcdsList.filter(x => !editingGroupIds.includes(x.id));
      originalTouchedKeys.forEach(key => {
        const [formId, stubIdxStr] = key.split('__');
        formsList = recomputeStubFromRemainingRcds(formsList, formId, parseInt(stubIdxStr), rcdsList, FN(), nowISO);
      });
    }

    // Widened only for checking what's available to edit — includes the linked sibling so
    // its claim on the shared series range isn't mistaken for separate prior consumption.
    // The rollback step above intentionally stays narrower (editingGroupIds only), since
    // recomputeStubFromRemainingRcds already correctly folds the sibling's untouched amount
    // back in as the baseline.
    const eligibilityExcludeIds = isEdit ? [...new Set([...editingGroupIds, ...siblingIdsOf(originalRcd, allRcds)])] : [];
    const opts = eligibleRcdStubs(currentUser.id, data.fund, eligibilityExcludeIds, formsList, issuances, rcdsList);
    const byKey = {}; opts.forEach(o => { byKey[o.formId + '__' + o.stubIdx] = o; });

    const items = [];
    const splitGroups = {};
    const stubUpdates = [];

    for (const row of data.rows) {
      const key = row.formId + '__' + row.stubIdx;
      const o = byKey[key]; if (!o) continue;
      const toVal = (row.toVal || '').trim();
      const amtVal = row.amtVal;
      if (!toVal && !amtVal) continue;
      const fieldLabel = o.stub.isPiece ? 'Pieces Issued' : 'Series To';
      if (!toVal || amtVal === '' || amtVal === undefined) return `Fill in both ${fieldLabel} and Amount for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}).`;
      const amt = parseFloat(amtVal);
      if (isNaN(amt) || amt < 0) return `Enter a valid amount for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}).`;
      const st = o.stub;
      const fromN = serNum(stubNextSeries(st)), fullToN = serNum(st.seriesTo);
      let toN;
      if (st.isPiece) {
        const qty = parseInt(toVal.replace(/\D/g, ''), 10);
        const remainBefore = Math.max(0, fullToN - fromN + 1);
        if (isNaN(qty) || qty <= 0) return `Enter a valid number of pieces issued for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}).`;
        if (qty > remainBefore) return `Only ${remainBefore.toLocaleString()} piece(s) remain for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}).`;
        toN = fromN - 1 + qty;
      } else {
        const resolved = resolveSeriesTo(toVal, st.seriesFrom);
        toN = serNum(resolved);
        if (toN < fromN) return `${fieldLabel} for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}) can't be earlier than its next value (${stubNextSeries(st)}).`;
        if (toN > fullToN) return `${fieldLabel} for ${o.formName} (${o.stub.codeNo || o.stub.batchNo}) can't exceed the stub's last series (${st.seriesTo}).`;
      }
      const seriesFrom = padSeries(st.seriesFrom, fromN), seriesTo = padSeries(st.seriesFrom, toN);
      // For piece-count (non-serial) stubs, the printed report's TO column shows exactly what
      // the user typed into Pieces Issued (qtyDisplay) — not the cumulative computed serial
      // number (seriesTo), which is kept internally only for stub-tracking/remaining math.
      const base = {
        formId: o.formId, formName: o.formName, formCode: o.formCode, stubIdx: o.stubIdx,
        batchNo: st.batchNo || '', codeNo: st.codeNo || '', seriesFrom, seriesTo,
        ...(st.isPiece ? { isPiece: true, qtyDisplay: toVal } : {}),
      };
      // Auto-splitting into a sibling fund only happens at creation time. Once the pair
      // exists, each RCD is edited independently — editing this fund's amount must not
      // recompute or rewrite the other fund's already-saved half.
      const otherFund = !isEdit ? otherFundOf(st, data.fund) : null;
      if (otherFund) {
        const half1 = Math.round((amt / 2) * 100) / 100;
        const half2 = Math.round((amt - half1) * 100) / 100;
        items.push({ ...base, amount: half1 });
        if (!splitGroups[otherFund]) splitGroups[otherFund] = [];
        splitGroups[otherFund].push({ ...base, amount: half2 });
      } else {
        items.push({ ...base, amount: amt });
      }
      stubUpdates.push({ formId: o.formId, stubIdx: o.stubIdx, seriesTo, amount: amt });
    }

    // No items is allowed — it means there was no collection to report for this period.
    // The RCD is still filed (as a "nil" report) so the record trail stays continuous.

    stubUpdates.forEach(su => {
      const fi = formsList.findIndex(f => f.id === su.formId); if (fi < 0) return;
      const stubs = formsList[fi].stubs.slice();
      const stObj = { ...stubs[su.stubIdx] };
      // Use the max, not a plain overwrite. For a divided stub, the sibling RCD's own
      // (untouched) claim on this same physical range is already baked into the baseline
      // this was recomputed from — assigning su.seriesTo outright would let shrinking this
      // RCD's own range during an edit regress the shared tracker below what the sibling
      // still legitimately covers, wrongly freeing up series the sibling still claims.
      if (!stObj.reportedSeriesTo || serNum(su.seriesTo) > serNum(stObj.reportedSeriesTo)) {
        stObj.reportedSeriesTo = su.seriesTo;
      }
      stObj.reportedAmount = (stObj.reportedAmount || 0) + su.amount;
      if (stObj.reportedSeriesTo && serNum(stObj.reportedSeriesTo) >= serNum(stObj.seriesTo)) {
        stObj.consumedAt = nowISO(); stObj.consumedBy = FN(); stObj.consumedNotes = `Fully reported and consumed via ${data.rcdNo}`;
      }
      stubs[su.stubIdx] = stObj;
      formsList[fi] = { ...formsList[fi], stubs };
    });

    const total = items.reduce((a, it) => a + it.amount, 0);
    const otherFundNames = Object.keys(splitGroups); // always empty when isEdit, since otherFund is null above
    const linkedNos = [];
    otherFundNames.forEach((ofn, idx) => {
      linkedNos.push(nextRcdNoAvoiding(rcdsList, [data.rcdNo, ...linkedNos]));
    });

    rcdsList.push({
      id: isEdit ? originalRcd.id : uid(),
      rcdNo: data.rcdNo, fund: data.fund, userId: originalUserId, userName: originalUserName, designation: originalDesignation,
      date: data.date, createdAt: originalCreatedAt,
      ...(isEdit ? { updatedAt: nowISO(), updatedBy: FN() } : {}),
      items, totalAmount: total, checks: (data.checksByFund && data.checksByFund[data.fund]) || [], remarks: data.remarks,
      // On edit, keep whatever linked-sibling reference this RCD already had (untouched) —
      // don't recompute it. Only a brand-new split at creation time sets linkedRcdNos here.
      ...(isEdit
        ? (originalRcd.linkedRcdNos && originalRcd.linkedRcdNos.length ? { linkedRcdNos: originalRcd.linkedRcdNos } : {})
        : (linkedNos.length ? { linkedRcdNos: linkedNos } : {})),
    });

    // Sibling RCDs for a divided fund are only created here at initial creation time.
    // On edit, this block never runs (otherFundNames is always empty), so the sibling
    // RCD for the other fund is left completely untouched.
    otherFundNames.forEach((ofn, idx) => {
      const otherItems = splitGroups[ofn];
      const otherTotal = otherItems.reduce((a, it) => a + it.amount, 0);
      rcdsList.push({
        id: uid(),
        rcdNo: linkedNos[idx], fund: ofn, userId: originalUserId, userName: originalUserName, designation: originalDesignation,
        date: data.date, createdAt: originalCreatedAt,
        items: otherItems, totalAmount: otherTotal,
        checks: (data.checksByFund && data.checksByFund[ofn]) || [],
        remarks: `Divided collection — other half of ${data.rcdNo} (${data.fund}).`,
        linkedRcdNos: [data.rcdNo],
      });
    });

    // If this RCD's own number was renamed during edit, fix the sibling's back-reference
    // (linkedRcdNos) so its "split w/ …" display stays accurate — this touches only that
    // one field on the sibling, nothing else (items, checks, remarks, amounts untouched).
    if (isEdit && originalRcd.rcdNo !== data.rcdNo && originalRcd.linkedRcdNos && originalRcd.linkedRcdNos.length) {
      rcdsList = rcdsList.map(x => (
        originalRcd.linkedRcdNos.includes(x.rcdNo)
          ? { ...x, linkedRcdNos: (x.linkedRcdNos || []).map(n => n === originalRcd.rcdNo ? data.rcdNo : n) }
          : x
      ));
    }

    s('rcds', rcdsList);
    s('forms', formsList);

    const splitMsg = linkedNos.length ? ` and split into ${linkedNos.join(', ')} for the other fund(s)` : '';
    if (isEdit) {
      logActivity('Edit RCD', `${FN()} updated ${data.rcdNo} — now covers ${items.length} OR range(s) totaling ${peso(total)}${splitMsg}`, FN());
      toast(`${data.rcdNo} updated.`, 'ok');
    } else {
      logActivity('Create RCD', `${FN()} filed ${data.rcdNo} covering ${items.length} OR range(s) totaling ${peso(total)}${splitMsg}`, FN());
      toast(linkedNos.length ? `${data.rcdNo} and ${linkedNos.join(', ')} saved.` : `${data.rcdNo} saved.`, 'ok');
    }
    setCreating(false);
    setEditingRcd(null);
    return null;
  }

  function openEdit(rcdId) {
    const r = allRcds.find(x => x.id === rcdId);
    if (!r) { toast('RCD not found.', 'err'); return; }
    if (r.completed) { toast('This RCD is marked complete and can no longer be edited. Ask an admin to reopen it first.', 'err'); return; }
    // Edit only this RCD, even if it's part of a divided-fund pair. The linked sibling
    // (other fund's half) must stay untouched — its stub baseline is still respected via
    // stubBaselineExcluding, which counts the sibling's already-reported amount as prior
    // consumption, but its own record is never rewritten from this edit session.
    setEditingRcd({ rcd: r, groupIds: [r.id], group: [r] });
  }

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Report on Collections and Deposits (RCD)</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New RCD</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>RCD No.</th><th>Date</th><th>Fund</th><th>OR Series Covered</th><th>Total Amount</th><th>Stub Status</th><th>Report Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rcds.length === 0 ? (
                <tr><td colSpan={8}><div className="empty" style={{ padding: 24 }}><p>No RCDs filed yet. Click "+ New RCD" to report your OR collections.</p></div></td></tr>
              ) : rcds.map(r => {
                let anyConsumed = false;
                r.items.forEach(it => {
                  const f = forms.find(x => x.id === it.formId);
                  const st = f && f.stubs && f.stubs[it.stubIdx];
                  if (st && st.consumedAt && st.consumedNotes && st.consumedNotes.includes(r.rcdNo)) anyConsumed = true;
                });
                return (
                  <tr key={r.id}>
                    <td className="mono"><strong>{r.rcdNo}</strong></td>
                    <td>{fd(r.date)}</td>
                    <td>
                      <span className="badge b-stub" style={{ fontSize: 10.5 }}>{r.fund || '—'}</span>
                      {r.linkedRcdNos && r.linkedRcdNos.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--g500)', marginTop: 2 }}>split w/ {r.linkedRcdNos.join(', ')}</div>}
                    </td>
                    <td>{r.items.length === 0
                      ? <span style={{ fontSize: 12, color: 'var(--g500)', fontStyle: 'italic' }}>No collection</span>
                      : r.items.map((it, idx) => <div key={idx} className="mono" style={{ fontSize: 12 }}>{it.codeNo}: {it.seriesFrom}–{it.seriesTo}</div>)}</td>
                    <td className="mono">{peso(r.totalAmount)}</td>
                    <td>{anyConsumed ? <span className="badge b-consumed">Stub Consumed</span> : <span className="badge b-ok">Stub Ongoing</span>}</td>
                    <td>{r.completed ? <span className="badge b-complete">✓ Completed</span> : <span className="badge b-pending">Open</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="icon-btn view" title="View" onClick={() => viewRcd(r.id)}><IcView /></button>
                        {r.completed ? (
                          <span style={{ fontSize: 11, color: 'var(--g500)' }}>Locked by admin</span>
                        ) : (
                          <>
                            <button className="icon-btn edit" title="Edit" onClick={() => openEdit(r.id)}><IcEdit /></button>
                            <button className="icon-btn del" title="Delete" onClick={() => deleteRcd(r.id)}><IcDelete /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <CreateRcdModal mode="create" funds={funds} currentUser={currentUser} forms={forms} issuances={issuances} rcds={allRcds}
          onClose={() => setCreating(false)} onSave={data => saveRcd(data, false, [], null)} />
      )}
      {editingRcd && (
        <CreateRcdModal mode="edit" funds={funds} currentUser={currentUser} forms={forms} issuances={issuances} rcds={allRcds}
          editingRcd={editingRcd.rcd} editingGroupIds={editingRcd.groupIds} editingGroup={editingRcd.group}
          onClose={() => setEditingRcd(null)} onSave={data => saveRcd(data, true, editingRcd.groupIds, editingRcd.rcd)} />
      )}
      {previewing && <ReportPreviewModal title={previewing.title} html={previewing.html} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function editPrefillFor(formId, stubIdx, editingGroupIds, rcds) {
  if (!editingGroupIds || !editingGroupIds.length) return null;
  let minFromN = null, maxToN = null, amt = 0, found = false;
  editingGroupIds.forEach(id => {
    const rr = rcds.find(x => x.id === id); if (!rr) return;
    (rr.items || []).forEach(it => {
      if (it.formId === formId && it.stubIdx === stubIdx) {
        found = true; amt += it.amount;
        const fN = serNum(it.seriesFrom), tN = serNum(it.seriesTo);
        if (minFromN === null || fN < minFromN) minFromN = fN;
        if (maxToN === null || tN > maxToN) maxToN = tN;
      }
    });
  });
  if (!found) return null;
  return { minFromN, maxToN, amt };
}

function CreateRcdModal({ mode, funds, currentUser, forms, issuances, rcds, editingRcd, editingGroupIds, editingGroup, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [rcdNo, setRcdNo] = useState(isEdit ? editingRcd.rcdNo : nextRcdNo(rcds));
  const [fund, setFund] = useState(isEdit ? editingRcd.fund : '');
  const [date, setDate] = useState(isEdit ? editingRcd.date : new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState(isEdit ? (editingRcd.remarks || '') : '');
  // checksByFund: { [fundName]: [{ checkNo, payee, amount }] } — a separate check list per
  // fund, since a divided stub can split one RCD's collection across two funds.
  const [checksByFund, setChecksByFund] = useState(() => {
    if (!isEdit) return {};
    const obj = {};
    if (editingRcd.checks && editingRcd.checks.length) obj[editingRcd.fund] = editingRcd.checks.map(c => ({ ...c }));
    (editingGroup || []).forEach(g2 => {
      if (g2.id !== editingRcd.id && g2.checks && g2.checks.length) obj[g2.fund] = g2.checks.map(c => ({ ...c }));
    });
    return obj;
  });
  const [values, setValues] = useState({}); // key -> { to, amt }
  const [errMsg, setErrMsg] = useState('');

  // Widened only for computing what's available to edit — includes the linked sibling so
  // its claim on a shared divided-stub range isn't mistaken for separate prior consumption.
  const editExcludeIds = useMemo(
    () => (isEdit ? [...new Set([...editingGroupIds, ...siblingIdsOf(editingRcd, rcds)])] : []),
    [isEdit, editingGroupIds, editingRcd, rcds]
  );
  const opts = useMemo(() => eligibleRcdStubs(currentUser.id, fund, editExcludeIds, forms, issuances, rcds), [fund, forms, issuances, rcds, editExcludeIds]);

  // Funds that this collection will actually split into, based on which divided-stub
  // rows currently have an entered value. Only relevant at creation time — during edit,
  // each RCD is edited independently, so the sibling fund's checks are never written here.
  const activeSplitFunds = useMemo(() => {
    if (!fund || isEdit) return [];
    const set = new Set();
    opts.forEach(o => {
      const key = o.formId + '__' + o.stubIdx;
      const v = values[key];
      if (!v || (!v.to && !v.amt)) return;
      const otherFund = otherFundOf(o.stub, fund);
      if (otherFund) set.add(otherFund);
    });
    return Array.from(set);
  }, [fund, opts, values, isEdit]);
  const checkFundList = [fund, ...activeSplitFunds].filter(Boolean);

  // Prefill values when opts/fund changes, applying edit prefill where relevant
  useMemo(() => {
    if (!fund) return;
    const next = {};
    opts.forEach(o => {
      const key = o.formId + '__' + o.stubIdx;
      if (isEdit) {
        const pre = editPrefillFor(o.formId, o.stubIdx, editingGroupIds, rcds);
        if (pre) {
          const isPiece = !!o.stub.isPiece;
          const toVal = isPiece ? String(pre.maxToN - pre.minFromN + 1) : padSeries(o.stub.seriesFrom, pre.maxToN);
          next[key] = { to: toVal, amt: pre.amt.toFixed(2) };
          return;
        }
      }
      next[key] = { to: '', amt: '' };
    });
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund]);

  function setRow(key, field, val) {
    setValues(v => ({ ...v, [key]: { ...(v[key] || { to: '', amt: '' }), [field]: val } }));
  }

  const total = Object.values(values).reduce((a, v) => a + (parseFloat(v.amt) || 0), 0);
  const checksTotal = Object.values(checksByFund).reduce((a, rows) => a + rows.reduce((b, c) => b + (parseFloat(c.amount) || 0), 0), 0);

  function fundChecks(fn) {
    return (checksByFund[fn] && checksByFund[fn].length) ? checksByFund[fn] : [{ checkNo: '', payee: '', amount: '' }];
  }
  function addCheckRow(fn) {
    setChecksByFund(cbf => ({ ...cbf, [fn]: [...(cbf[fn] || []), { checkNo: '', payee: '', amount: '' }] }));
  }
  function removeCheckRow(fn, idx) {
    setChecksByFund(cbf => ({ ...cbf, [fn]: (cbf[fn] || []).filter((_, i) => i !== idx) }));
  }
  function updateCheckRow(fn, idx, field, val) {
    setChecksByFund(cbf => {
      const rows = (cbf[fn] && cbf[fn].length ? cbf[fn] : [{ checkNo: '', payee: '', amount: '' }]).slice();
      rows[idx] = { ...rows[idx], [field]: val };
      return { ...cbf, [fn]: rows };
    });
  }

  function collectChecks() {
    const out = {};
    for (const fn of checkFundList) {
      const rows = [];
      for (const c of fundChecks(fn)) {
        const checkNo = (c.checkNo || '').trim(), payee = (c.payee || '').trim(), amtVal = c.amount;
        if (!checkNo && !payee && (amtVal === '' || amtVal === undefined)) continue;
        if (!checkNo || !payee || amtVal === '' || amtVal === undefined) return { error: `Fill in Check No., Payee, and Amount for every check row under ${fn} (or remove the incomplete row).` };
        const amount = parseFloat(amtVal);
        if (isNaN(amount) || amount < 0) return { error: `Enter a valid check amount under ${fn}.` };
        rows.push({ checkNo, payee, amount });
      }
      out[fn] = rows;
    }
    return { checksByFund: out };
  }

  function submit() {
    setErrMsg('');
    if (!fund) { setErrMsg('Select the Fund.'); return; }
    if (!date) { setErrMsg('Select the report date.'); return; }
    if (!rcdNo.trim()) { setErrMsg('Enter a Report No.'); return; }
    const checksResult = collectChecks();
    if (checksResult.error) { setErrMsg(checksResult.error); return; }
    const rows = Object.entries(values).map(([key, v]) => {
      const [formId, stubIdxStr] = key.split('__');
      return { formId, stubIdx: parseInt(stubIdxStr), toVal: v.to, amtVal: v.amt };
    });
    const hasAnyEntry = rows.some(r => (r.toVal || '').trim() || (r.amtVal !== '' && r.amtVal !== undefined));
    let finalRemarks = remarks.trim();
    if (!hasAnyEntry) {
      if (!confirm('No stub entries were filled in. This will file ' + (rcdNo.trim() || 'this RCD') + ' as a report of no collection for this period. Continue?')) return;
      if (!finalRemarks) finalRemarks = 'No collection for this period.';
    }
    const e = onSave({ rcdNo: rcdNo.trim(), fund, date, remarks: finalRemarks, checksByFund: checksResult.checksByFund, rows });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="xl" title={isEdit ? 'Edit Report on Collections and Deposits' : 'New Report on Collections and Deposits'} onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>{isEdit ? 'Save Changes' : 'Save RCD'}</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="row2">
        <div className="fg">
          <label>Report No.</label>
          <input className="rcd-no" value={rcdNo} onChange={e => setRcdNo(e.target.value)} placeholder="e.g. RCD-2026-001" />
          {isEdit && editingGroup.length > 1 && (
            <div className="hint">Linked with {editingGroup.filter(g2 => g2.id !== editingRcd.id).map(g2 => g2.rcdNo).join(', ')}</div>
          )}
        </div>
        <div className="fg">
          <label>Fund <span className="req">*</span></label>
          <select value={fund} onChange={e => setFund(e.target.value)}>
            <option value="">Select fund…</option>
            {funds.map(fn => <option key={fn} value={fn}>{fn}</option>)}
          </select>
        </div>
      </div>
      <div className="row2">
        <div className="fg"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="fg"><label>Officer</label><div style={{ fontSize: 13, color: 'var(--g600)', paddingTop: 8 }}>{currentUser.firstName} {currentUser.lastName} ({currentUser.designation || '—'})</div></div>
      </div>

      <div className="fg"><label>Stubs to Report</label></div>
      {!fund ? (
        <div className="empty" style={{ padding: 20 }}><p>Select a Fund above to view its stubs.</p></div>
      ) : opts.length === 0 ? (
        <div className="empty" style={{ padding: 20 }}><p>No stubs tagged with this fund are pending collection report right now.</p></div>
      ) : (
        <div className="tw">
          <table>
            <thead><tr><th>Form</th><th>Batch / Code</th><th>Full Series</th><th>Reported</th><th>Next From</th><th>To / Qty</th><th>Remaining</th><th>Amount</th></tr></thead>
            <tbody>
              {opts.map(o => {
                const key = o.formId + '__' + o.stubIdx;
                const st = o.stub;
                const isPiece = !!st.isPiece;
                const nextFrom = stubNextSeries(st);
                const fullToN = serNum(st.seriesTo);
                const referenceN = serNum(nextFrom) - 1;
                const initRemain = Math.max(0, fullToN - referenceN);
                const otherFund = st.isDivided ? otherFundOf(st, fund) : null;
                const v = values[key] || { to: '', amt: '' };
                let remain = initRemain;
                if (isPiece) {
                  const qty = v.to ? (parseInt(String(v.to).replace(/\D/g, ''), 10) || 0) : 0;
                  remain = Math.max(0, initRemain - qty);
                } else if (v.to) {
                  const resolved = resolveSeriesTo(v.to, st.seriesFrom);
                  const toN = resolved ? serNum(resolved) : referenceN;
                  remain = Math.max(0, fullToN - toN);
                }
                return (
                  <tr key={key}>
                    <td><strong>{o.formName}</strong><br /><span className="mono" style={{ fontSize: 11, color: 'var(--g500)' }}>{o.formCode}</span>
                      {otherFund && (
                        <div style={{ fontSize: 10.5, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
                          {isEdit ? `⚠ Originally split 50/50 with ${otherFund} — editing here only updates this fund's own RCD` : `⚠ Split 50/50 with ${otherFund}`}
                        </div>
                      )}
                    </td>
                    <td><span className="badge b-stub" style={{ fontSize: 10 }}>{st.batchNo || '—'}</span> <span className="mono" style={{ fontSize: 11 }}>/ {st.codeNo || '—'}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{isPiece ? `${(st.pieces || fullToN).toLocaleString()} pcs / stub` : `${st.seriesFrom}–${st.seriesTo}`}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{st.reportedSeriesTo ? (isPiece ? `${serNum(st.reportedSeriesTo).toLocaleString()} pcs issued` : `up to ${st.reportedSeriesTo}`) : '—'}</td>
                    <td className="mono">{isPiece ? '—' : nextFrom}</td>
                    <td><input className="mono" style={{ width: 110 }} value={v.to} onChange={e => setRow(key, 'to', e.target.value)} placeholder={isPiece ? `e.g. ${Math.min(initRemain, 50)}` : 'e.g. 001250'} /></td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>{remain.toLocaleString()}{isPiece ? ' pcs' : ''}</td>
                    <td><input type="number" min="0" step="0.01" style={{ width: 100 }} value={v.amt} onChange={e => setRow(key, 'amt', e.target.value)} placeholder="0.00" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ textAlign: 'right', margin: '10px 0', fontWeight: 700 }}>Total: {peso(total)}</div>

      <div className="fg"><label>Checks Received (optional)</label>
        {activeSplitFunds.length > 0 && <div className="hint">This collection splits across funds — record checks separately for each below.</div>}
      </div>
      {checkFundList.map(fn => (
        <div className="check-fund-group" key={fn}>
          {checkFundList.length > 1 && (
            <div className="cfg-hd">
              <span className="badge b-stub">{fn}</span>
              <span className="cfg-note">{fn === fund ? 'primary fund' : 'split fund'}</span>
            </div>
          )}
          <div className="tw">
            <table>
              <thead><tr><th>Check No.</th><th>Payee</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {fundChecks(fn).map((c, idx) => (
                  <tr key={idx}>
                    <td><input value={c.checkNo} onChange={e => updateCheckRow(fn, idx, 'checkNo', e.target.value)} placeholder="e.g. 0001234" /></td>
                    <td><input value={c.payee} onChange={e => updateCheckRow(fn, idx, 'payee', e.target.value)} placeholder="Payee name" /></td>
                    <td><input type="number" min="0" step="0.01" value={c.amount} onChange={e => updateCheckRow(fn, idx, 'amount', e.target.value)} placeholder="0.00" /></td>
                    <td style={{ textAlign: 'center' }}><button className="btn btn-outline" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => removeCheckRow(fn, idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => addCheckRow(fn)}>+ Add Check Row</button>
        </div>
      ))}
      <div style={{ textAlign: 'right', margin: '10px 0', fontWeight: 700 }}>Checks Total: {peso(checksTotal)}</div>

      <div className="fg"><label>Remarks</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
    </Modal>
  );
}
