import React from 'react';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };

export const IcGrid  = () => <svg {...base}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
export const IcDoc   = () => <svg {...base}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
export const IcReq   = () => <svg {...base}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="12" y2="16" /></svg>;
export const IcIss   = () => <svg {...base}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
export const IcUser  = () => <svg {...base}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
export const IcRcd   = () => <svg {...base}><path d="M4 4h13l3 3v13a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>;
export const IcFund  = () => <svg {...base}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0018 0V5" /><path d="M3 12a9 3 0 0018 0" /></svg>;
export const IcAct   = () => <svg {...base}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>;
export const IcRaaf  = () => <svg {...base}><path d="M9 2h6a1 1 0 011 1v2H8V3a1 1 0 011-1z" /><path d="M6 4h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="16" y2="15" /><line x1="8" y1="19" x2="12" y2="19" /></svg>;
export const IcCraaf = () => <svg {...base}><path d="M8 3h9a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M4 7v13a1 1 0 001 1h10" /><line x1="10" y1="9" x2="14" y2="9" /><line x1="10" y1="13" x2="14" y2="13" /></svg>;

// ── Row-action ("action bar") icons, matching the original app exactly ──
const act = { viewBox: '0 0 24 24', width: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
export const IcEdit = () => <svg {...act}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
export const IcDelete = () => <svg {...act}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
export const IcView = () => <svg {...act}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IcComplete = () => <svg {...act}><polyline points="20 6 9 17 4 12" /></svg>;
export const IcReopen = () => <svg {...act}><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
export const IcAddStubs = () => <svg {...act}><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>;

// ── Dashboard stat-card icons ──
const st = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
export const IcStack = () => <svg {...st}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>;
export const IcBoxCheck = () => <svg {...st}><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12l2 2 4-4" /></svg>;
export const IcSend = () => <svg {...st}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
export const IcCheckCircle = () => <svg {...st}><circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" /></svg>;
export const IcClock = () => <svg {...st}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
export const IcAlertTriangle = () => <svg {...st}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
export const IcLock = () => <svg {...act}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M7 10V7a5 5 0 0110 0v3" /></svg>;
export const IcUnlock = () => <svg {...act}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M7 10V7a5 5 0 019-3" /></svg>;
