import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useBriefing } from '../hooks/useBriefing';
import ProposedAction from './ProposedAction';

function fmtRel(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export default function BriefingCard() {
  const { data, isPending, error, dismiss, generate } = useBriefing();

  // Hide the card if: still loading, error, no briefing for today, dismissed,
  // or the briefing is from an older day (we'll let tomorrow's overwrite it).
  if (isPending || error) return null;
  if (!data?.exists) {
    return (
      <div className="briefing-card briefing-empty">
        <div className="briefing-header">
          <span className="briefing-label">Daily briefing</span>
          <button
            className="btn btn-outline briefing-generate"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generating…' : 'Generate now'}
          </button>
        </div>
        <p className="briefing-empty-msg">
          No briefing has been generated yet today. The scheduled run is at 6am — or generate one now.
        </p>
      </div>
    );
  }
  if (data.dismissed) return null;

  const visibleActions = (data.actions || []).filter(a => a.status === 'proposed');
  const completedCount = (data.actions || []).filter(a => a.status !== 'proposed').length;

  return (
    <div className="briefing-card">
      <div className="briefing-header">
        <div className="briefing-meta">
          <span className="briefing-label">Daily briefing</span>
          <span className="briefing-time">{fmtRel(data.generated_at)}</span>
        </div>
        <button
          className="briefing-dismiss"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          aria-label="Dismiss briefing"
          title="Dismiss for today"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="briefing-body">
        <ReactMarkdown>{data.summary_md}</ReactMarkdown>
      </div>

      {visibleActions.length > 0 && (
        <div className="briefing-actions">
          <div className="briefing-actions-label">Recommended actions</div>
          {visibleActions.map((a, i) => (
            <ProposedAction key={`${a.id}-${a.args_hash || i}`} proposal={a} />
          ))}
        </div>
      )}

      {completedCount > 0 && visibleActions.length === 0 && (
        <div className="briefing-all-done">
          All {completedCount} recommended action{completedCount === 1 ? '' : 's'} resolved.
        </div>
      )}
    </div>
  );
}
