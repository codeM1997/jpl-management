import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import type { NormalizedPlayer } from '../utils/ratingEngine';
import { PLAYER_COLORS } from './playerCompareTypes';

const ATTRIBUTES: { key: keyof NormalizedPlayer['attributes']; label: string }[] = [
  { key: 'pace', label: 'Pace' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'finishing', label: 'Finishing' },
  { key: 'gameIQ', label: 'Game IQ' },
  { key: 'passing', label: 'Passing' },
  { key: 'defending', label: 'Defending' },
];

interface PlayerRadarChartProps {
  players: NormalizedPlayer[];
  hiddenPlayerIds?: Set<string>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  players: NormalizedPlayer[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, players }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/95 backdrop-blur-xs border border-gray-200 p-3 rounded-xl shadow-lg text-xs min-w-[140px]">
      <p className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any) => {
          const player = players.find(p => p.uid === entry.dataKey);
          if (!player) return null;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 truncate max-w-[100px] text-gray-700">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.stroke }}
                />
                <span className="truncate">{player.name}</span>
              </span>
              <span className="font-mono font-bold text-gray-900">{entry.value}/10</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PlayerRadarChart: React.FC<PlayerRadarChartProps> = ({
  players,
  hiddenPlayerIds = new Set(),
}) => {
  if (players.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400 text-sm">
        Select players to view the comparison chart
      </div>
    );
  }

  // Format data for Recharts RadarChart
  const chartData = ATTRIBUTES.map(attr => {
    const item: Record<string, any> = {
      attribute: attr.label,
      fullMark: 10,
    };
    players.forEach(player => {
      const val = player.attributes[attr.key];
      item[player.uid] = typeof val === 'number' ? val : 5;
    });
    return item;
  });

  const visiblePlayers = players.filter(p => !hiddenPlayerIds.has(p.uid));

  return (
    <div className="w-full h-[360px] sm:h-[400px] relative select-none">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          {/* Circular concentric web grid, matching reference image */}
          <PolarGrid gridType="circle" stroke="#E2E8F0" strokeWidth={1} />
          
          <PolarAngleAxis
            dataKey="attribute"
            tick={{
              fill: '#4B5563',
              fontSize: 12,
              fontWeight: 600,
            }}
          />

          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tickCount={6}
            stroke="#CBD5E1"
            tick={{ fill: '#94A3B8', fontSize: 10 }}
          />

          <Tooltip content={<CustomTooltip players={players} />} />

          {visiblePlayers.map(player => {
            const playerIndex = players.findIndex(p => p.uid === player.uid);
            const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
            return (
              <Radar
                key={player.uid}
                name={player.name}
                dataKey={player.uid}
                stroke={color.stroke}
                fill={color.stroke}
                fillOpacity={0.25}
                strokeWidth={2.5}
                dot={{
                  r: 4.5,
                  fill: color.stroke,
                  stroke: '#FFFFFF',
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 7,
                  fill: color.stroke,
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
