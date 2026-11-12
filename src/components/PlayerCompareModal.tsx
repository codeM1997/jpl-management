import React, { useState, useMemo } from 'react';
import { X, Plus, Eye, EyeOff, UserPlus, Users, Trophy } from 'lucide-react';
import type { AppUser } from '../types';
import { normalizePlayer, type NormalizedPlayer } from '../utils/ratingEngine';
import { PlayerRadarChart } from './PlayerRadarChart';
import { PLAYER_COLORS } from './playerCompareTypes';

interface PlayerCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  allApprovedUsers: AppUser[];
  selectedUids: string[];
  onTogglePlayer: (uid: string) => void;
  onClearAll: () => void;
}

const STAT_LABELS: { key: keyof NormalizedPlayer['attributes']; label: string }[] = [
  { key: 'pace', label: 'Pace' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'passing', label: 'Passing' },
  { key: 'finishing', label: 'Finishing' },
  { key: 'defending', label: 'Defending' },
  { key: 'gameIQ', label: 'Game IQ' },
];

export const PlayerCompareModal: React.FC<PlayerCompareModalProps> = ({
  isOpen,
  onClose,
  allApprovedUsers,
  selectedUids,
  onTogglePlayer,
  onClearAll,
}) => {
  const [hiddenPlayerIds, setHiddenPlayerIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Normalize selected users
  const selectedPlayers: NormalizedPlayer[] = useMemo(() => {
    return selectedUids
      .map(uid => allApprovedUsers.find(u => u.uid === uid))
      .filter((u): u is AppUser => Boolean(u))
      .map(normalizePlayer);
  }, [selectedUids, allApprovedUsers]);

  // Candidates for adding to comparison (not currently selected)
  const availableUsers = useMemo(() => {
    return allApprovedUsers
      .filter(u => !selectedUids.includes(u.uid))
      .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allApprovedUsers, selectedUids, searchQuery]);

  if (!isOpen) return null;

  const toggleHide = (uid: string) => {
    setHiddenPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  // Find max values for highlighting in the table
  const maxStats = STAT_LABELS.reduce((acc, stat) => {
    const vals = selectedPlayers.map(p => p.attributes[stat.key] ?? 0);
    acc[stat.key] = Math.max(...vals, 0);
    return acc;
  }, {} as Record<string, number>);

  const maxPositionRatings = {
    def: Math.max(...selectedPlayers.map(p => p.calculated.def), 0),
    mid: Math.max(...selectedPlayers.map(p => p.calculated.mid), 0),
    fwd: Math.max(...selectedPlayers.map(p => p.calculated.fwd), 0),
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto max-h-[94vh] flex flex-col border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Player Comparison</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedPlayers.length}/4 Players
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Visual radar breakdown and side-by-side attributes comparison
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedPlayers.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs font-medium text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Player Chips / Management Bar */}
        <div className="px-5 py-3 bg-white border-b border-gray-100 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {selectedPlayers.map((player, idx) => {
              const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
              const isHidden = hiddenPlayerIds.has(player.uid);
              return (
                <div
                  key={player.uid}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition ${
                    isHidden
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : `${color.bg} ${color.border}`
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: color.stroke }}
                  />
                  <span className={`text-xs font-bold ${isHidden ? 'text-gray-500' : color.text}`}>
                    {player.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white/80 px-1 rounded text-gray-600 border border-gray-200">
                    {player.primaryPosition}
                  </span>
                  <button
                    onClick={() => toggleHide(player.uid)}
                    title={isHidden ? 'Show on radar' : 'Hide from radar'}
                    className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition cursor-pointer"
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onTogglePlayer(player.uid)}
                    title="Remove from comparison"
                    className="text-gray-400 hover:text-red-600 p-0.5 rounded transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Add Player Slot (Up to 4) */}
            {selectedPlayers.length < 4 && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50 hover:bg-emerald-50/50 text-gray-600 hover:text-emerald-700 text-xs font-semibold transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Player</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 max-h-60 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <input
                        type="text"
                        placeholder="Search player..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-emerald-500 bg-white"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                      {availableUsers.length === 0 ? (
                        <div className="p-3 text-xs text-gray-400 text-center">
                          No players found
                        </div>
                      ) : (
                        availableUsers.map(user => (
                          <button
                            key={user.uid}
                            onClick={() => {
                              onTogglePlayer(user.uid);
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-gray-800">{user.name}</div>
                              <div className="text-[10px] text-gray-500">
                                {user.primaryPosition || 'MID'} • Tier {user.tier || 2}
                              </div>
                            </div>
                            <Plus className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
          {selectedPlayers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-700">No players selected</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Select up to 4 players from the Approved Players directory or use the "Add Player" button above to compare their ratings.
              </p>
            </div>
          ) : (
            <>
              {/* Radar Chart View */}
              <div className="bg-gray-50/60 rounded-2xl border border-gray-100 p-2 sm:p-4">
                <div className="text-center mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    7 Core Skill Radar
                  </h4>
                  <p className="text-[11px] text-gray-400">Scale: 1 (min) – 10 (max)</p>
                </div>
                <PlayerRadarChart
                  players={selectedPlayers}
                  hiddenPlayerIds={hiddenPlayerIds}
                />
              </div>

              {/* Detailed Side-by-Side Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Attribute Comparison Matrix
                  </h4>
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                    <Trophy className="w-3 h-3" /> Green highlights best in stat
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-4 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wider w-36">
                          Attribute
                        </th>
                        {selectedPlayers.map((player, idx) => {
                          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
                          return (
                            <th
                              key={player.uid}
                              className="px-4 py-2.5 text-center font-bold text-gray-900 border-l border-gray-100"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: color.stroke }}
                                />
                                <span className="truncate max-w-[120px]">{player.name}</span>
                              </div>
                              <div className="text-[10px] font-normal text-gray-400 mt-0.5">
                                Tier {player.rawUser.tier || 2} • {player.primaryPosition}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {/* Position Ratings Summary */}
                      <tr className="bg-blue-50/30 font-semibold">
                        <td className="px-4 py-2 text-gray-700">Calculated Best Pos</td>
                        {selectedPlayers.map(p => (
                          <td key={p.uid} className="px-4 py-2 text-center border-l border-gray-100">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-700">
                              {p.calculated.bestPosition}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-gray-50/20">
                        <td className="px-4 py-2 text-gray-600">DEF Rating</td>
                        {selectedPlayers.map(p => {
                          const isMax = selectedPlayers.length > 1 && p.calculated.def === maxPositionRatings.def;
                          return (
                            <td
                              key={p.uid}
                              className={`px-4 py-2 text-center font-mono font-bold border-l border-gray-100 ${
                                isMax ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                              }`}
                            >
                              {p.calculated.def}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="bg-gray-50/20">
                        <td className="px-4 py-2 text-gray-600">MID Rating</td>
                        {selectedPlayers.map(p => {
                          const isMax = selectedPlayers.length > 1 && p.calculated.mid === maxPositionRatings.mid;
                          return (
                            <td
                              key={p.uid}
                              className={`px-4 py-2 text-center font-mono font-bold border-l border-gray-100 ${
                                isMax ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                              }`}
                            >
                              {p.calculated.mid}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="bg-gray-50/20">
                        <td className="px-4 py-2 text-gray-600">FWD Rating</td>
                        {selectedPlayers.map(p => {
                          const isMax = selectedPlayers.length > 1 && p.calculated.fwd === maxPositionRatings.fwd;
                          return (
                            <td
                              key={p.uid}
                              className={`px-4 py-2 text-center font-mono font-bold border-l border-gray-100 ${
                                isMax ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                              }`}
                            >
                              {p.calculated.fwd}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="bg-gray-50/20">
                        <td className="px-4 py-2 text-gray-600">GK Rating</td>
                        {selectedPlayers.map(p => {
                          const gk = p.attributes.gkRating;
                          return (
                            <td key={p.uid} className="px-4 py-2 text-center font-mono text-gray-700 border-l border-gray-100">
                              {gk !== null && gk !== undefined ? gk : '—'}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 7 Core Attributes */}
                      <tr className="bg-gray-100/60">
                        <td colSpan={selectedPlayers.length + 1} className="px-4 py-1.5 font-bold text-[10px] uppercase text-gray-500 tracking-wider">
                          Core Skills (1–10)
                        </td>
                      </tr>

                      {STAT_LABELS.map(stat => {
                        const maxVal = maxStats[stat.key];
                        return (
                          <tr key={stat.key} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2 font-medium text-gray-700">{stat.label}</td>
                            {selectedPlayers.map(p => {
                              const val = p.attributes[stat.key] ?? 5;
                              const isMax = selectedPlayers.length > 1 && val === maxVal;
                              return (
                                <td
                                  key={p.uid}
                                  className={`px-4 py-2 text-center font-mono font-bold border-l border-gray-100 ${
                                    isMax ? 'bg-emerald-50/90 text-emerald-700' : 'text-gray-800'
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
