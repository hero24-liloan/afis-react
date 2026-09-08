import React, { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useData } from '../data/DataContext.jsx';
import { getNavCfg } from '../nav/pageConfig.jsx';
import ChangePasswordModal from '../features/auth/ChangePasswordModal.jsx';

export default function Sidebar({ page, onNavigate }) {
  const { currentUser, logout } = useAuth();
  const { g } = useData();
  const [showChangePw, setShowChangePw] = useState(false);
  const cfg = getNavCfg()[currentUser.role] || getNavCfg().User;
  const initials = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();

  return (
    <>
      <nav className="sidebar">
        <div className="sb-head">
          <img src="/LGULogo.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain', marginBottom: 8 }}
            onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div className="sys">LGU Portal</div>
          <h2>Accountable Forms Inventory</h2>
        </div>
        <div className="sb-nav">
          {cfg.map(sec => (
            <React.Fragment key={sec.sec}>
              <div className="nav-sec">{sec.sec}</div>
              {sec.items.map(it => {
                const badge = it.badge ? it.badge(g) : 0;
                const Ic = it.ic;
                return (
                  <div key={it.id} className={'nav-item' + (page === it.id ? ' active' : '')} onClick={() => onNavigate(it.id)}>
                    <Ic /> {it.label}
                    {badge > 0 && <span className="nav-badge">{badge}</span>}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="sb-foot">
          <div className="u-info">
            <div className="u-av">{initials}</div>
            <div>
              <div className="u-name">{currentUser.firstName} {currentUser.lastName}</div>
              <div className="u-role">{currentUser.role === 'Admin' ? 'Admin' : (currentUser.designation || 'User')}</div>
            </div>
          </div>
          <button className="btn-logout" style={{ marginBottom: 8 }} onClick={() => setShowChangePw(true)}>
            <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a2 2 0 100-4 2 2 0 000 4z" /><path d="M19 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
            Change Password
          </button>
          <button className="btn-logout" onClick={logout}>
            <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign Out
          </button>
        </div>
      </nav>
      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
    </>
  );
}
