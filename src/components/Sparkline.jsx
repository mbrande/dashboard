import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Sparkline({ data, color = '#1a73e8', height = 28 }) {
  if (!data || data.length < 2) return null;

  const normalized = data.map((v, i) => ({
    i,
    v: typeof v === 'number' ? v : (v.value ?? v.count ?? v.total ?? 0)
  }));

  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <div className="sparkline" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={normalized} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#${gradId})`}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
