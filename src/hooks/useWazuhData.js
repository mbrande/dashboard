import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  fetchAgents, fetchTrends,
  fetchLiveStats, fetchLiveRules
} from '../api/wazuh';
import { useSSE } from './useSSE';

const unwrap = (d) => (Array.isArray(d) ? d[0] : d);
const toArr = (d) => (Array.isArray(d) ? d : []);

export const wazuhKeys = {
  live: ['wazuh', 'live-stats'],
  rules: ['wazuh', 'live-rules'],
  agents: ['wazuh', 'agents'],
  trends: ['wazuh', 'trends'],
};

export function useWazuhData(refreshMs = 60000) {
  const qc = useQueryClient();

  const results = useQueries({
    queries: [
      { queryKey: wazuhKeys.live, queryFn: fetchLiveStats, refetchInterval: refreshMs, select: unwrap },
      { queryKey: wazuhKeys.rules, queryFn: fetchLiveRules, refetchInterval: refreshMs, select: toArr },
      { queryKey: wazuhKeys.agents, queryFn: fetchAgents, refetchInterval: refreshMs, select: toArr },
      { queryKey: wazuhKeys.trends, queryFn: fetchTrends, refetchInterval: refreshMs, select: toArr },
    ],
  });
  const [liveQ, rulesQ, agentsQ, trendsQ] = results;

  // Real-time: SSE pushes write directly into the query cache so subscribers
  // re-render immediately and the next poll sees fresh data.
  useSSE('wazuh_live', (data) => {
    qc.setQueryData(wazuhKeys.live, data);
  });
  useSSE('wazuh_rules', (data) => {
    if (Array.isArray(data)) qc.setQueryData(wazuhKeys.rules, data);
  });

  const loading = results.some(r => r.isPending);
  const error = results.find(r => r.error)?.error?.message || null;
  const lastRefresh = results.reduce((latest, r) => {
    const t = r.dataUpdatedAt;
    return t && (!latest || t > latest.getTime()) ? new Date(t) : latest;
  }, null);

  const refresh = () => {
    results.forEach(r => r.refetch());
  };

  return {
    live: liveQ.data ?? null,
    rules: rulesQ.data || [],
    trends: trendsQ.data || [],
    agents: agentsQ.data || [],
    loading,
    error,
    refresh,
    lastRefresh,
  };
}
