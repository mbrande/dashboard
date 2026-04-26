import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const BASE = process.env.REACT_APP_N8N_BASE_URL;
const unwrap = (d) => (Array.isArray(d) ? d[0] : d);

const COLORS = [
  '#1a73e8', '#ea4335', '#f9ab00', '#34a853', '#8430ce',
  '#e37400', '#1565c0', '#c62828', '#00897b'
];

export default function FimByAgent() {
  const { data, isPending } = useQuery({
    queryKey: ['wazuh', 'fim-by-agent'],
    queryFn: () => fetch(`${BASE}/wazuh/fim-by-agent`).then(r => r.json()),
    refetchInterval: 60000,
    select: unwrap,
  });

  if (isPending || !data) return null;

  const { agents, timeline, total } = data;
  if (!agents || agents.length === 0) return null;

  const maxAgent = agents[0];

  return (
    <div className="fim-by-agent-section" style={{ marginBottom: 16 }}>
      <div className="two-col">
        {/* Stacked bar chart - hourly FIM events by agent */}
        <div className="card">
          <div className="card-header">
            <h2>File Integrity Events — Last 24h</h2>
            <span className="dim" style={{ fontSize: '0.8rem' }}>{total.toLocaleString()} total</span>
          </div>
          {timeline && timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip
                  contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e0e0e0' }}
                  labelStyle={{ fontWeight: 500, color: '#202124' }}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: '0.7rem', paddingTop: 4 }}
                />
                {agents.map((agent, i) => (
                  <Bar
                    key={agent.name}
                    dataKey={agent.name}
                    stackId="fim"
                    fill={COLORS[i % COLORS.length]}
                    radius={i === agents.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No FIM events in the last 24 hours</div>
          )}
        </div>

        {/* Agent ranking */}
        <div className="card">
          <h2>FIM Events by Host</h2>
          <div className="fim-agent-list">
            {agents.map((agent, i) => {
              const pct = maxAgent.total > 0 ? (agent.total / maxAgent.total) * 100 : 0;
              return (
                <div key={agent.name} className="fim-agent-row">
                  <div className="fim-agent-bar-bg">
                    <div
                      className="fim-agent-bar"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <div className="fim-agent-info">
                    <span className="fim-agent-name">
                      <span className="fim-agent-dot" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {agent.name}
                    </span>
                    <span className="fim-agent-count">{agent.total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
