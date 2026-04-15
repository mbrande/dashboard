import { useState, useEffect, useCallback } from 'react';
import {
  fetchAgents, fetchTrends, fetchCriticalFim,
  fetchLiveStats, fetchLiveRules
} from '../api/wazuh';

export function useWazuhData(refreshMs = 60000) {
  const [live, setLive] = useState(null);
  const [rules, setRules] = useState([]);
  const [trends, setTrends] = useState([]);
  const [agents, setAgents] = useState([]);
  const [criticalFim, setCriticalFim] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const [liveData, liveRules, a, t, cf] = await Promise.all([
        fetchLiveStats(),
        fetchLiveRules(),
        fetchAgents(),
        fetchTrends(),
        fetchCriticalFim()
      ]);

      const liveObj = Array.isArray(liveData) ? liveData[0] : liveData;
      setLive(liveObj);
      setRules(Array.isArray(liveRules) ? liveRules : []);
      setAgents(Array.isArray(a) ? a : []);
      setTrends(Array.isArray(t) ? t : []);
      setCriticalFim(Array.isArray(cf) ? cf : []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, refreshMs);
    return () => clearInterval(interval);
  }, [load, refreshMs]);

  return { live, rules, trends, agents, criticalFim, loading, error, refresh: load, lastRefresh };
}
