export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MUNICIPALITY_NAME = 'MUNICIPALITY OF LILOAN';
export const RAAF_ROWS_PER_PAGE = 20;

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
export function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }
export function peso(n) { return '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function serNum(s) { return parseInt(String(s || '').replace(/\D/g, '')) || 0; }
export function padSeries(ref, num) { const len = String(ref || '').replace(/\D/g, '').length || 6; return String(num).padStart(len, '0'); }
export function stubNextSeries(s) {
  if (s.reportedSeriesTo) return padSeries(s.seriesFrom, serNum(s.reportedSeriesTo) + 1);
  return s.seriesFrom;
}
export function stubFullyReported(s) {
  return !!s.reportedSeriesTo && serNum(s.reportedSeriesTo) >= serNum(s.seriesTo);
}
export function otherFundOf(stub, currentFund) {
  if (!stub || !stub.isDivided) return null;
  if (stub.fund === currentFund) return stub.splitFund || null;
  if (stub.splitFund === currentFund) return stub.fund || null;
  return null;
}
// Shorthand series entry: lets the user type just the last few digits of "Series To" and have
// the leading digits (the book's unchanging prefix) filled in automatically from Series From.
export function resolveSeriesTo(raw, seriesFromRef) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const refDigits = String(seriesFromRef || '').replace(/\D/g, '');
  if (!refDigits || digits.length >= refDigits.length) return digits;
  const prefixLen = refDigits.length - digits.length;
  return refDigits.slice(0, prefixLen) + digits;
}

