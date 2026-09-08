import ExcelJS from 'exceljs';
import { fd } from './reports.js';

function nowISO() { return new Date().toISOString(); }

// Workbooks are locked with ExcelJS sheet protection using the exporting
// Admin's own login password, so only someone who knows that password can
// unprotect the sheet (Review ▸ Unprotect Sheet) to edit cells in Excel.
async function protectAndDownloadWorkbook(workbook, filename, sessionPassword) {
  const password = sessionPassword || '';
  workbook.eachSheet(sheet => {
    sheet.protect(password, { selectLockedCells: true, selectUnlockedCells: true });
  });
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function exportRcdsToExcel(rcdsIn, users, sessionPassword) {
  const rcds = rcdsIn.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Accountable Forms Inventory';
  wb.created = new Date();
  const ws = wb.addWorksheet('RCDs');
  ws.columns = [
    { header: 'RCD No.', key: 'rcdNo', width: 16 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Filed By', key: 'filedBy', width: 22 },
    { header: 'Designation', key: 'designation', width: 18 },
    { header: 'Fund', key: 'fund', width: 16 },
    { header: 'Linked RCD(s)', key: 'linked', width: 18 },
    { header: 'OR Code', key: 'code', width: 14 },
    { header: 'Series From', key: 'from', width: 14 },
    { header: 'Series To', key: 'to', width: 14 },
    { header: 'Line Amount', key: 'amount', width: 14 },
    { header: 'Total Amount', key: 'total', width: 14 },
    { header: 'Report Status', key: 'status', width: 16 },
    { header: 'Remarks', key: 'remarks', width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } }; });

  if (!rcds.length) {
    ws.addRow({ rcdNo: 'No RCDs filed yet.' });
  } else {
    rcds.forEach(r => {
      const u = users.find(x => x.id === r.userId) || {};
      const items = (r.items && r.items.length) ? r.items : [{ codeNo: '', seriesFrom: '', seriesTo: '', amount: r.totalAmount || 0 }];
      items.forEach((it, idx) => {
        ws.addRow({
          rcdNo: idx === 0 ? r.rcdNo : '',
          date: idx === 0 ? fd(r.date) : '',
          filedBy: idx === 0 ? (r.userName || ((u.firstName || '') + ' ' + (u.lastName || '')).trim()) : '',
          designation: idx === 0 ? (r.designation || u.designation || '') : '',
          fund: idx === 0 ? (r.fund || '') : '',
          linked: idx === 0 ? (r.linkedRcdNos || []).join(', ') : '',
          code: it.codeNo || it.formCode || '',
          from: it.seriesFrom || '',
          to: it.seriesTo || '',
          amount: it.amount || 0,
          total: idx === 0 ? (r.totalAmount || 0) : '',
          status: idx === 0 ? (r.completed ? 'Completed' : 'Open') : '',
          remarks: idx === 0 ? (r.remarks || '') : '',
        });
      });
    });
    ws.getColumn('amount').numFmt = '#,##0.00';
    ws.getColumn('total').numFmt = '#,##0.00';
  }

  const stamp = nowISO().slice(0, 10);
  await protectAndDownloadWorkbook(wb, `RCD_Report_${stamp}.xlsx`, sessionPassword);
}

export async function exportIssuancesToExcel(issuancesIn, users, forms, sessionPassword) {
  const issuances = issuancesIn.slice().sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Accountable Forms Inventory';
  wb.created = new Date();
  const ws = wb.addWorksheet('Issuances');
  ws.columns = [
    { header: 'Date Issued', key: 'date', width: 14 },
    { header: 'Issued To', key: 'to', width: 22 },
    { header: 'Designation', key: 'designation', width: 18 },
    { header: 'Form', key: 'form', width: 20 },
    { header: 'Form Code', key: 'code', width: 14 },
    { header: 'Stub / Batch', key: 'stub', width: 18 },
    { header: 'Series / Pieces', key: 'series', width: 20 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Date Consumed', key: 'consumed', width: 14 },
    { header: 'Notes', key: 'remarks', width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } }; });

  if (!issuances.length) {
    ws.addRow({ date: 'No issuance records yet.' });
  } else {
    issuances.forEach(iss => {
      const u = users.find(x => x.id === iss.userId) || {};
      const f = forms.find(x => x.id === iss.formId) || {};
      const isSerial = f.formType === 'serial';
      const formStubs = (f.stubs || []).filter(s => s.issuanceId === iss.id);
      const details = iss.stubDetails || [];
      const count = Math.max(formStubs.length, details.length) || 1;
      for (let i = 0; i < count; i++) {
        const fs = formStubs[i] || null;
        const sd = details[i] || null;
        let seriesTxt = '';
        if (isSerial) {
          const from = (fs && fs.seriesFrom) || (sd && sd.seriesFrom) || '';
          const to = (fs && fs.seriesTo) || (sd && sd.seriesTo) || '';
          seriesTxt = from ? `${from}–${to}` : '';
        } else {
          const pcs = (fs && fs.pieces) || (sd && sd.pieces) || 0;
          seriesTxt = pcs ? `${pcs} pcs` : '';
        }
        const stubLabel = (fs && (fs.codeNo || fs.label)) || (sd && (sd.codeNo || sd.label)) || `Stub ${i + 1}`;
        const status = (fs && fs.consumedAt) ? 'Consumed' : 'Issued / Unconsumed';
        ws.addRow({
          date: i === 0 ? fd(iss.issuedAt) : '',
          to: i === 0 ? iss.recipName : '',
          designation: i === 0 ? (u.designation || '') : '',
          form: i === 0 ? (f.name || '') : '',
          code: i === 0 ? (f.code || '') : '',
          stub: stubLabel,
          series: seriesTxt,
          status,
          consumed: (fs && fs.consumedAt) ? fd(fs.consumedAt) : '',
          remarks: (fs && fs.consumedNotes) ? fs.consumedNotes : '',
        });
      }
    });
  }

  const stamp = nowISO().slice(0, 10);
  await protectAndDownloadWorkbook(wb, `Issuance_Records_${stamp}.xlsx`, sessionPassword);
}
