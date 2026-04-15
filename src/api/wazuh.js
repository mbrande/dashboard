const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const fetchLatest = () =>
  fetch(`${BASE}/wazuh/latest`).then(r => r.json());

export const fetchHistory = () =>
  fetch(`${BASE}/wazuh/history`).then(r => r.json());

export const fetchAgents = () =>
  fetch(`${BASE}/wazuh/agents`).then(r => r.json());

export const fetchFim = () =>
  fetch(`${BASE}/wazuh/fim`).then(r => r.json());

export const fetchRules = () =>
  fetch(`${BASE}/wazuh/rules`).then(r => r.json());

export const fetchTrends = () =>
  fetch(`${BASE}/wazuh/trends`).then(r => r.json());

export const fetchCriticalFim = () =>
  fetch(`${BASE}/wazuh/critical-fim`).then(r => r.json());

export const fetchAgentFim = (id) =>
  fetch(`${BASE}/wazuh/agent-fim?id=${id}`).then(r => r.json());

export const fetchAgentCriticalFim = (id) =>
  fetch(`${BASE}/wazuh/agent-critical-fim?id=${id}`).then(r => r.json());

export const fetchAgentFimHistory = (id) =>
  fetch(`${BASE}/wazuh/agent-fim-history?id=${id}`).then(r => r.json());

export const fetchAgentSca = (id) =>
  fetch(`${BASE}/wazuh/agent-sca?id=${id}`).then(r => r.json());

export const fetchAgentScaFails = (id, policyId) =>
  fetch(`${BASE}/wazuh/agent-sca-fails?id=${id}&policy=${policyId}`).then(r => r.json());

export const fetchAgentPorts = (id) =>
  fetch(`${BASE}/wazuh/agent-ports?id=${id}`).then(r => r.json());

export const fetchAgentProcesses = (id) =>
  fetch(`${BASE}/wazuh/agent-processes?id=${id}`).then(r => r.json());

export const fetchAgentAlerts = (name) =>
  fetch(`${BASE}/wazuh/agent-alerts?name=${encodeURIComponent(name)}`).then(r => r.json());

export const fetchLiveStats = () =>
  fetch(`${BASE}/wazuh/live-stats`).then(r => r.json());

export const fetchLiveRules = () =>
  fetch(`${BASE}/wazuh/live-rules`).then(r => r.json());
