import React, { useState } from 'react';
import { useWazuhData } from './hooks/useWazuhData';
import ThreatOverview, { TopRules } from './components/ThreatOverview';
import { AlertTrendArea, SyscheckTrendBar } from './components/TrendCharts';
import AgentGrid from './components/AgentGrid';
import AgentDetail from './components/AgentDetail';
import CriticalFimTable from './components/CriticalFimTable';
import LiveFeed from './components/LiveFeed';
import CriticalInsights from './components/CriticalInsights';
import FailedLogins from './components/FailedLogins';
import './App.css';

function HomePage({ onNavigate }) {
  return (
    <div className="home-page">
      <div className="home-grid">
        <div className="home-tile" onClick={() => onNavigate('security')}>
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M12 2l7 4v5c0 5.25-3.5 10-7 11.5C8.5 21 5 16.25 5 11V6l7-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="home-tile-label">Security</div>
          <div className="home-tile-desc">Wazuh alerts, agents & file integrity</div>
        </div>
        <div className="home-tile home-tile-disabled">
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div className="home-tile-label">Server Metrics</div>
          <div className="home-tile-desc">Coming soon</div>
        </div>
        <div className="home-tile home-tile-disabled">
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="home-tile-label">Network</div>
          <div className="home-tile-desc">Coming soon</div>
        </div>
        <div className="home-tile home-tile-disabled">
          <div className="home-tile-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
          </div>
          <div className="home-tile-label">Monitoring</div>
          <div className="home-tile-desc">Coming soon</div>
        </div>
      </div>
    </div>
  );
}

function SecurityPage() {
  const { live, rules, trends, agents, criticalFim, loading, error, refresh, lastRefresh } = useWazuhData();
  const [selectedAgent, setSelectedAgent] = useState(null);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Connecting to Wazuh...</span>
      </div>
    );
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

  // Build threat overview from live data
  const latest = live ? {
    total_alerts: live.total_alerts,
    critical_alerts: live.critical_alerts,
    high_alerts: live.high_alerts,
    medium_alerts: live.medium_alerts,
    agents_active: live.agents_active,
    agent_count: live.agents_total
  } : null;

  // Use live hourly trend for charts, fall back to MySQL trends
  const chartTrends = live?.hourly_trend?.length > 0 ? live.hourly_trend : trends;

  return (
    <div className="security-page">
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

      <ThreatOverview latest={latest} />

      <CriticalInsights />

      <FailedLogins />

      <LiveFeed />

      <div className="chart-row">
        <div className="chart-main">
          <AlertTrendArea trends={chartTrends} />
        </div>
        <div className="chart-side">
          <SyscheckTrendBar trends={chartTrends} />
        </div>
      </div>

      <div className="two-col">
        <TopRules rules={rules} />
        <AgentGrid agents={agents} onAgentClick={setSelectedAgent} />
      </div>

      <CriticalFimTable events={criticalFim} />

      {selectedAgent && (
        <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState('home');

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-left clickable" onClick={() => setTab('home')}>
          <div className="nav-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="nav-title">Home Dashboard</span>
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>Home</button>
          <button className={`nav-tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>Security</button>
        </div>
      </nav>

      <main className="main">
        {tab === 'home' && <HomePage onNavigate={setTab} />}
        {tab === 'security' && <SecurityPage />}
      </main>
    </div>
  );
}

export default App;
