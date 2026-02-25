'use client';

import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/hooks/useTheme';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function ProgressChart() {
  const { allLogs } = useApp();
  const { theme } = useTheme();

  const data = allLogs
    .filter(l => !l.isRestDay)
    .map(l => ({
      day: l.dayNumber,
      cel: l.target,
      wykonane: l.completed,
    }));

  if (data.length < 2) {
    return (
      <div className="bg-panel border border-edge rounded-2xl p-6 text-center">
        <p className="text-ink-faint text-sm">
          Wykres pojawi się po 2 dniach treningowych
        </p>
      </div>
    );
  }

  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const tickColor = theme === 'dark' ? '#71717a' : '#a1a1aa';
  const tooltipBg = theme === 'dark' ? '#18181b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const tooltipText = theme === 'dark' ? '#fff' : '#18181b';

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 pb-2">
      <h3 className="text-xs text-ink-faint uppercase tracking-wider font-medium mb-4 px-2">
        Progresja
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <defs>
            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={{ stroke: gridColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '12px',
              fontSize: '12px',
              color: tooltipText,
            }}
            labelFormatter={(val) => `Dzień ${val}`}
          />
          <Area
            type="monotone"
            dataKey="cel"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#colorTarget)"
            name="Cel"
          />
          <Area
            type="monotone"
            dataKey="wykonane"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#colorCompleted)"
            name="Wykonane"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
