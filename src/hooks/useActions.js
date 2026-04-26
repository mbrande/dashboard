import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeAction, recordDecision } from '../api/actions';

// One mutation per ProposedAction card: handles both Accept (executes the
// underlying action) and Dismiss (records the decision so the briefing skips
// it next time).
export function useActions() {
  const qc = useQueryClient();

  const accept = useMutation({
    mutationFn: ({ id, args }) => executeAction(id, args),
    onSuccess: () => {
      // Likely-affected caches — invalidate so UI reflects the change.
      qc.invalidateQueries({ queryKey: ['alerts', 'pending'] });
      qc.invalidateQueries({ queryKey: ['services', 'health'] });
    },
  });

  const dismiss = useMutation({
    mutationFn: ({ id, args }) => recordDecision(id, args, 'dismissed'),
  });

  return { accept, dismiss };
}
