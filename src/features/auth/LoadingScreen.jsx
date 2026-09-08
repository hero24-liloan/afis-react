import React from 'react';

export default function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,var(--navy) 0%,var(--navy-mid) 60%,var(--navy-light) 145%)' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,.25)', borderTopColor: 'var(--gold)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, letterSpacing: '.05em', color: 'rgba(255,255,255,.7)' }}>Connecting to Firebase…</p>
      </div>
    </div>
  );
}
