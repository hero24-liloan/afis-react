import React, { useState } from 'react';
import { useAuth } from './features/auth/AuthContext.jsx';
import ConfigScreen from './features/auth/ConfigScreen.jsx';
import LoadingScreen from './features/auth/LoadingScreen.jsx';
import SetupScreen from './features/auth/SetupScreen.jsx';
import LoginScreen from './features/auth/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Activities from './pages/Activities.jsx';
import Forms from './pages/Forms.jsx';
import Requests from './pages/Requests.jsx';
import Issuances from './pages/Issuances.jsx';
import Users from './pages/Users.jsx';
import Designations from './pages/Designations.jsx';
import Funds from './pages/Funds.jsx';
import MyRequests from './pages/MyRequests.jsx';
import MyIssuances from './pages/MyIssuances.jsx';
import MyRcds from './pages/rcd/MyRcds.jsx';
import AllRcds from './pages/rcd/AllRcds.jsx';
import MyRaaf from './pages/raaf/MyRaaf.jsx';
import AllRaaf from './pages/raaf/AllRaaf.jsx';
import Craaf from './pages/Craaf.jsx';
import { PAGE_META } from './nav/pageConfig.jsx';

const PORTED_PAGES = {
  dashboard: Dashboard,
  activities: Activities,
  forms: Forms,
  requests: Requests,
  issuances: Issuances,
  users: Users,
  designations: Designations,
  funds: Funds,
  'my-requests': MyRequests,
  'my-issuances': MyIssuances,
  'my-rcds': MyRcds,
  'all-rcds': AllRcds,
  'my-raaf': MyRaaf,
  'all-raaf': AllRaaf,
  craaf: Craaf,
};

function ComingSoon({ page }) {
  const meta = PAGE_META[page] || {};
  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd"><span className="card-title">{meta.t}</span></div>
        <div className="empty" style={{ padding: 40 }}>
          <p>This section hasn't been converted to React yet — it's next up.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { screen, currentUser } = useAuth();
  const [page, setPage] = useState(null);

  if (screen === 'config') return <ConfigScreen />;
  if (screen === 'loading') return <LoadingScreen />;
  if (screen === 'setup') return <SetupScreen />;
  if (screen === 'login') return <LoginScreen />;

  // screen === 'signed-in'
  const activePage = page || (currentUser.role === 'Admin' ? 'dashboard' : 'my-requests');
  const meta = PAGE_META[activePage] || {};
  const PageComponent = PORTED_PAGES[activePage];

  return (
    <div id="app" style={{ display: 'block' }}>
      <Sidebar page={activePage} onNavigate={setPage} />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="pg-title">{meta.t}</div>
            <div className="pg-sub">{meta.s}</div>
          </div>
        </div>
        <div className="content">
          {PageComponent ? <PageComponent /> : <ComingSoon page={activePage} />}
        </div>
      </main>
    </div>
  );
}
