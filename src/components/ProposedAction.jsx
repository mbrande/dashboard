import React, { useState } from 'react';
import { useActions } from '../hooks/useActions';

// One AI-proposed action rendered as a card. The user explicitly Accepts
// (executes the action via /actions/execute) or Dismisses (records the
// decision via /actions/decision so it isn't re-proposed soon).
//
// Props match the action descriptor schema in UPGRADES.md:
//   { id, title, description, args, risk }
//
// Optional callbacks let parent components react to the choice — e.g. remove
// the card from the briefing list once handled.
export default function ProposedAction({ proposal, onResolved }) {
  const { id, title, description, args = {}, risk = 'low' } = proposal;
  const { accept, dismiss } = useActions();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null); // null | 'accepted' | 'dismissed' | 'failed'

  const isPending = accept.isPending || dismiss.isPending;
  const acceptLabel =
    risk === 'high' && !confirming ? 'Accept…' : 'Accept';

  const onAccept = () => {
    if (risk === 'high' && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    accept.mutate({ id, args }, {
      onSuccess: (res) => {
        if (res?.ok === false) {
          setDone('failed');
        } else {
          setDone('accepted');
          onResolved?.('accepted', res);
        }
      },
      onError: () => setDone('failed'),
    });
  };

  const onDismiss = () => {
    dismiss.mutate({ id, args }, {
      onSuccess: () => {
        setDone('dismissed');
        onResolved?.('dismissed');
      },
      onError: () => setDone('failed'),
    });
  };

  if (done === 'accepted' || done === 'dismissed') {
    return (
      <div className={`pa-card pa-${done}`}>
        <div className="pa-bar" />
        <div className="pa-header">
          <span className="pa-title">{title}</span>
          <span className="pa-status">{done === 'accepted' ? 'Done' : 'Dismissed'}</span>
        </div>
      </div>
    );
  }

  const errorMsg =
    done === 'failed'
      ? (accept.data?.error || accept.error?.message || 'Action failed.')
      : null;

  return (
    <div className={`pa-card pa-risk-${risk}`}>
      <div className="pa-bar" />
      <div className="pa-header">
        <span className="pa-title">{title}</span>
        {risk !== 'low' && <span className="pa-risk-badge">{risk.toUpperCase()}</span>}
      </div>

      {description && (
        <div className={`pa-description ${expanded ? 'expanded' : ''}`}>
          <p>{description}</p>
        </div>
      )}

      {Object.keys(args).length > 0 && expanded && (
        <details className="pa-args" open>
          <summary>Arguments</summary>
          <pre>{JSON.stringify(args, null, 2)}</pre>
        </details>
      )}

      {errorMsg && <div className="pa-error">{errorMsg}</div>}

      <div className="pa-actions">
        <button
          className="btn btn-outline pa-toggle"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          type="button"
        >
          {expanded ? 'Less' : 'Details'}
        </button>
        <div className="pa-spacer" />
        <button
          className="btn btn-outline"
          onClick={onDismiss}
          disabled={isPending}
          type="button"
        >
          Dismiss
        </button>
        <button
          className={`btn ${confirming ? 'btn-danger' : ''}`}
          onClick={onAccept}
          disabled={isPending}
          type="button"
        >
          {isPending && accept.isPending ? 'Running…' :
           confirming ? 'Confirm' : acceptLabel}
        </button>
      </div>
    </div>
  );
}
