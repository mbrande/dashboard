import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useWazuhData } from '../hooks/useWazuhData';
import { useSSEStatus } from '../hooks/useSSE';
import ThreatOverview, { TopRules } from './ThreatOverview';
import { AlertTrendArea } from './TrendCharts';
import AgentGrid from './AgentGrid';
import LiveFeed from './LiveFeed';
import CriticalInsights from './CriticalInsights';
import FailedLogins from './FailedLogins';
import FimByAgent from './FimByAgent';
import DashboardAuthEvents from './DashboardAuthEvents';
import ErrorBoundary from './ErrorBoundary';

const AgentDetail = lazy(() => import('./AgentDetail'));
const SeverityAlertsModal = lazy(() => import('./SeverityAlertsModal'));

export default function SecurityPage() {
  const { live, rules, trends, agents, loading, error, refresh, lastRefresh } = useWazuhData();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(null);
  const sseConnected = useSSEStatus();

  // Derive severity counts from the same indexer-sourced rules the modal shows.
  // Thresholds match Wazuh's defaults: CRIT=15, HIGH=12-14, MED=7-11, LOW=0-6.
  // Memoize so memoized chart children don't re-render on unrelated state churn.
  const latest = useMemo(() => {
    if (!live) return null;
    const derived = (rules || []).reduce((acc, r) => {
      const hits = r.hit_count || 0;
      acc.total += hits;
      if (r.rule_level >= 15) acc.critical += hits;
      else if (r.rule_level >= 12) acc.high += hits;
      else if (r.rule_level >= 7) acc.medium += hits;
      return acc;
    }, { total: 0, critical: 0, high: 0, medium: 0 });
    return {
      total_alerts: derived.total,
      critical_alerts: derived.critical,
      high_alerts: derived.high,
      medium_alerts: derived.medium,
      agents_active: live.agents_active,
      agent_count: live.agents_total
    };
  }, [live, rules]);

  const chartTrends = useMemo(
    () => (live?.hourly_trend?.length > 0 ? live.hourly_trend : trends),
    [live?.hourly_trend, trends]
  );

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

  return (
    <div className="security-page page-enter">
      <div className="page-toolbar">
        <div className="live-indicator">
          <span className={`live-dot ${sseConnected ? 'live-dot-sse' : ''}`} />
          <span className="live-text">{sseConnected ? 'Live (SSE)' : 'Live'}</span>
          {lastRefresh && (
            <span className="toolbar-meta">
              Updated {lastRefresh.toLocaleTimeString()} · {sseConnected ? 'streaming' : 'refreshes every 60s'}
            </span>
          )}
        </div>
        <button className="btn btn-outline" onClick={refresh}>Refresh</button>
      </div>

      <ErrorBoundary name="Threat Overview"><ThreatOverview latest={latest} onSeverityClick={setSeverityFilter} trends={chartTrends} /></ErrorBoundary>
      <ErrorBoundary name="Failed Logins"><FailedLogins /></ErrorBoundary>
      <ErrorBoundary name="Critical Insights"><CriticalInsights /></ErrorBoundary>
      <ErrorBoundary name="Dashboard Auth"><DashboardAuthEvents /></ErrorBoundary>
      <ErrorBoundary name="Live Feed"><LiveFeed /></ErrorBoundary>
      <ErrorBoundary name="Alert Trends"><AlertTrendArea trends={chartTrends} /></ErrorBoundary>
      <ErrorBoundary name="FIM by Agent"><FimByAgent /></ErrorBoundary>

      <div className="two-col">
        <ErrorBoundary name="Top Rules"><TopRules rules={rules} /></ErrorBoundary>
        <ErrorBoundary name="Agent Grid"><AgentGrid agents={agents} onAgentClick={setSelectedAgent} /></ErrorBoundary>
      </div>

      <Suspense fallback={null}>
        {selectedAgent && (
          <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        )}
        {severityFilter && (
          <SeverityAlertsModal
            severity={severityFilter}
            rules={rules}
            onClose={() => setSeverityFilter(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