// ── Amount-in-words (Philippine peso) ──
const _numWordsOnes = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const _numWordsTens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function _threeDigitWords(n) {
  let s = '';
  if (n >= 100) { s += _numWordsOnes[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
  if (n >= 20) { s += _numWordsTens[Math.floor(n / 10)] + ' '; n %= 10; if (n > 0) s += _numWordsOnes[n] + ' '; }
  else if (n > 0) { s += _numWordsOnes[n] + ' '; }
  return s.trim();
}
export function numberToWords(num) {
  num = Math.floor(Math.max(0, num));
  if (num === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  const groups = [];
  let n = num;
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) if (groups[i] > 0) parts.push(_threeDigitWords(groups[i]) + (scales[i] ? (' ' + scales[i]) : ''));
  return parts.join(' ').trim();
}
export function amountInWordsPeso(amount) {
  amount = Math.round((Number(amount) || 0) * 100) / 100;
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  const pesosWords = numberToWords(pesos);
  return centavos > 0 ? `${pesosWords} Pesos and ${String(centavos).padStart(2, '0')}/100` : `${pesosWords} Pesos Only`;
}

export function nextRcdNo(rcds) {
  const yr = new Date().getFullYear();
  const n = rcds.filter(r => (r.rcdNo || '').includes('-' + yr + '-')).length + 1;
  return `RCD-${yr}-${String(n).padStart(4, '0')}`;
}
export function nextRcdNoAvoiding(rcds, reserved) {
  const yr = new Date().getFullYear();
  let n = rcds.filter(r => (r.rcdNo || '').includes('-' + yr + '-')).length + 1;
  let cand;
  do { cand = `RCD-${yr}-${String(n).padStart(4, '0')}`; n++; } while (reserved.includes(cand));
  return cand;
}

// ── Section C rows (RCD): Beginning/Receipt/Issued/Ending for every serial stub issued to this user, scoped to the RCD's fund ──
export function acctSectionRows(r, forms, allRcds, allIssuances) {
  const issuances = allIssuances.filter(i => i.userId === r.userId);
  const myIssIds = new Set(issuances.map(i => i.id));
  const issuedAtByIss = {}; issuances.forEach(i => { issuedAtByIss[i.id] = i.issuedAt; });

  const siblingNos = new Set([...(r.linkedRcdNos || []), r.rcdNo]);
  const isPrior = other => {
    if (other.id === r.id) return false;
    if (siblingNos.has(other.rcdNo) && other.createdAt === r.createdAt) return false;
    return new Date(other.createdAt) < new Date(r.createdAt);
  };

  // Scoped to the SAME fund as this RCD — an RCD filed for one fund must never treat a
  // prior RCD from a *different* fund as "the last report" when deciding whether an
  // issued stub is a carried-forward Beginning Balance vs. a new Receipt. Each fund's
  // Beginning Balance chain only continues from that fund's own prior RCDs.
  let mostRecentPrior = null;
  allRcds.forEach(other => {
    if (!isPrior(other)) return;
    if (other.fund !== r.fund) return;
    if (!mostRecentPrior || new Date(other.createdAt) > new Date(mostRecentPrior.createdAt)) mostRecentPrior = other;
  });

  const itemByKey = {};
  r.items.forEach(it => { itemByKey[it.formId + '__' + it.stubIdx] = it; });

  const rows = [];
  forms.forEach(f => {
    if (!f.stubs) return;
    f.stubs.forEach((s, stubIdx) => {
      if (!((s.status === 'issued' || s.status === 'consumed') && s.issuanceId && myIssIds.has(s.issuanceId))) return;
      const stubMatchesFund = s.fund === r.fund || (s.isDivided && s.splitFund === r.fund);
      if (!stubMatchesFund) return;
      const item = itemByKey[f.id + '__' + stubIdx] || null;
      const stubFromN = serNum(s.seriesFrom), stubToN = serNum(s.seriesTo);

      let priorMaxToN = null;
      allRcds.forEach(other => {
        if (!isPrior(other)) return;
        (other.items || []).forEach(oi => {
          if (oi.formId === f.id && oi.stubIdx === stubIdx) {
            const n = serNum(oi.seriesTo);
            if (priorMaxToN === null || n > priorMaxToN) priorMaxToN = n;
          }
        });
      });

      if (!item && priorMaxToN !== null && priorMaxToN >= stubToN) return;

      const referenceN = priorMaxToN !== null ? priorMaxToN : (stubFromN - 1);
      const availableQty = Math.max(0, stubToN - referenceN);
      const availableSerial = availableQty > 0 ? `${padSeries(s.seriesFrom, referenceN + 1)}–${s.seriesTo}` : '';

      const issuedAt = issuedAtByIss[s.issuanceId];
      const isNewSinceLastReport = priorMaxToN === null && (!mostRecentPrior || new Date(issuedAt) > new Date(mostRecentPrior.createdAt));

      let beginQty = 0, beginSerial = '', recvQty = 0, recvSerial = '';
      if (isNewSinceLastReport) { recvQty = availableQty; recvSerial = availableSerial; }
      else { beginQty = availableQty; beginSerial = availableSerial; }

      let issuedQty = 0, issuedSerial = '', newPointN = referenceN;
      if (item) {
        const itemFromN = serNum(item.seriesFrom), itemToN = serNum(item.seriesTo);
        issuedQty = itemToN - itemFromN + 1;
        issuedSerial = `${item.seriesFrom}–${item.seriesTo}`;
        newPointN = itemToN;
      }

      const endQty = Math.max(0, stubToN - newPointN);
      let endSerial = endQty > 0 ? `${padSeries(s.seriesFrom, newPointN + 1)}–${s.seriesTo}` : '';

      if (s.isPiece) { beginSerial = '—'; recvSerial = '—'; issuedSerial = '—'; endSerial = '—'; }

      rows.push({ formName: f.name, formCode: f.code, beginQty, beginSerial, recvQty, recvSerial, issuedQty, issuedSerial, endQty, endSerial });
    });
  });
  return rows;
}

// ── RAAF rows: monthly Beginning/Receipt/Issued/Ending across every fund for one officer ──
export function raafRows(userId, year, month, forms, allIssuances, allRcds) {
  const issuances = allIssuances;
  const rcds = allRcds.filter(r => r.userId === userId);
  const monthStart = new Date(year, month - 1, 1);
  const monthEndEx = new Date(year, month, 1);

  const rows = [];
  forms.forEach(f => {
    if (!f.stubs) return;
    f.stubs.forEach((s, stubIdx) => {
      if (!s.issuanceId) return;
      const iss = issuances.find(i => i.id === s.issuanceId);
      if (!iss || iss.userId !== userId) return;
      const issuedAt = new Date(iss.issuedAt);
      if (issuedAt >= monthEndEx) return;

      const stubFromN = serNum(s.seriesFrom), stubToN = serNum(s.seriesTo);

      let priorMaxN = null, throughMaxN = null;
      rcds.forEach(r => {
        const rDate = new Date(r.date || r.createdAt);
        (r.items || []).forEach(it => {
          if (it.formId === f.id && it.stubIdx === stubIdx) {
            const n = serNum(it.seriesTo);
            if (rDate < monthStart) { if (priorMaxN === null || n > priorMaxN) priorMaxN = n; }
            if (rDate < monthEndEx) { if (throughMaxN === null || n > throughMaxN) throughMaxN = n; }
          }
        });
      });

      const beginRefN = priorMaxN !== null ? priorMaxN : (stubFromN - 1);
      const throughRefN = throughMaxN !== null ? throughMaxN : beginRefN;

      let beginQty = 0, beginFrom = '', beginTo = '', recvQty = 0, recvFrom = '', recvTo = '';
      if (issuedAt < monthStart) {
        beginQty = Math.max(0, stubToN - beginRefN);
        if (beginQty > 0) { beginFrom = padSeries(s.seriesFrom, beginRefN + 1); beginTo = s.seriesTo; }
      } else {
        recvQty = Math.max(0, stubToN - beginRefN);
        if (recvQty > 0) { recvFrom = padSeries(s.seriesFrom, beginRefN + 1); recvTo = s.seriesTo; }
      }

      const issuedQty = Math.max(0, throughRefN - beginRefN);
      let issuedFrom = '', issuedTo = '';
      if (issuedQty > 0) { issuedFrom = padSeries(s.seriesFrom, beginRefN + 1); issuedTo = padSeries(s.seriesFrom, throughRefN); }

      const endQty = Math.max(0, stubToN - throughRefN);
      let endFrom = '', endTo = '';
      if (endQty > 0) { endFrom = padSeries(s.seriesFrom, throughRefN + 1); endTo = s.seriesTo; }

      if (beginQty === 0 && recvQty === 0 && issuedQty === 0 && endQty === 0) return;

      rows.push({ formName: f.name, formCode: f.code, isPiece: !!s.isPiece, beginQty, beginFrom, beginTo, recvQty, recvFrom, recvTo, issuedQty, issuedFrom, issuedTo, endQty, endFrom, endTo });
    });
  });
  return rows;
}

export function craafRows(year, month, users, forms, allIssuances, allRcds) {
  const officers = users.filter(u => u.role !== 'Admin');
  const byForm = {};
  officers.forEach(u => {
    raafRows(u.id, year, month, forms, allIssuances, allRcds).forEach(row => {
      const key = row.formName + '__' + (row.formCode || '');
      if (!byForm[key]) byForm[key] = { formName: row.formName, formCode: row.formCode, isPiece: row.isPiece, beginQty: 0, beginRanges: [], recvQty: 0, recvRanges: [], issuedQty: 0, issuedRanges: [], endQty: 0, endRanges: [] };
      const g = byForm[key];
      if (row.beginQty > 0) { g.beginQty += row.beginQty; g.beginRanges.push([row.beginFrom, row.beginTo]); }
      if (row.recvQty > 0) { g.recvQty += row.recvQty; g.recvRanges.push([row.recvFrom, row.recvTo]); }
      if (row.issuedQty > 0) { g.issuedQty += row.issuedQty; g.issuedRanges.push([row.issuedFrom, row.issuedTo]); }
      if (row.endQty > 0) { g.endQty += row.endQty; g.endRanges.push([row.endFrom, row.endTo]); }
    });
  });
  return Object.values(byForm).filter(g => g.beginQty || g.recvQty || g.issuedQty || g.endQty).sort((a, b) => a.formName.localeCompare(b.formName));
}

// ═══ RAAF printable HTML ═══
function raafBlankRowsN(n, cols) {
  let row = '<tr>'; for (let c = 0; c < cols; c++) row += '<td>&nbsp;</td>'; row += '</tr>';
  return row.repeat(Math.max(0, n));
}
function raafDataRowHtml(row) {
  const serCell = (qty, from, to) => row.isPiece
    ? `<td class="c isn-data">${qty > 0 ? '—' : ''}</td><td class="c isn-data">${qty > 0 ? '—' : ''}</td>`
    : `<td class="c isn-data">${esc(from) || '&nbsp;'}</td><td class="c isn-data">${esc(to) || '&nbsp;'}</td>`;
  return `<tr>
    <td>${esc(row.formName)}${row.formCode ? ` (${esc(row.formCode)})` : ''}</td>
    <td class="c">${row.beginQty || ''}</td>${serCell(row.beginQty, row.beginFrom, row.beginTo)}
    <td class="c">${row.recvQty || ''}</td>${serCell(row.recvQty, row.recvFrom, row.recvTo)}
    <td class="c">${row.issuedQty || ''}</td>${serCell(row.issuedQty, row.issuedFrom, row.issuedTo)}
    <td class="c">${row.endQty || ''}</td>${serCell(row.endQty, row.endFrom, row.endTo)}
  </tr>`;
}
function raafHeaderHtml(u, month, year, shortYr, reportNo, pageNum, totalPages) {
  return `
    ${totalPages > 1 ? `<div class="pagenum">Page ${pageNum} of ${totalPages}</div>` : ''}
    <div class="hd">
      <img class="hd-logo" src="/LGULogo.png" alt="" onerror="this.style.display='none'">
      <h1>REPORT OF ACCOUNTABILITY FOR ACCOUNTABLE FORMS</h1>
      <div class="lgu-line">${esc(MUNICIPALITY_NAME)}</div>
      <div class="lgu-cap">LGU</div>
      <div class="month-line">Month of <strong>${esc(MONTH_NAMES[month - 1])}</strong>, 20<strong>${esc(shortYr)}</strong></div>
    </div>
    <table class="meta">
      <tr>
        <td style="width:36%">Accountable Officer: <span class="fillline">${esc(u.firstName + ' ' + u.lastName)}</span></td>
        <td style="width:32%">Designation: <span class="fillline">${esc(u.designation || '')}</span></td>
        <td style="width:32%">Report No.: <span class="fillline mono">${esc(reportNo)}</span></td>
      </tr>
    </table>
    <table class="grid">
      <thead>
        <tr>
          <th rowspan="3" class="namecol">Name of Form &amp; No.</th>
          <th colspan="3">Beginning Balance</th><th colspan="3">Receipt</th><th colspan="3">Issued</th><th colspan="3">Ending Balance</th>
        </tr>
        <tr>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
        </tr>
        <tr><th>From</th><th>To</th><th>From</th><th>To</th><th>From</th><th>To</th><th>From</th><th>To</th></tr>
      </thead>
      <tbody>`;
}
const RAAF_CRAAF_STYLE = `
    @page{ size:letter landscape; margin:0; }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; }
    body{ font-family:Calibri,Arial,sans-serif; color:#000; font-size:12.2px; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;
      background:#dde1e6; padding:20px 0 32px; }
    .page{ width:11in; min-height:8.5in; margin:0 auto 24px; background:#fff; padding:12mm 14mm;
      box-shadow:0 1px 4px rgba(0,0,0,.15), 0 6px 18px rgba(0,0,0,.12); position:relative; }
    .pagenum{ text-align:right; font-size:11.2px; }
    .hd{ text-align:center; position:relative; }
    .hd-logo{ position:absolute; top:-14px; left:86px; width:64.4px; height:64.4px; object-fit:contain; }
    .hd h1{ font-size:14.6px; font-weight:bold; margin-top:4px; }
    .hd .lgu-line{ font-size:12.8px; font-weight:bold; border-bottom:1px solid #000; display:inline-block; min-width:340px; margin-top:10px; padding-bottom:2px; }
    .hd .lgu-cap{ font-size:11px; font-style:italic; margin-top:2px; }
    .hd .month-line{ font-size:12.2px; margin-top:6px; }
    .meta{ width:100%; margin-top:10px; border-collapse:collapse; }
    .meta td{ padding:3px 4px; font-size:12.2px; vertical-align:bottom; white-space:nowrap; }
    .fillline{ border-bottom:1.5px solid #000; display:inline-block; min-width:150px; padding:0 6px 1px; font-weight:bold; text-align:left; }
    table.grid{ width:100%; border-collapse:collapse; margin-top:12px; table-layout:fixed; }
    table.grid th,table.grid td{ border:1px solid #ffd966; padding:3px 4px; font-size:10.6px; height:16px; overflow:hidden; }
    table.grid td.isn-data{ font-size:9.6px; }
    table.grid th{ background:#ffd966; color:#000; text-align:center; font-weight:bold; }
    table.grid td.c{ text-align:center; }
    .namecol{ width:15%; }
    .certif{ margin-top:22px; font-size:12.2px; }
    .certif .lbl{ font-weight:bold; text-transform:uppercase; margin-bottom:4px; }
    .sigblock{ display:flex; justify-content:space-between; margin-top:52px; }
    .sig{ width:46%; text-align:center; font-size:11.6px; }
    .sig .line{ border-top:1px solid #111; padding-top:3px; font-weight:bold; }
    .sig .role{ font-size:10.5px; color:#000; margin-top:2px; }
    @media print{
      *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
      body{ background:#fff; padding:0; }
      .page{ width:auto; min-height:0; margin:0; padding:12mm 14mm; box-shadow:none; page-break-after:always; }
      .page:last-of-type{ page-break-after:auto; }
    }`;

export function buildRaafHtml(userId, year, month, reportNo, ctx) {
  const u = ctx.users.find(x => x.id === userId); if (!u) return null;
  const rows = raafRows(userId, year, month, ctx.forms, ctx.issuances, ctx.rcds);
  const shortYr = String(year).slice(-2);
  const totalPages = Math.max(1, Math.ceil(rows.length / RAAF_ROWS_PER_PAGE));
  const pagesHtml = [];
  for (let p = 0; p < totalPages; p++) {
    const chunk = rows.slice(p * RAAF_ROWS_PER_PAGE, (p + 1) * RAAF_ROWS_PER_PAGE);
    const dataRowsHtml = chunk.map(raafDataRowHtml).join('');
    const padCount = Math.max(0, RAAF_ROWS_PER_PAGE - chunk.length);
    const blankRows = raafBlankRowsN(padCount, 13);
    const isLast = p === totalPages - 1;
    pagesHtml.push(`<div class="page">
      ${raafHeaderHtml(u, month, year, shortYr, reportNo, p + 1, totalPages)}
        ${dataRowsHtml}
        ${blankRows}
      </tbody>
    </table>
    ${isLast ? `
    <div class="certif">
      <div class="lbl">Certification:</div>
      <div>I hereby certify that the foregoing is a true statement of all accountable forms received, issued and transferred by me during the period above-stated and the correctness of the beginning balances.</div>
    </div>
    <div class="sigblock">
      <div class="sig"><div class="line">${esc(u.firstName + ' ' + u.lastName)}</div><div class="role">Name and Signature of the Accountable Officer</div></div>
      <div class="sig"><div class="line">&nbsp;</div><div class="role">Date</div></div>
    </div>` : ''}
    </div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(reportNo)}</title>
  <style>${RAAF_CRAAF_STYLE}</style></head><body>${pagesHtml.join('')}</body></html>`;
}

// ═══ CRAAF printable HTML ═══
function craafRangeCell(qty, ranges, isPiece) {
  if (qty <= 0) return `<td class="c isn-data">&nbsp;</td><td class="c isn-data">&nbsp;</td>`;
  if (isPiece) return `<td class="c isn-data">—</td><td class="c isn-data">—</td>`;
  const froms = ranges.map(r => esc(r[0])).join('<br>');
  const tos = ranges.map(r => esc(r[1])).join('<br>');
  return `<td class="c isn-data">${froms}</td><td class="c isn-data">${tos}</td>`;
}
function craafDataRowHtml(g) {
  return `<tr>
    <td>${esc(g.formName)}</td><td class="mono c">${esc(g.formCode || '')}</td>
    <td class="c">${g.beginQty || ''}</td>${craafRangeCell(g.beginQty, g.beginRanges, g.isPiece)}
    <td class="c">${g.recvQty || ''}</td>${craafRangeCell(g.recvQty, g.recvRanges, g.isPiece)}
    <td class="c">${g.issuedQty || ''}</td>${craafRangeCell(g.issuedQty, g.issuedRanges, g.isPiece)}
    <td class="c">${g.endQty || ''}</td>${craafRangeCell(g.endQty, g.endRanges, g.isPiece)}
  </tr>`;
}
function craafHeaderHtml(month, year, shortYr, reportNo, treasurerName, pageNum, totalPages) {
  return `
    ${totalPages > 1 ? `<div class="pagenum">Page ${pageNum} of ${totalPages}</div>` : ''}
    <div class="hd">
      <img class="hd-logo" src="/LGULogo.png" alt="" onerror="this.style.display='none'">
      <h1>CONSOLIDATED REPORT OF ACCOUNTABILITY FOR ACCOUNTABLE FORMS</h1>
      <div class="lgu-line">${esc(MUNICIPALITY_NAME)}</div>
      <div class="lgu-cap">LGU</div>
      <div class="month-line">Month of <strong>${esc(MONTH_NAMES[month - 1])}</strong>, 20<strong>${esc(shortYr)}</strong></div>
    </div>
    <table class="meta"><tr><td style="width:50%">Treasurer: <span class="fillline">${esc(treasurerName)}</span></td><td style="width:50%">Report No.: <span class="fillline mono">${esc(reportNo)}</span></td></tr></table>
    <table class="grid">
      <thead>
        <tr><th rowspan="3" class="namecol">Name of Form &amp; No.:</th><th rowspan="3">AF No.</th>
          <th colspan="3">Beginning Balance</th><th colspan="3">Receipt</th><th colspan="3">Issued</th><th colspan="3">Ending Balance</th></tr>
        <tr>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
          <th rowspan="2">Qty.</th><th colspan="2">Inclusive Serial Nos.</th>
        </tr>
        <tr><th>From</th><th>To</th><th>From</th><th>To</th><th>From</th><th>To</th><th>From</th><th>To</th></tr>
      </thead>
      <tbody>`;
}
function craafBlankRowsN(n) {
  let row = '<tr>'; for (let c = 0; c < 14; c++) row += '<td>&nbsp;</td>'; row += '</tr>';
  return row.repeat(Math.max(0, n));
}
export function buildCraafHtml(year, month, reportNo, treasurerName, ctx) {
  const rows = craafRows(year, month, ctx.users, ctx.forms, ctx.issuances, ctx.rcds);
  const shortYr = String(year).slice(-2);
  const totalPages = Math.max(1, Math.ceil(rows.length / RAAF_ROWS_PER_PAGE));
  const pagesHtml = [];
  for (let p = 0; p < totalPages; p++) {
    const chunk = rows.slice(p * RAAF_ROWS_PER_PAGE, (p + 1) * RAAF_ROWS_PER_PAGE);
    const dataRowsHtml = chunk.map(craafDataRowHtml).join('');
    const padCount = Math.max(0, RAAF_ROWS_PER_PAGE - chunk.length);
    const blankRows = craafBlankRowsN(padCount);
    const isLast = p === totalPages - 1;
    pagesHtml.push(`<div class="page">
      ${craafHeaderHtml(month, year, shortYr, reportNo, treasurerName, p + 1, totalPages)}
        ${dataRowsHtml}
        ${blankRows}
      </tbody>
    </table>
    ${isLast ? `
    <div class="certif"><div class="lbl">Certified Correct:</div></div>
    <div class="sigblock" style="justify-content:space-around">
      <div class="sig" style="width:40%"><div class="line">${esc(treasurerName)}</div><div class="role">Treasurer</div></div>
      <div class="sig" style="width:40%"><div class="line">&nbsp;</div><div class="role">Date</div></div>
    </div>` : ''}
    </div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(reportNo)}</title>
  <style>${RAAF_CRAAF_STYLE}</style></head><body>${pagesHtml.join('')}</body></html>`;
}

// ═══ RCD printable HTML (2-page General Form layout) ═══
function rcdBlankRows(n) { let out = ''; for (let i = 0; i < n; i++) out += `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`; return out; }
function rcdBlankRows3(n) { let out = ''; for (let i = 0; i < n; i++) out += `<tr><td>&nbsp;</td><td></td><td></td></tr>`; return out; }
function rcdBlankRowsN(n, cols) { let out = ''; for (let i = 0; i < n; i++) out += `<tr><td>&nbsp;</td>${'<td></td>'.repeat(cols - 1)}</tr>`; return out; }

const RCD_STYLE = `
    @page{ size:letter portrait; margin:0; }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; }
    body{ font-family:Calibri,Arial,sans-serif; color:#000; font-size:12.7px; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;
      background:#dde1e6; padding:20px 0 32px; }
    .page{ width:8.5in; min-height:11in; margin:0 auto 24px; background:#fff; padding:14mm;
      box-shadow:0 1px 4px rgba(0,0,0,.15), 0 6px 18px rgba(0,0,0,.12); position:relative; }
    .pagenum{ text-align:right; font-size:11.6px; }
    .hd{ text-align:center; position:relative; }
    .hd-logo{ position:absolute; top:-14px; left:90px; width:62.9px; height:62.9px; object-fit:contain; }
    .hd h1{ font-size:14.3px; font-weight:bold; margin-top:4px; }
    .hd h2{ font-size:13.2px; margin-top:2px; }
    .meta{ width:100%; margin-top:14px; border-collapse:collapse; }
    .meta td{ padding:3px 4px; font-size:12.7px; vertical-align:bottom; white-space:nowrap; }
    .fillline{ border-bottom:1.5px solid #000; display:inline-block; min-width:170px; padding:0 6px 1px; font-weight:bold; text-align:left; }
    .sec-title{ font-weight:bold; margin-top:16px; margin-bottom:4px; font-size:12.7px; }
    .sub-title{ font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:12.7px; }
    table.grid{ width:100%; border-collapse:collapse; margin-bottom:4px; }
    table.grid th,table.grid td{ border:1px solid #ffd966; padding:4px 6px; font-size:12.1px; height:18px; }
    table.grid td.isn-data{ font-size:10.9px; }
    table.grid.sec-c-table th{ font-size:10.45px; }
    table.grid.sec-c-table td{ font-size:11.5px; }
    table.grid.sec-c-table td.isn-data{ font-size:10.4px; }
    table.grid th{ background:#ffd966; color:#000; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:.02em; font-weight:bold; }
    table.grid td.c{ text-align:center; }
    table.grid td.r{ text-align:right; }
    .tot-row td{ font-weight:bold; }
    .remarks{ margin-top:10px; font-size:12.1px; }
    .sumd-wrap{ display:flex; gap:16px; align-items:flex-start; margin-top:4px; }
    .sumd-meta{ width:56%; margin-top:0; }
    .sumd-meta td.lbl{ font-weight:bold; }
    .sumd-meta td.ind{ padding-left:16px; }
    .sumd-meta td.ind2{ padding-left:32px; }
    .sumd-meta td.wraplbl{ white-space:normal; line-height:1.25; padding-top:6px; }
    .sumd-checks-label{ color:#000; font-weight:bold; font-size:12.7px; margin:0 0 3px; }
    .sumd-checks{ width:44%; margin-top:0; }
    .sumd-checks th{ font-size:10.5px; }
    .sig-hdr{ display:flex; margin-top:26px; }
    .sig-hdr div{ flex:1; background:#ffd966; color:#000; text-align:center; font-weight:bold;
      font-size:11.6px; padding:5px; text-transform:uppercase; letter-spacing:.03em; border:1px solid #ffd966; }
    .sigblock{ display:flex; justify-content:space-between; border:1px solid #ffd966; border-top:none; }
    .sig{ width:50%; text-align:left; font-size:11.6px; padding:12px 14px; box-sizing:border-box; }
    .sig:first-child{ border-right:1px solid #ffd966; }
    .sig .line-row{ display:flex; gap:12px; margin-top:52px; }
    .sig .line{ flex:1; border-top:1px solid #111; }
    .sig .dateline{ width:64px; border-top:1px solid #111; }
    .sig .role{ display:flex; font-size:10.5px; color:#000; margin-top:2px; text-align:center; }
    .sig .role span:first-child{ flex:1; }
    .sig .role span:last-child{ width:64px; text-align:center; }
    .amt-inline{ text-decoration:underline; font-weight:inherit; }
    @media print{
      *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
      body{ background:#fff; padding:0; }
      .page{ width:auto; min-height:0; margin:0; padding:14mm; box-shadow:none; page-break-after:always; }
      .page:last-of-type{ page-break-after:auto; }
    }`;

export function buildRcdHtml(rcdId, ctx) {
  const r = ctx.rcds.find(x => x.id === rcdId); if (!r) return null;
  const forms = ctx.forms;
  const allRcds = ctx.rcds.filter(x => x.userId === r.userId);
  const totalAmountWords = amountInWordsPeso(r.totalAmount);
  const MIN_ROWS = 14;
  const itemRows = r.items.map(it => {
    // Non-serialized (piece-count) accountable forms — e.g. a Cash Ticket booklet — have no
    // "From/To" serial run at all, just a quantity issued. Show a dash for From and the raw
    // quantity the user entered for To, rather than the internally-tracked cumulative numbers
    // (seriesFrom/seriesTo) used only for stub bookkeeping/remaining-count math.
    const fromCell = it.isPiece ? '—' : esc(it.seriesFrom);
    const toCell = it.isPiece ? esc(it.qtyDisplay || '') : esc(it.seriesTo);
    return `<tr><td>${esc(it.formName)} (${esc(it.formCode)})</td><td class="c">${fromCell}</td><td class="c">${toCell}</td><td class="r">${peso(it.amount)}</td></tr>`;
  }).join('');
  const noCollectionRow = r.items.length === 0
    ? `<tr><td colspan="4" class="c" style="font-style:italic;color:#555;">— No Collection for This Period —</td></tr>` : '';
  const padCount = Math.max(0, MIN_ROWS - r.items.length - (r.items.length === 0 ? 1 : 0));
  const blankRows = rcdBlankRows(padCount);

  const acctRows = acctSectionRows(r, forms, allRcds, ctx.issuances);
  const dataRowsC = acctRows.map(row => `<tr>
      <td>${esc(row.formName)} (${esc(row.formCode)})</td>
      <td class="c">${row.beginQty || ''}</td><td class="c isn-data">${esc(row.beginSerial) || '—'}</td>
      <td class="c">${row.recvQty || ''}</td><td class="c isn-data">${esc(row.recvSerial) || '—'}</td>
      <td class="c">${row.issuedQty || ''}</td><td class="c isn-data">${esc(row.issuedSerial) || '—'}</td>
      <td class="c">${row.endQty || ''}</td><td class="c isn-data">${row.endQty > 0 ? esc(row.endSerial) : 'Consumed'}</td>
    </tr>`).join('');
  const padCountC = Math.max(0, MIN_ROWS - acctRows.length);
  const sectionCRows = dataRowsC + rcdBlankRowsN(padCountC, 9);

  const checks = r.checks || [];
  const checksTotal = checks.reduce((a, c) => a + (c.amount || 0), 0);
  const cashTotal = Math.max(0, r.totalAmount - checksTotal);
  const checkRows = checks.map(c => `<tr><td>${esc(c.checkNo)}</td><td>${esc(c.payee)}</td><td class="r mono">${peso(c.amount)}</td></tr>`).join('');
  const padCountChk = Math.max(0, 7 - checks.length);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(r.rcdNo)}</title>
  <style>${RCD_STYLE}</style></head><body>
  <div class="page">
    <div class="pagenum">Page 1 of 2</div>
    <div class="hd">
      <img class="hd-logo" src="/LGULogo.png" alt="" onerror="this.style.display='none'">
      <h1>REPORT OF COLLECTIONS AND DEPOSITS (RCD)</h1>
      <h2>${esc(MUNICIPALITY_NAME)}</h2>
    </div>
    <table class="meta">
      <tr><td style="width:45%">Fund: <span class="fillline">${esc(r.fund || '—')}</span></td><td style="width:15%"></td><td style="width:20%">Date:</td><td style="width:20%"><span class="fillline">${fd(r.date)}</span></td></tr>
      <tr><td>Name of Accountable Officer: <span class="fillline">${esc(r.userName)}</span></td><td></td><td>Report No.:</td><td><span class="fillline mono">${esc(r.rcdNo)}</span></td></tr>
    </table>
    <div class="sec-title">A. COLLECTIONS</div>
    <div class="sub-title">1.&nbsp;&nbsp;&nbsp;For Collectors</div>
    <table class="grid">
      <thead><tr><th rowspan="2" style="width:34%">Type (Form No.)</th><th colspan="2">Official Receipt/Serial No.</th><th rowspan="2" style="width:18%">Amount</th></tr>
        <tr><th style="width:24%">From</th><th style="width:24%">To</th></tr></thead>
      <tbody>${itemRows}${noCollectionRow}${blankRows}<tr class="tot-row"><td colspan="3" class="r">TOTAL</td><td class="r">${peso(r.totalAmount)}</td></tr></tbody>
    </table>
    <div class="sub-title">2.&nbsp;&nbsp;&nbsp;For Liquidating Officers/Treasurers</div>
    <table class="grid"><thead><tr><th style="width:40%">Name of Accountable Officer</th><th style="width:35%">Report No.</th><th style="width:25%">Amount</th></tr></thead><tbody>${rcdBlankRows3(5)}</tbody></table>
    <div class="sec-title">B. REMITTANCE/DEPOSITS</div>
    <table class="grid"><thead><tr><th style="width:40%">Accountable Officer/Bank</th><th style="width:35%">Reference</th><th style="width:25%">Amount</th></tr></thead><tbody>${rcdBlankRows3(5)}</tbody></table>
  </div>
  <div class="page">
    <div class="pagenum">Page 2 of 2</div>
    <div class="sec-title">C. ACCOUNTABILITY FOR ACCOUNTABLE FORMS</div>
    <table class="grid sec-c-table">
      <thead>
        <tr><th rowspan="2" style="width:22%">Name of Form &amp; No.</th><th colspan="2">Beginning Balance</th><th colspan="2">Receipt</th><th colspan="2">Issued</th><th colspan="2">Ending Balance</th></tr>
        <tr><th>Qty.</th><th>Inclusive Serial Nos.</th><th>Qty.</th><th>Inclusive Serial Nos.</th><th>Qty.</th><th>Inclusive Serial Nos.</th><th>Qty.</th><th>Inclusive Serial Nos.</th></tr>
      </thead>
      <tbody>${sectionCRows}</tbody>
    </table>
    <div class="sec-title">D. SUMMARY OF COLLECTION AND REMITTANCES/DEPOSITS</div>
    <div class="sumd-wrap">
      <table class="meta sumd-meta">
        <tr><td class="ind" style="width:62%">Beginning Balance:</td><td style="width:38%"></td></tr>
        <tr><td class="lbl">Add: Collections</td><td></td></tr>
        <tr><td class="ind2">Cash:</td><td class="mono">${peso(cashTotal)}</td></tr>
        <tr><td class="ind2">Checks:</td><td class="mono">${peso(checksTotal)}</td></tr>
        <tr><td class="ind2"><strong>TOTAL</strong></td><td class="mono"><strong>${peso(r.totalAmount)}</strong></td></tr>
        <tr><td class="lbl">Less:</td><td></td></tr>
        <tr><td class="ind2 wraplbl">Remittance/ Deposit to Cashier/ Treasurer/ Depository Bank:</td><td></td></tr>
        <tr><td class="ind2"><strong>Balance:</strong></td><td></td></tr>
      </table>
      <div style="width:44%">
        <div class="sumd-checks-label">List of Checks:</div>
        <table class="grid sumd-checks" style="width:100%">
          <thead><tr><th style="width:28%">Check No.</th><th style="width:44%">Payee</th><th style="width:28%">Amount</th></tr></thead>
          <tbody>${checkRows}${rcdBlankRowsN(padCountChk, 3)}</tbody>
        </table>
      </div>
    </div>
    ${r.remarks ? `<div class="remarks"><strong>Remarks:</strong> ${esc(r.remarks)}</div>` : ''}
    <div class="sig-hdr"><div>CERTIFICATION</div><div>VERIFICATION AND ACKNOWLEDGMENT</div></div>
    <div class="sigblock">
      <div class="sig">
        I hereby certify that the foregoing report of collections and deposits and accountability of accountable forms is true and correct.
        <div class="line-row"><div class="line" style="text-align:center">${esc(r.userName)}</div><div class="dateline">${esc(r.date)}</div></div>
        <div class="role"><span>Name and Signature of Accountable Officer</span><span>Date</span></div>
      </div>
      <div class="sig">
        I hereby certify that the foregoing report of collection has been verified and acknowledge receipt of <span class="amt-inline">${esc(totalAmountWords)}</span>, Php <span class="amt-inline">${esc(peso(r.totalAmount).replace('₱', ''))}</span>.
        <div class="line-row"><div class="line">&nbsp;</div><div class="dateline">&nbsp;</div></div>
        <div class="role"><span>Name and Signature of Cashier/Treasurer</span><span>Date</span></div>
      </div>
    </div>
  </div>
  </body></html>`;
}

// ── Eligible stubs for filing an RCD against a given fund ──
export function stubBaselineExcluding(formId, stubIdx, excludeIds, rcds) {
  let maxToN = null, totalAmt = 0;
  rcds.forEach(other => {
    if (excludeIds && excludeIds.includes(other.id)) return;
    (other.items || []).forEach(oi => {
      if (oi.formId === formId && oi.stubIdx === stubIdx) {
        const n = serNum(oi.seriesTo);
        if (maxToN === null || n > maxToN) maxToN = n;
        totalAmt += oi.amount;
      }
    });
  });
  return { maxToN, totalAmt };
}

export function eligibleRcdStubs(userId, fund, excludeIds, forms, issuances, rcds) {
  const myIssIds = issuances.filter(i => i.userId === userId).map(i => i.id);
  const out = [];
  forms.forEach(f => {
    if (!f.stubs) return;
    f.stubs.forEach((s, idx) => {
      if (!(s.status === 'issued' || s.status === 'consumed')) return;
      if (!(s.issuanceId && myIssIds.includes(s.issuanceId))) return;
      if (fund && !(s.fund === fund || (s.isDivided && s.splitFund === fund))) return;

      if (!excludeIds || !excludeIds.length) {
        if (s.consumedAt) return;
        if (stubFullyReported(s)) return;
        out.push({ formId: f.id, formName: f.name, formCode: f.code, stubIdx: idx, stub: s });
        return;
      }
      const { maxToN, totalAmt } = stubBaselineExcluding(f.id, idx, excludeIds, rcds);
      const stubToN = serNum(s.seriesTo);
      if (maxToN !== null && maxToN >= stubToN) return;
      // Must explicitly clear reportedSeriesTo when maxToN is null, not just skip adding a
      // replacement — otherwise this shadow silently inherits whatever reportedSeriesTo the
      // real stub already has (e.g. a divided stub's sibling-only baseline), understating how
      // much of the range is actually available and blocking a no-op re-save of the same range.
      const shadow = { ...s, reportedSeriesTo: maxToN !== null ? padSeries(s.seriesFrom, maxToN) : undefined, reportedAmount: totalAmt };
      out.push({ formId: f.id, formName: f.name, formCode: f.code, stubIdx: idx, stub: shadow });
    });
  });
  return out;
}

// Recompute a stub's reported progress from whatever RCDs remain (after editing/deleting an RCD)
export function recomputeStubFromRemainingRcds(forms, formId, stubIdx, remainingRcds, actorName, nowISO) {
  const fi = forms.findIndex(f => f.id === formId);
  if (fi < 0 || !forms[fi].stubs || !forms[fi].stubs[stubIdx]) return forms;
  let maxToN = null, totalAmt = 0;
  remainingRcds.forEach(other => {
    (other.items || []).forEach(oi => {
      if (oi.formId === formId && oi.stubIdx === stubIdx) {
        const n = serNum(oi.seriesTo);
        if (maxToN === null || n > maxToN) maxToN = n;
        totalAmt += oi.amount;
      }
    });
  });
  const stubs = forms[fi].stubs.slice();
  const s = { ...stubs[stubIdx] };
  if (maxToN === null) delete s.reportedSeriesTo; else s.reportedSeriesTo = padSeries(s.seriesFrom, maxToN);
  s.reportedAmount = totalAmt;
  if (stubFullyReported(s)) {
    if (!s.consumedAt) { s.consumedAt = nowISO(); s.consumedBy = actorName; s.consumedNotes = 'Fully reported and consumed (recomputed).'; }
  } else {
    delete s.consumedAt; delete s.consumedBy; delete s.consumedNotes; delete s.verifiedAt; delete s.verifiedBy;
    if (s.status === 'consumed') s.status = 'issued';
  }
  stubs[stubIdx] = s;
  forms[fi] = { ...forms[fi], stubs };
  return forms;
}
