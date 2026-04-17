import React, { useEffect } from 'react';

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

const severityMeta = {
  total: { title: 'All Triggered Rules', subtitle: 'Past hour — every severity' },
  high: { title: 'High+ Severity Alerts', subtitle: 'Level 12 and above' },
  medium: { title: 'Medium Severity Alerts', subtitle: 'Level 7–11' },
};

const matchesSeverity = (level, severity) => {
  if (severity === 'total') return true;
  if (severity === 'high') return level >= 12;
  if (severity === 'medium') return level >= 7 && level < 12;
  return false;
};

export default function SeverityAlertsModal({ severity, rules, onClose }) {
  useEffect(() => {
    document.body.classList.add('panel-open');
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.classList.remove('panel-open');
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const meta = severityMeta[severity] || severityMeta.total;
  const filtered = (rules || [])
    .filter(r => matchesSeverity(r.rule_level, severity))
    .sort((a, b) => b.hit_count - a.hit_count);

  const totalHits = filtered.reduce((sum, r) => sum + (r.hit_count || 0), 0);

  return (
    <div
      className="agent-detail-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="agent-detail" onClick={(e) => e.stopPropagation()}>
        <div className="ad-header">
          <div className="ad-header-left">
            <div>
              <div className="ad-name">{meta.title}</div>
              <div className="ad-meta">
                <span>{filtered.length} rule{filtered.length === 1 ? '' : 's'}</span>
                <span className="ad-sep">·</span>
                <span>{totalHits.toLocaleString()} hits</span>
                <span className="ad-sep">·</span>
                <span>{meta.subtitle}</span>
              </div>
            </div>
          </div>
          <button className="ad-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0' }}>
              No rules at this severity in the past hour.
            </div>
          ) : (
            <div className="rules-list">
              {filtered.map((r, i) => (
                <div key={i} className="rule-row">
                  <div className="rule-info" style={{ width: '100%' }}>
                    <div className="rule-top">
                      <span className="rule-badge" style={{ color: levelColor(r.rule_level), borderColor: levelColor(r.rule_level) }}>
                        {levelLabel(r.rule_level)}
                      </span>
                      <span className="rule-id">#{r.rule_id}</span>
                      <span className="rule-count">{r.hit_count?.toLocaleString()}</span>
                    </div>
                    <div className="rule-desc">{r.rule_desc}</div>
                    {r.agents && r.agents.length > 0 && (
                      <div className="rule-agents-list">
                        {r.agents.map((a, k) => (
                          <span key={k} className="rule-agent-chip">
                            {a.name} <span className="rule-agent-count">{a.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {r.rule_groups && (
                      <div className="rule-groups">
                        {r.rule_groups.split(',').filter(Boolean).map((g, j) => (
                          <span key={j} className="group-tag">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
