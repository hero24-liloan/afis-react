import React, { useRef } from 'react';

export default function ReportPreviewModal({ title, html, onClose }) {
  const frameRef = useRef(null);

  function doPrint() {
    try { frameRef.current.contentWindow.focus(); frameRef.current.contentWindow.print(); }
    catch (e) { /* ignore */ }
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal xl" style={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
        <div className="mhd">
          <span className="mtitle">{title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={doPrint}>🖨 Print</button>
            <button className="mclose" onClick={onClose}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <iframe ref={frameRef} title={title} srcDoc={html} style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      </div>
    </div>
  );
}
