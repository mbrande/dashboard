import React from 'react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

// Wazuh severity: CRIT=15, HIGH=12-14, MED=7-11, LOW=0-6
const levelColor = (level) => {
  if (level >= 15) return '#d93025';
  if (level >= 12) return '#ea4335';
  if (level >= 7) return '#f9ab00';
  return '#9aa0a6';
};

const levelLabel = (level) => {
  if (level >= 15) return 'CRIT';
  if (level >= 12) return 'HIGH';
  if (level >= 7) return 'MED';
  return 'LOW';
};

export default function ThreatOverview({ latest, onSeverityClick, trends }) {
  if (!latest) return null;

  const totalHigh = (latest.critical_alerts || 0) + (latest.high_alerts || 0);
  const handleClick = (key, e) => {
    // Prevent the native event from bubbling to React's root delegate and
    // phantom-firing on the modal overlay that mounts on the same click.
    if (e) { e.stopPropagation(); }
    if (onSeverityClick) onSeverityClick(key);
  };

  // Sparkline sources: 24 hourly buckets from trend data
  const trendArr = Array.isArray(trends) ? trends : [];
  const totalSpark = trendArr.map(t => t.total || 0);
  const highSpark = trendArr.map(t => t.high || 0);
  const medSpark = trendArr.map(t => (t.medium ?? Math.max((t.total || 0) - (t.high || 0), 0)));

  return (
    <div className="threat-overview">
      <div
        className="threat-card threat-total threat-card-clickable"
        onClick={(e) => handleClick('total', e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick('total')}
      >
        <div className="threat-number"><AnimatedNumber value={latest.total_alerts || 0} /></div>
        <div className="threat-label">Total Alerts</div>
        <Sparkline data={totalSpark} color="#1a73e8" />
      </div>
      <div
        className="threat-card threat-high threat-card-clickable"
        onClick={(e) => handleClick('high', e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick('high')}
      >
        <div className="threat-number"><AnimatedNumber value={totalHigh} /></div>
        <div className="threat-label">High+ Severity</div>
        <Sparkline data={highSpark} color="#ea4335" />
      </div>
      <div
        className="threat-card threat-medium threat-card-clickable"
        onClick={(e) => handleClick('medium', e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick('medium')}
      >
        <div className="threat-number"><AnimatedNumber value={latest.medium_alerts || 0} /></div>
        <div className="threat-label">Medium</div>
        <Sparkline data={medSpark} color="#f9ab00" />
      </div>
      <div className="threat-card threat-agents">
        <div className="threat-number">
          <AnimatedNumber value={latest.agents_active || 0} />
          <span className="threat-sub">/{latest.agent_count || 0}</span>
        </div>
        <div className="threat-label">Agents Active</div>
      </div>
    </div>
  );
}

export function TopRules({ rules }) {
  if (!rules || rules.length === 0) return null;

  const maxHits = Math.max(...rules.map(r => r.hit_count));

  return (
    <div className="card">
      <h2>Top Triggered Rules</h2>
      <div className="rules-list">
        {rules.map((r, i) => (
          <div key={i} className="rule-row">
            <div className="rule-bar-bg">
              <div
                className="rule-bar"
                style={{
                  width: `${(r.hit_count / maxHits) * 100}%`,
                  backgroundColor: levelColor(r.rule_level)
                }}
              />
            </div>
            <div className="rule-info">
              <div className="rule-top">
                <span className="rule-badge" style={{ color: levelColor(r.rule_level), borderColor: levelColor(r.rule_level) }}>
                  {levelLabel(r.rule_level)}
                </span>
                <span className="rule-id">#{r.rule_id}</span>
                <span className="rule-count">{r.hit_count.toLocaleString()}</span>
              </div>
              <div className="rule-desc">{r.rule_desc}</div>
              {r.agents && r.agents.length > 0 ? (
                <div className="rule-agents-list">
                  {r.agents.map((a, k) => (
                    <span key={k} className="rule-agent-chip">
                      {a.name} <span className="rule-agent-count">{a.count}</span>
                    </span>
                  ))}
                </div>
              ) : r.affected_agents ? (
                <div className="rule-agents">
                  <span>{r.affected_agents}</span>
                </div>
              ) : null}
              <div className="rule-groups">
                {r.rule_groups?.split(',').filter(Boolean).map((g, j) => (
                  <span key={j} className="group-tag">{g}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
