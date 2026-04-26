import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBriefingToday, dismissBriefing, generateBriefing } from '../api/briefing';

export const briefingKey = ['briefing', 'today'];

export function useBriefing() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: briefingKey,
    queryFn: fetchBriefingToday,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // refresh every 5 min so action statuses stay current
  });

  const dismiss = useMutation({
    mutationFn: dismissBriefing,
    onSuccess: () => qc.invalidateQueries({ queryKey: briefingKey }),
  });

  const generate = useMutation({
    mutationFn: generateBriefing,
    onSuccess: () => qc.invalidateQueries({ queryKey: briefingKey }),
  });

  return { ...query, dismiss, generate };
}
