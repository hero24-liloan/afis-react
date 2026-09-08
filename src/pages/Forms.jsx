import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { IcEdit, IcDelete, IcView, IcAddStubs } from '../components/icons.jsx';

function uid() { return Math.random().toString(36).substr(2, 9); }
function nowISO() { return new Date().toISOString(); }
function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

function fullName(u) { return u ? u.firstName + ' ' + u.lastName : '—'; }

export default function Forms() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances');

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // form being edited
  const [viewingId, setViewingId] = useState(null);
  const [addStubsFor, setAddStubsFor] = useState(null); // form id
  const [editStub, setEditStub] = useState(null); // { formId, idx }

  const FN = () => fullName(currentUser);

  function saveNewForm(data) {
    if (forms.find(f => f.code === data.code)) return 'A form with this code already exists.';
    const newForm = {
      id: uid(), code: data.code, name: data.name, desc: data.desc,
      formType: data.formType, piecesDefault: data.formType === 'piece' ? (parseInt(data.piecesDefault) || 2500) : 0,
      stubs: [], createdAt: nowISO(), totalStubs: 0, remainingStubs: 0,
    };
    s('forms', [...forms, newForm]);
    logActivity('Add Form', `Created form type: ${data.name} (${data.code})`, FN());
    toast('Form added! You can add stubs anytime via "+ Add Stubs".', 'ok');
    setAddOpen(false);
    return null;
  }

  function saveEditForm(data) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === data.id);
    if (fi < 0) return 'Form not found.';
    if (list.find(f => f.code === data.code && f.id !== data.id)) return 'Another form already uses this code.';
    list[fi] = { ...list[fi], code: data.code, name: data.name, desc: data.desc };
    s('forms', list);
    logActivity('Update', `Updated form details: ${data.name}`, FN());
    toast('Form details updated.', 'ok');
    setEditing(null);
    return null;
  }

  function deleteForm(id) {
    if (!confirm('Delete this form and all its stub records? This cannot be undone.')) return;
    s('forms', forms.filter(f => f.id !== id));
    logActivity('Delete', 'Deleted a form type', FN());
    toast('Deleted.', 'warn');
    if (viewingId === id) setViewingId(null);
  }

  function deleteStub(formId, idx) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    const stub = list[fi]?.stubs?.[idx];
    if (!stub) { toast('Stub not found.', 'err'); return; }
    if (stub.status === 'issued') { toast('Cannot delete an issued stub.', 'err'); return; }
    if (!confirm(`Delete stub #${idx + 1}? This cannot be undone.`)) return;
    const newStubs = list[fi].stubs.slice();
    newStubs.splice(idx, 1);
    list[fi] = { ...list[fi], stubs: newStubs, totalStubs: newStubs.length, remainingStubs: newStubs.filter(x => x.status === 'available').length };
    s('forms', list);
    logActivity('Delete Stub', `Deleted stub #${idx + 1} from ${list[fi].name} (${list[fi].code})`, FN());
    toast('Stub deleted.', 'warn');
  }

  function saveEditedStub(formId, idx, data) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    if (fi < 0 || !list[fi].stubs?.[idx]) return 'Stub not found.';
    const isSerial = list[fi].formType === 'serial';
    const stubs = list[fi].stubs.slice();
    if (isSerial) {
      if (!data.batchNo || !data.codeNo || !data.seriesFrom || !data.seriesTo) return 'All fields are required.';
      const dup = stubs.find((x, i) => i !== idx && x.codeNo === data.codeNo && x.batchNo === data.batchNo);
      if (dup) return `Code No. "${data.codeNo}" already exists in batch "${data.batchNo}".`;
      stubs[idx] = { ...stubs[idx], batchNo: data.batchNo, codeNo: data.codeNo, seriesFrom: data.seriesFrom, seriesTo: data.seriesTo };
    } else {
      const pieces = parseInt(data.pieces) || 0;
      if (!data.batchNo || !data.label || pieces < 1) return 'All fields are required and pieces must be at least 1.';
      stubs[idx] = { ...stubs[idx], batchNo: data.batchNo, label: data.label, pieces };
    }
    list[fi] = { ...list[fi], stubs };
    s('forms', list);
    logActivity('Edit Stub', `Edited stub #${idx + 1} of ${list[fi].name} (${list[fi].code})`, FN());
    toast('Stub updated.', 'ok');
    setEditStub(null);
    return null;
  }

  function addStubsBatch(formId, batch) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    if (fi < 0) return 'Form not found.';
    const stubs = (list[fi].stubs || []).slice();
    stubs.push(...batch.newStubs);
    if (list[fi].formType === 'serial' && batch.newStubs.length) {
      list[fi] = { ...list[fi], codePrefix: batch.newStubs[0].codeNo.replace(/\d+$/, '') };
    }
    list[fi] = { ...list[fi], stubs, totalStubs: stubs.length, remainingStubs: stubs.filter(x => x.status === 'available').length };
    s('forms', list);
    const pcsNote = list[fi].formType === 'piece' ? ` (${batch.newStubs.reduce((a, x) => a + (x.pieces || 0), 0).toLocaleString()} pcs)` : '';
    logActivity('Add Stubs', `Added ${batch.newStubs.length} stub(s)${pcsNote} [Batch: ${batch.batchNo}] to ${list[fi].name} (${list[fi].code})`, FN());
    toast(`${batch.newStubs.length} stub(s) added! Batch: ${batch.batchNo}`, 'ok');
    setAddStubsFor(null);
    return null;
  }

  const viewingForm = viewingId ? forms.find(f => f.id === viewingId) : null;
  const addStubsForm = addStubsFor ? forms.find(f => f.id === addStubsFor) : null;
  const editStubData = editStub ? forms.find(f => f.id === editStub.formId)?.stubs?.[editStub.idx] : null;
  const editStubForm = editStub ? forms.find(f => f.id === editStub.formId) : null;

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd">
          <span className="card-title">Accountable Forms Inventory</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Add Form</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Form Code</th><th>Form Name</th><th>Type</th><th>Total Stubs</th><th>Issued</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {forms.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><p>No forms yet. Click "+ Add Form" to begin.</p></div></td></tr>
              ) : forms.map(f => {
                const isSerial = f.formType === 'serial';
                const totalStubs = f.stubs ? f.stubs.length : 0;
                const availStubs = f.stubs ? f.stubs.filter(s2 => s2.status === 'available').length : 0;
                const issuedStubs = totalStubs - availStubs;
                const pct = totalStubs > 0 ? Math.round((availStubs / totalStubs) * 100) : 0;
                const low = pct <= 20 && totalStubs > 0;
                const hasStubs = totalStubs > 0;
                return (
                  <tr key={f.id}>
                    <td><span className="mono">{f.code}</span></td>
                    <td><strong>{f.name}</strong>{f.desc && <><br /><span style={{ fontSize: 12, color: 'var(--g500)' }}>{f.desc}</span></>}</td>
                    <td>{isSerial ? <span className="badge b-serial" style={{ fontSize: 10 }}>Serial</span> : <span className="badge b-piece" style={{ fontSize: 10 }}>Piece Count</span>}</td>
                    <td className="mono">{totalStubs.toLocaleString()}</td>
                    <td className="mono">{issuedStubs.toLocaleString()}</td>
                    <td>{hasStubs ? (
                      <div className="rem-bar"><div className="bar-t"><div className="bar-f" style={{ width: pct + '%', background: low ? 'var(--orange)' : 'var(--green)' }} /></div><span className="mono">{availStubs.toLocaleString()}</span></div>
                    ) : <span style={{ fontSize: 12, color: 'var(--g400)' }}>—</span>}</td>
                    <td>{!hasStubs ? <span className="badge b-draft">No Stubs</span> : low ? <span className="badge b-low">Low Stock</span> : <span className="badge b-ok">In Stock</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="icon-btn add-stubs" title="Add Stubs" onClick={() => setAddStubsFor(f.id)}><IcAddStubs /></button>
                        <button className="icon-btn view" title="View Stubs" onClick={() => setViewingId(f.id)}><IcView /></button>
                        <button className="icon-btn edit" title="Edit Form" onClick={() => setEditing(f)}><IcEdit /></button>
                        <button className="icon-btn del" title="Delete Form" onClick={() => deleteForm(f.id)}><IcDelete /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewingForm && (
        <div className="card">
          <div className="card-hd">
            <div>
              <span className="card-title">Stubs — {viewingForm.name} ({viewingForm.code})</span>
              <div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 3 }}>
                {(viewingForm.stubs || []).length} total · {(viewingForm.stubs || []).filter(x => x.status === 'available').length} available · {(viewingForm.stubs || []).filter(x => x.status !== 'available').length} issued
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-gold btn-sm" onClick={() => setAddStubsFor(viewingForm.id)}>+ Add Stubs</button>
              <button className="btn btn-outline btn-sm" onClick={() => setViewingId(null)}>✕ Close</button>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Batch</th>
                  {viewingForm.formType === 'serial'
                    ? <><th>Code No.</th><th>Series From</th><th>Series To</th></>
                    : <><th>Stub Label</th><th>Pieces</th></>}
                  <th>Status</th><th>Issued To</th><th>Date Issued</th><th>Consumed</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!(viewingForm.stubs || []).length ? (
                  <tr><td colSpan={10}><div className="empty" style={{ padding: 20 }}><p>No stubs yet. Click "+ Add Stubs" to add stock.</p></div></td></tr>
                ) : viewingForm.stubs.map((st, idx) => {
                  let issdTo = '—', issdDate = '—';
                  if (st.issuanceId) {
                    const iss = issuances.find(i => i.id === st.issuanceId);
                    if (iss) { issdTo = iss.recipName; issdDate = fd(iss.issuedAt); }
                  }
                  const canEdit = st.status === 'available';
                  const canDel = st.status === 'available';
                  const statusClass = st.status === 'available' ? 'b-ok' : st.status === 'consumed' ? 'b-consumed' : 'b-issued';
                  return (
                    <tr key={idx}>
                      <td className="mono">{idx + 1}</td>
                      <td><span className="badge b-stub" style={{ fontSize: 10 }}>{st.batchNo || '—'}</span></td>
                      {viewingForm.formType === 'serial' ? (
                        <><td className="mono">{st.codeNo || '—'}</td><td className="mono">{st.seriesFrom || '—'}</td><td className="mono">{st.seriesTo || '—'}</td></>
                      ) : (
                        <><td className="mono">{st.label || 'Stub #' + (idx + 1)}</td><td className="mono">{(st.pieces || 0).toLocaleString()} pcs</td></>
                      )}
                      <td><span className={'badge ' + statusClass}>{st.status}</span></td>
                      <td>{issdTo}</td>
                      <td>{issdDate}</td>
                      <td>
                        {st.consumedAt ? (
                          <><span className="badge b-consumed" style={{ fontSize: 10 }}>✓ Consumed</span><div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 2 }}>{fd(st.consumedAt)}</div></>
                        ) : <span style={{ fontSize: 11, color: 'var(--g300)' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="icon-btn edit" disabled={!canEdit} onClick={() => canEdit && setEditStub({ formId: viewingForm.id, idx })} title="Edit"><IcEdit /></button>
                          {canDel ? (
                            <button className="icon-btn del" onClick={() => deleteStub(viewingForm.id, idx)} title="Delete"><IcDelete /></button>
                          ) : <span style={{ fontSize: 10, color: 'var(--g400)' }}>{st.status === 'consumed' ? 'Consumed' : 'Issued'}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addOpen && <AddFormModal onClose={() => setAddOpen(false)} onSave={saveNewForm} />}
      {editing && <EditFormModal form={editing} onClose={() => setEditing(null)} onSave={saveEditForm} />}
      {addStubsForm && <AddStubsModal form={addStubsForm} onClose={() => setAddStubsFor(null)} onSave={addStubsBatch} />}
      {editStubData && (
        <EditStubModal form={editStubForm} stub={editStubData} idx={editStub.idx}
          onClose={() => setEditStub(null)}
          onSave={data => saveEditedStub(editStub.formId, editStub.idx, data)} />
      )}
    </div>
  );
}

function AddFormModal({ onClose, onSave }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [formType, setFormType] = useState('serial');
  const [piecesDefault, setPiecesDefault] = useState('2500');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    if (!code.trim() || !name.trim()) { setErrMsg('Form Code and Form Name are required.'); return; }
    const e = onSave({ code: code.trim(), name: name.trim(), desc: desc.trim(), formType, piecesDefault });
    if (e) setErrMsg(e);
  }

  return (
    <Modal title="Add Accountable Form" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Save Form</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="row2">
        <div className="fg"><label>Form Code <span className="req">*</span></label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. BIR Form 51" /></div>
        <div className="fg"><label>Form Name <span className="req">*</span></label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Official Receipt" /></div>
      </div>
      <div className="fg"><label>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description…" /></div>
      <div className="fg">
        <label>Form Type</label>
        <select value={formType} onChange={e => setFormType(e.target.value)}>
          <option value="serial">Serial-Numbered (has series numbers)</option>
          <option value="piece">Piece Count Only (no serial numbers)</option>
        </select>
        <div className="hint">{formType === 'serial' ? 'Serial-numbered forms track a code number and series range per stub.' : 'Piece-count forms (e.g. cash tickets) record a stub label and number of pieces — no serial numbers.'}</div>
      </div>
      {formType === 'piece' && (
        <div className="fg"><label>Default Pieces per Stub</label><input type="number" value={piecesDefault} onChange={e => setPiecesDefault(e.target.value)} /></div>
      )}
    </Modal>
  );
}

function EditFormModal({ form, onClose, onSave }) {
  const [code, setCode] = useState(form.code);
  const [name, setName] = useState(form.name);
  const [desc, setDesc] = useState(form.desc || '');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    if (!code.trim() || !name.trim()) { setErrMsg('Form Code and Form Name are required.'); return; }
    const e = onSave({ id: form.id, code: code.trim(), name: name.trim(), desc: desc.trim() });
    if (e) setErrMsg(e);
  }

  return (
    <Modal title="Edit Form Details" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Save Changes</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="fg"><label>Form Type</label><div style={{ fontSize: 13, color: 'var(--g600)' }}>{form.formType === 'serial' ? 'Serial-Numbered (has series numbers)' : 'Piece Count Only (no serial numbers)'}</div></div>
      <div className="row2">
        <div className="fg"><label>Form Code <span className="req">*</span></label><input value={code} onChange={e => setCode(e.target.value)} /></div>
        <div className="fg"><label>Form Name <span className="req">*</span></label><input value={name} onChange={e => setName(e.target.value)} /></div>
      </div>
      <div className="fg"><label>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} /></div>
    </Modal>
  );
}

// Two-step flow: generate stubs from batch settings into an editable review list,
// let the admin verify/edit or remove individual stubs, then save the batch.
function AddStubsModal({ form, onClose, onSave }) {
  const isSerial = form.formType === 'serial';
  const [batch, setBatch] = useState('');
  const [count, setCount] = useState('');
  const [seriesStart, setSeriesStart] = useState('');
  const [perStub, setPerStub] = useState('');
  const [codePrefix, setCodePrefix] = useState(form.codePrefix || form.code.replace(/\s/g, '-') + '-');
  const [pieces, setPieces] = useState(form.piecesDefault || 2500);
  const [labelPrefix, setLabelPrefix] = useState('Stub #');
  const [rows, setRows] = useState(null); // null = not yet generated; array = staged for review
  const [errMsg, setErrMsg] = useState('');

  const totalStubs = form.stubs ? form.stubs.length : 0;
  const availStubs = form.stubs ? form.stubs.filter(s => s.status === 'available').length : 0;

  function generate() {
    setErrMsg('');
    const batchNo = batch.trim();
    const n = parseInt(count) || 0;
    if (!batchNo) { setErrMsg('Enter a Batch No.'); return; }
    if (!n || n < 1) { setErrMsg('Enter the number of stubs to generate.'); return; }

    const built = [];
    if (isSerial) {
      const per = parseInt(perStub) || 0;
      const startNum = parseInt(String(seriesStart).replace(/\D/g, '')) || 0;
      if (!seriesStart.trim() || !startNum) { setErrMsg('Enter the starting series number.'); return; }
      if (!per || per < 1) { setErrMsg('Enter the number of series per stub.'); return; }
      const padLen = String(seriesStart).replace(/\D/g, '').length || 6;
      for (let i = 0; i < n; i++) {
        const from = startNum + i * per, to = from + per - 1;
        built.push({ codeNo: codePrefix.trim() + (i + 1), seriesFrom: String(from).padStart(padLen, '0'), seriesTo: String(to).padStart(padLen, '0') });
      }
    } else {
      const pcs = parseInt(pieces) || 0;
      if (!pcs || pcs < 1) { setErrMsg('Enter the number of pieces per stub.'); return; }
      for (let i = 0; i < n; i++) {
        built.push({ label: labelPrefix.trim() + (i + 1), pieces: pcs });
      }
    }
    setRows(built);
  }

  function updateRow(i, field, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }
  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)); }
  function addRow() {
    setRows(r => [...r, isSerial ? { codeNo: '', seriesFrom: '', seriesTo: '' } : { label: '', pieces: pieces || '' }]);
  }
  function backToSettings() { setRows(null); setErrMsg(''); }

  function save() {
    setErrMsg('');
    const batchNo = batch.trim();
    if (!rows || !rows.length) { setErrMsg('Generate at least one stub first.'); return; }
    const existing = form.stubs || [];
    const newStubs = [];
    if (isSerial) {
      for (const row of rows) {
        if (!row.codeNo?.trim() || !row.seriesFrom?.trim() || !row.seriesTo?.trim()) { setErrMsg('Code No., Series From, and Series To are required for every stub.'); return; }
        const codeNo = row.codeNo.trim();
        if (existing.find(s => s.codeNo === codeNo && s.batchNo === batchNo) || newStubs.find(s => s.codeNo === codeNo)) {
          setErrMsg(`Code No. "${codeNo}" already exists in batch "${batchNo}".`); return;
        }
        newStubs.push({ codeNo, seriesFrom: row.seriesFrom.trim(), seriesTo: row.seriesTo.trim(), batchNo, status: 'available', issuanceId: null, addedAt: nowISO() });
      }
    } else {
      for (const row of rows) {
        const pcs = parseInt(row.pieces) || 0;
        if (!row.label?.trim() || pcs < 1) { setErrMsg('Every stub needs a label and at least 1 piece.'); return; }
        const label = row.label.trim();
        newStubs.push({ label, pieces: pcs, codeNo: label, seriesFrom: '1', seriesTo: String(pcs), isPiece: true, batchNo, status: 'available', issuanceId: null, addedAt: nowISO() });
      }
    }
    const e = onSave(form.id, { batchNo, newStubs });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size={rows ? 'lg' : undefined} title={`Add Stubs — ${form.name}`} onClose={onClose} footer={rows ? <>
      <button className="btn btn-outline" onClick={backToSettings}>← Edit Batch Settings</button>
      <button className="btn btn-primary" onClick={save}>Save {rows.length} Stub{rows.length === 1 ? '' : 's'}</button>
    </> : <>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={generate}>Generate Stubs</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <p style={{ fontSize: 12.5, color: 'var(--g500)', marginBottom: 14 }}>{form.code} · {form.name} · {isSerial ? 'Serial-Numbered' : 'Piece Count Only'}</p>
      <div className="row2">
        <div className="iitem"><label>Current Total Stubs</label><span className="mono">{totalStubs}</span></div>
        <div className="iitem"><label>Available / Issued</label><span className="mono">{availStubs} / {totalStubs - availStubs}</span></div>
      </div>
      {!rows ? (
        <>
          <div className="fg" style={{ marginTop: 14 }}><label>Batch No. <span className="req">*</span></label><input value={batch} onChange={e => setBatch(e.target.value)} placeholder="e.g. Batch 2026-01" /></div>
          <div className="fg"><label>Number of Stubs <span className="req">*</span></label><input type="number" value={count} onChange={e => setCount(e.target.value)} /></div>
          {isSerial ? (
            <>
              <div className="fg"><label>Code Prefix</label><input value={codePrefix} onChange={e => setCodePrefix(e.target.value)} /></div>
              <div className="row2">
                <div className="fg"><label>Series Start <span className="req">*</span></label><input value={seriesStart} onChange={e => setSeriesStart(e.target.value)} placeholder="e.g. 000001" /></div>
                <div className="fg"><label>Series Count per Stub <span className="req">*</span></label><input type="number" value={perStub} onChange={e => setPerStub(e.target.value)} placeholder="e.g. 50" /></div>
              </div>
            </>
          ) : (
            <>
              <div className="fg"><label>Stub Label Prefix</label><input value={labelPrefix} onChange={e => setLabelPrefix(e.target.value)} /></div>
              <div className="fg"><label>Pieces per Stub</label><input type="number" value={pieces} onChange={e => setPieces(e.target.value)} /></div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="hint" style={{ marginBottom: 8 }}>Batch: <strong>{batch.trim()}</strong> — verify or edit each stub below before saving.</div>
          <div className={'stub-entry-hd ' + (isSerial ? 'serial' : 'piece')}>
            {isSerial ? <><span>#</span><span>Code No.</span><span>Series From</span><span>Series To</span><span /></>
                      : <><span>#</span><span>Label</span><span>Pieces</span><span /></>}
          </div>
          <div className="stub-list">
            {rows.map((row, i) => (
              <div key={i} className={'stub-row ' + (isSerial ? 'serial-row' : 'piece-row')}>
                <span className="stub-num">#{i + 1}</span>
                {isSerial ? (
                  <>
                    <div><input placeholder="Code No." value={row.codeNo} onChange={e => updateRow(i, 'codeNo', e.target.value)} /></div>
                    <div><input placeholder="Series From" value={row.seriesFrom} onChange={e => updateRow(i, 'seriesFrom', e.target.value)} /></div>
                    <div><input placeholder="Series To" value={row.seriesTo} onChange={e => updateRow(i, 'seriesTo', e.target.value)} /></div>
                  </>
                ) : (
                  <>
                    <div><input placeholder="Stub Label" value={row.label} onChange={e => updateRow(i, 'label', e.target.value)} /></div>
                    <div><input type="number" placeholder="Pieces" value={row.pieces} onChange={e => updateRow(i, 'pieces', e.target.value)} /></div>
                  </>
                )}
                <button className="del-stub" onClick={() => removeRow(i)}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="add-stub-btn" onClick={addRow}>+ Add Another Stub</button>
        </>
      )}
    </Modal>
  );
}

function EditStubModal({ form, stub, idx, onClose, onSave }) {
  const isSerial = form.formType === 'serial';
  const [batchNo, setBatchNo] = useState(stub.batchNo || '');
  const [codeNo, setCodeNo] = useState(stub.codeNo || '');
  const [seriesFrom, setSeriesFrom] = useState(stub.seriesFrom || '');
  const [seriesTo, setSeriesTo] = useState(stub.seriesTo || '');
  const [label, setLabel] = useState(stub.label || '');
  const [pieces, setPieces] = useState(stub.pieces || '');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    const e = isSerial
      ? onSave({ batchNo: batchNo.trim(), codeNo: codeNo.trim(), seriesFrom: seriesFrom.trim(), seriesTo: seriesTo.trim() })
      : onSave({ batchNo: batchNo.trim(), label: label.trim(), pieces });
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="sm" title={`Edit Stub #${idx + 1}`} onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Save</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: 'block' }}>{errMsg}</div>}
      <div className="fg"><label>Batch No.</label><input value={batchNo} onChange={e => setBatchNo(e.target.value)} /></div>
      {isSerial ? (
        <>
          <div className="fg"><label>Code No.</label><input value={codeNo} onChange={e => setCodeNo(e.target.value)} /></div>
          <div className="row2">
            <div className="fg"><label>Series From</label><input value={seriesFrom} onChange={e => setSeriesFrom(e.target.value)} /></div>
            <div className="fg"><label>Series To</label><input value={seriesTo} onChange={e => setSeriesTo(e.target.value)} /></div>
          </div>
        </>
      ) : (
        <>
          <div className="fg"><label>Stub Label</label><input value={label} onChange={e => setLabel(e.target.value)} /></div>
          <div className="fg"><label>Pieces</label><input type="number" value={pieces} onChange={e => setPieces(e.target.value)} /></div>
        </>
      )}
    </Modal>
  );
}
