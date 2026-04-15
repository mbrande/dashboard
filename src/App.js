import React, { useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useWazuhData } from './hooks/useWazuhData';
import { useTheme } from './hooks/useTheme';
import ThreatOverview, { TopRules } from './components/ThreatOverview';
import { AlertTrendArea } from './components/TrendCharts';
import AgentGrid from './components/AgentGrid';
import AgentDetail from './components/AgentDetail';
import LiveFeed from './components/LiveFeed';
import CriticalInsights from './components/CriticalInsights';
import FailedLogins from './components/FailedLogins';
import FimByAgent from './components/FimByAgent';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Lazy-loaded pages
const ServerMetrics = lazy(() => import('./components/ServerMetrics'));
const NetworkDashboard = lazy(() => import('./components/NetworkDashboard'));
const NewsPage = lazy(() => import('./components/NewsPage'));

function PageLoader() {
  return <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>;
}

function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="home-page page-enter">
      <div className="home-grid">
        <div className="home-tile" onClick={() => navigate('/security')}>
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M12 2l7 4v5c0 5.25-3.5 10-7 11.5C8.5 21 5 16.25 5 11V6l7-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="home-tile-label">Security</div>
          <div className="home-tile-desc">Wazuh alerts, agents & file integrity</div>
        </div>
        <div className="home-tile" onClick={() => navigate('/metrics')}>
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div className="home-tile-label">Server Metrics</div>
          <div className="home-tile-desc">Zabbix CPU, memory, problems & network</div>
        </div>
        <div className="home-tile" onClick={() => navigate('/network')}>
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="home-tile-label">Network</div>
          <div className="home-tile-desc">Synology router traffic & interfaces</div>
        </div>
        <div className="home-tile" onClick={() => navigate('/news')}>
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V9m2 11a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h10" />
            </svg>
          </div>
          <div className="home-tile-label">News</div>
          <div className="home-tile-desc">AI, Music, Computers & Tech feeds</div>
        </div>
      </div>
    </div>
  );
}

function SecurityPage() {
  const { live, rules, trends, agents, loading, error, refresh, lastRefresh } = useWazuhData();
  const [selectedAgent, setSelectedAgent] = useState(null);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /><span>Connecting to Wazuh...</span></div>;
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Unable to connect to Wazuh API</p>
        <p className="error-detail">{error}</p>
        <button className="btn" onClick={refresh}>Retry</button>
      </div>
    );
  }

  const latest = live ? {
    total_alerts: live.total_alerts,
    critical_alerts: live.critical_alerts,
    high_alerts: live.high_alerts,
    medium_alerts: live.medium_alerts,
    agents_active: live.agents_active,
    agent_count: live.agents_total
  } : null;

  const chartTrends = live?.hourly_trend?.length > 0 ? live.hourly_trend : trends;

  return (
    <div className="security-page page-enter">
      <div className="page-toolbar">
        <div className="live-indicator">
          <span className="live-dot" />
          <span className="live-text">Live</span>
          {lastRefresh && (
            <span className="toolbar-meta">
              Updated {lastRefresh.toLocaleTimeString()} · refreshes every 60s
            </span>
          )}
        </div>
        <button className="btn btn-outline" onClick={refresh}>Refresh</button>
      </div>

      <ErrorBoundary name="Threat Overview"><ThreatOverview latest={latest} /></ErrorBoundary>
      <ErrorBoundary name="Critical Insights"><CriticalInsights /></ErrorBoundary>
      <ErrorBoundary name="Failed Logins"><FailedLogins /></ErrorBoundary>
      <ErrorBoundary name="Live Feed"><LiveFeed /></ErrorBoundary>
      <ErrorBoundary name="Alert Trends"><AlertTrendArea trends={chartTrends} /></ErrorBoundary>
      <ErrorBoundary name="FIM by Agent"><FimByAgent /></ErrorBoundary>

      <div className="two-col">
        <ErrorBoundary name="Top Rules"><TopRules rules={rules} /></ErrorBoundary>
        <ErrorBoundary name="Agent Grid"><AgentGrid agents={agents} onAgentClick={setSelectedAgent} /></ErrorBoundary>
      </div>

      {selectedAgent && (
        <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}

function ThemeToggle({ dark, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function App() {
  const [dark, toggleDark] = useTheme();

  return (
    <HashRouter>
      <div className="app">
        <nav className="nav">
          <div className="nav-top">
            <NavLink to="/" className="nav-left clickable">
              <div className="nav-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="nav-title">Home Dashboard</span>
            </NavLink>
            <ThemeToggle dark={dark} onToggle={toggleDark} />
          </div>
          <div className="nav-bottom">
            <div className="nav-tabs">
              <NavLink to="/" end className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}>Home</NavLink>
              <NavLink to="/security" className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}>Security</NavLink>
              <NavLink to="/metrics" className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}>Metrics</NavLink>
              <NavLink to="/network" className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}>Network</NavLink>
              <NavLink to="/news" className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}>News</NavLink>
            </div>
          </div>
        </nav>

        <main className="main">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary name="Home"><HomePage /></ErrorBoundary>} />
              <Route path="/security" element={<ErrorBoundary name="Security"><SecurityPage /></ErrorBoundary>} />
              <Route path="/metrics" element={<ErrorBoundary name="Metrics"><ServerMetrics /></ErrorBoundary>} />
              <Route path="/network" element={<ErrorBoundary name="Network"><NetworkDashboard /></ErrorBoundary>} />
              <Route path="/news" element={<ErrorBoundary name="News"><NewsPage /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
