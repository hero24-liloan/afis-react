import React from 'react';

export default function ConfigScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,var(--navy) 0%,var(--navy-mid) 60%,var(--navy-light) 145%)' }}>
      <div className="login-card" style={{ maxWidth: 520, width: '90%' }}>
        <div className="login-logo">
          <div className="seal"><svg viewBox="0 0 24 24"><path d="M12 2L14.85 8.3L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.15 8.3L12 2Z" /></svg></div>
          <h1>Firebase Setup Needed</h1>
          <p>Local Government Unit Portal</p>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--g700)', lineHeight: 1.6, marginBottom: 14 }}>
          This system stores every account and record in Firebase, but no project has been connected yet.
          Open <code style={{ background: 'var(--g100)', padding: '1px 6px', borderRadius: 4 }}>src/firebaseConfig.jsx</code> and
          replace the placeholder values with your own Firebase project's config (Firebase Console ▸ Project settings ▸ General ▸ Your apps).
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--g700)', lineHeight: 1.6 }}>
          Also make sure, in the Firebase Console, that <strong>Authentication ▸ Email/Password</strong> is enabled and a <strong>Firestore database</strong> has been created for the project.
        </p>
      </div>
    </div>
  );
}
