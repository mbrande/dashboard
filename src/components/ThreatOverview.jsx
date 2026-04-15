import React from 'react';

const levelColor = (level) => {
  if (level >= 12) return '#d93025';
  if (level >= 8) return '#ea4335';
  if (level >= 5) return '#f9ab00';
  return '#9aa0a6';
};

const levelLabel = (level) => {
  if (level >= 12) return 'CRIT';
  if (level >= 8) return 'HIGH';
  if (level >= 5) return 'MED';
  return 'LOW';
};

export default function ThreatOverview({ latest }) {
  if (!latest) return null;

  const totalHigh = (latest.critical_alerts || 0) + (latest.high_alerts || 0);

  return (
    <div className="threat-overview">
      <div className="threat-card threat-total">
        <div className="threat-number">{latest.total_alerts?.toLocaleString()}</div>
        <div className="threat-label">Total Alerts</div>
      </div>
      <div className="threat-card threat-high">
        <div className="threat-number">{totalHigh.toLocaleString()}</div>
        <div className="threat-label">High+ Severity</div>
      </div>
      <div className="threat-card threat-medium">
        <div className="threat-number">{latest.medium_alerts?.toLocaleString()}</div>
        <div className="threat-label">Medium</div>
      </div>
      <div className="threat-card threat-agents">
        <div className="threat-number">
          {latest.agents_active}<span className="threat-sub">/{latest.agent_count}</span>
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
