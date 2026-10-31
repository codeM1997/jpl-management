import React, { useState, useMemo } from 'react';
import { X, Trophy, Sparkles, Check, AlertTriangle, Shield, CheckCircle, Trash2, RefreshCw } from 'lucide-react';
import type { Match, AppUser, PlayerMatchStats, Position } from '../types';
import { parseMatchSummary, calculateScoresFromStats, type PlayerWithTeam } from '../utils/scoreParser';

interface MatchScoreModalProps {
  match: Match;
  players: Record<string, AppUser>;
  onClose: () => void;
  onSave: (data: {
    scoreRed: number;
    scoreWhite: number;
    playerStats: Record<string, PlayerMatchStats>;
    markCompleted?: boolean;
  }) => Promise<void>;
  onClearScore?: () => Promise<void>;
}

export const MatchScoreModal: React.FC<MatchScoreModalProps> = ({
  match,
  players,
  onClose,
  onSave,
  onClearScore,
}) => {
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerMatchStats>>(
    match.playerStats ?? {}
  );

  // Dynamic calculated totals from current player stats
  const calculatedTotals = useMemo(() => {
    return calculateScoresFromStats(playerStats, match.teamRed || [], match.teamWhite || []);
  }, [playerStats, match.teamRed, match.teamWhite]);

  const [scoreRed, setScoreRed] = useState<number>(
    match.scoreRed ?? calculatedTotals.scoreRed
  );
  const [scoreWhite, setScoreWhite] = useState<number>(
    match.scoreWhite ?? calculatedTotals.scoreWhite
  );
  const [markCompleted, setMarkCompleted] = useState<boolean>(match.status === 'completed');
  const [rawText, setRawText] = useState<string>('');
  const [showQuickPaste, setShowQuickPaste] = useState<boolean>(true);
  const [parseFeedback, setParseFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    unmatchedNames?: string[];
  } | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Available players list for parser with team assignments
  const allMatchPlayers: PlayerWithTeam[] = useMemo(() => {
    const uids = Array.from(new Set([...(match.teamRed || []), ...(match.teamWhite || []), ...(match.roster || [])]));
    return uids.map(uid => {
      const u = players[uid];
      const isRed = (match.teamRed || []).includes(uid);
      const isWhite = (match.teamWhite || []).includes(uid);
      return {
        uid,
        name: u?.name || (uid.startsWith('guest:') ? `${uid.split(':')[1]} (Guest)` : uid),
        team: isRed ? 'red' : isWhite ? 'white' : undefined,
      };
    });
  }, [match, players]);

  const handleStatChange = (uid: string, field: 'goals' | 'assists' | 'ownGoals', delta: number) => {
    setPlayerStats(prev => {
      const current = prev[uid] || { goals: 0, assists: 0, ownGoals: 0 };
      const nextVal = Math.max(0, (current[field] || 0) + delta);
      return {
        ...prev,
        [uid]: {
          ...current,
          [field]: nextVal,
        },
      };
    });
  };

  const handleStatInput = (uid: string, field: 'goals' | 'assists' | 'ownGoals', value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setPlayerStats(prev => {
      const current = prev[uid] || { goals: 0, assists: 0, ownGoals: 0 };
      return {
        ...prev,
        [uid]: {
          ...current,
          [field]: num,
        },
      };
    });
  };

  const handleParseText = () => {
    if (!rawText.trim()) {
      setParseFeedback({
        type: 'error',
        message: 'Please paste your match summary text first.',
      });
      return;
    }

    const result = parseMatchSummary(rawText, allMatchPlayers, match.teamRed || [], match.teamWhite || []);

    // Set score strictly derived from parsed player stats and opponent own goals
    setScoreRed(result.scoreRed);
    setScoreWhite(result.scoreWhite);

    // Merge parsed player stats into existing
    setPlayerStats(prev => {
      const updated = { ...prev };
      Object.entries(result.playerStats).forEach(([uid, stats]) => {
        updated[uid] = {
          goals: stats.goals,
          assists: stats.assists,
          ownGoals: stats.ownGoals,
        };
      });
      return updated;
    });

    if (result.unmatched.length > 0) {
      setParseFeedback({
        type: 'warning',
        message: `Allocated stats for ${result.matched.length} player(s). Computed Score: Red ${result.scoreRed} - ${result.scoreWhite} White. Could not match ${result.unmatched.length} name(s):`,
        unmatchedNames: result.unmatched.map(u => `${u.parsedName} (${u.stats.goals}g ${u.stats.assists}a${u.stats.ownGoals ? ` ${u.stats.ownGoals}og` : ''})`),
      });
    } else if (result.matched.length > 0) {
      setParseFeedback({
        type: 'success',
        message: `Allocated stats for ${result.matched.length} player(s) and set score: Red ${result.scoreRed} - ${result.scoreWhite} White!`,
      });
    } else {
      setParseFeedback({
        type: 'warning',
        message: 'No player stats detected in the pasted text. Please verify the format.',
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        scoreRed,
        scoreWhite,
        playerStats,
        markCompleted,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save match result:', err);
      alert('Failed to save score and stats. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalRedGoals = calculatedTotals.redGoals;
  const totalWhiteGoals = calculatedTotals.whiteGoals;
  const totalRedOwnGoals = calculatedTotals.redOwnGoals;
  const totalWhiteOwnGoals = calculatedTotals.whiteOwnGoals;

  const getPosBadgeColor = (pos?: Position) => {
    switch (pos) {
      case 'GK': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DEF': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MID': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'FWD':
      case 'ST': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black">Record Match Result & Stats</h2>
              <p className="text-xs text-gray-400">
                {new Date(match.date).toLocaleDateString()} at {match.time} • {match.venue}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Quick Paste Match Summary Card */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-100 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-indigo-950">
                  Quick Paste WhatsApp Summary
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  Auto-Parser
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickPaste(!showQuickPaste)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                {showQuickPaste ? 'Hide' : 'Show'}
              </button>
            </div>

            {showQuickPaste && (
              <div className="space-y-3 mt-3">
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={`Paste summary text here, e.g.:\n12-10\nShivesh 3g 2a\nShivanu 6g 1a\nKashish 2g 1a\nAnshul 5a 1g`}
                  className="w-full text-xs font-mono p-3 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500">
                    Supports any ordering (e.g. <span className="font-mono">3g 2a</span> or <span className="font-mono">2a 1g</span>), date headers, and score lines.
                  </p>
                  <button
                    type="button"
                    onClick={handleParseText}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Parse & Allocate Stats
                  </button>
                </div>

                {parseFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium border flex items-start gap-2 ${
                      parseFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : parseFeedback.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {parseFeedback.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    )}
                    <div className="flex-1">
                      <p>{parseFeedback.message}</p>
                      {parseFeedback.unmatchedNames && parseFeedback.unmatchedNames.length > 0 && (
                        <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-[11px]">
                          {parseFeedback.unmatchedNames.map((name, i) => (
                            <li key={i}>{name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Final Match Score Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">
              Final Match Score
            </h3>
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              {/* Team Red Score */}
              <div className="flex flex-col items-center bg-red-50/70 border border-red-200 rounded-xl p-3 sm:p-4 min-w-[130px] sm:min-w-[160px]">
                <span className="text-xs font-bold text-red-700 flex items-center gap-1 mb-2">
                  <Shield className="w-3.5 h-3.5" /> Team Red
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScoreRed(Math.max(0, scoreRed - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-red-300 hover:bg-red-100 text-red-700 font-black text-lg transition flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={scoreRed}
                    onChange={e => setScoreRed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-16 h-12 text-center text-3xl font-black text-red-800 bg-white border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setScoreRed(scoreRed + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-red-300 hover:bg-red-100 text-red-700 font-black text-lg transition flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-col items-center mt-2 text-[11px] text-gray-500 font-medium">
                  <span>Player Goals: <b className="text-gray-900">{totalRedGoals}</b></span>
                  {totalWhiteOwnGoals > 0 && (
                    <span className="text-red-600 font-bold text-[10px]">+ {totalWhiteOwnGoals} White OG</span>
                  )}
                </div>
              </div>

              <div className="text-center font-black text-gray-300 text-xl sm:text-2xl">
                VS
              </div>

              {/* Team White Score */}
              <div className="flex flex-col items-center bg-slate-100/70 border border-slate-300 rounded-xl p-3 sm:p-4 min-w-[130px] sm:min-w-[160px]">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-2">
                  <Shield className="w-3.5 h-3.5" /> Team White
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScoreWhite(Math.max(0, scoreWhite - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 font-black text-lg transition flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={scoreWhite}
                    onChange={e => setScoreWhite(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-16 h-12 text-center text-3xl font-black text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setScoreWhite(scoreWhite + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 font-black text-lg transition flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-col items-center mt-2 text-[11px] text-gray-500 font-medium">
                  <span>Player Goals: <b className="text-gray-900">{totalWhiteGoals}</b></span>
                  {totalRedOwnGoals > 0 && (
                    <span className="text-slate-700 font-bold text-[10px]">+ {totalRedOwnGoals} Red OG</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sync with Player Stats Button if manually edited or mismatched */}
            {(scoreRed !== calculatedTotals.scoreRed || scoreWhite !== calculatedTotals.scoreWhite) && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setScoreRed(calculatedTotals.scoreRed);
                    setScoreWhite(calculatedTotals.scoreWhite);
                  }}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync with Player Stats (Red {calculatedTotals.scoreRed} - {calculatedTotals.scoreWhite} White)
                </button>
              </div>
            )}

            {/* Outcome Badge */}
            <div className="text-center mt-3">
              {scoreRed > scoreWhite ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-100 text-red-800 px-3 py-1 rounded-full border border-red-200">
                  🔴 Team Red Victory (+{scoreRed - scoreWhite})
                </span>
              ) : scoreWhite > scoreRed ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-200 text-slate-800 px-3 py-1 rounded-full border border-slate-300">
                  ⚪ Team White Victory (+{scoreWhite - scoreRed})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-gray-200 text-gray-800 px-3 py-1 rounded-full border border-gray-300">
                  🤝 Draw Match ({scoreRed} - {scoreWhite})
                </span>
              )}
            </div>
          </div>

          {/* Player Stats Allocation by Team */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Player Goals & Assists
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Team Red Column */}
              <div className="bg-red-50/50 rounded-xl p-3 sm:p-4 border border-red-100 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-red-800 text-sm flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-red-600" /> Team Red
                  </span>
                  <span className="text-xs text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-full">
                    Goals: {totalRedGoals}
                  </span>
                </div>

                <div className="space-y-2 flex-grow">
                  {(match.teamRed || []).map(uid => {
                    const u = players[uid];
                    const name = u?.name || (uid.startsWith('guest:') ? `${uid.split(':')[1]} (Guest)` : uid);
                    const pos = match.teamRedPositions?.[uid];
                    const stats = playerStats[uid] || { goals: 0, assists: 0 };

                    return (
                      <div
                        key={uid}
                        className="bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {pos && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${getPosBadgeColor(
                                pos
                              )}`}
                            >
                              {pos}
                            </span>
                          )}
                          <span className="text-xs font-bold text-gray-900 truncate" title={name}>
                            {name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          {/* Goals Stepper */}
                          <div className="flex items-center gap-1" title="Goals scored">
                            <span className="text-[11px] font-bold text-gray-500">⚽</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'goals', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.goals || 0}
                              onChange={e => handleStatInput(uid, 'goals', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'goals', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>

                          {/* Assists Stepper */}
                          <div className="flex items-center gap-1" title="Assists">
                            <span className="text-[11px] font-bold text-gray-500">👟</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'assists', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.assists || 0}
                              onChange={e => handleStatInput(uid, 'assists', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'assists', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>

                          {/* Own Goals Stepper */}
                          <div className="flex items-center gap-1" title="Own Goals (Counts for Team White)">
                            <span className="text-[10px] font-bold text-red-500">OG:</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'ownGoals', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.ownGoals || 0}
                              onChange={e => handleStatInput(uid, 'ownGoals', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'ownGoals', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(match.teamRed || []).length === 0 && (
                    <p className="text-xs text-gray-400 italic py-4 text-center">No players assigned to Team Red yet.</p>
                  )}
                </div>
              </div>

              {/* Team White Column */}
              <div className="bg-slate-50/70 rounded-xl p-3 sm:p-4 border border-slate-200 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-slate-500" /> Team White
                  </span>
                  <span className="text-xs text-slate-700 font-semibold bg-slate-200 px-2 py-0.5 rounded-full">
                    Goals: {totalWhiteGoals}
                  </span>
                </div>

                <div className="space-y-2 flex-grow">
                  {(match.teamWhite || []).map(uid => {
                    const u = players[uid];
                    const name = u?.name || (uid.startsWith('guest:') ? `${uid.split(':')[1]} (Guest)` : uid);
                    const pos = match.teamWhitePositions?.[uid];
                    const stats = playerStats[uid] || { goals: 0, assists: 0 };

                    return (
                      <div
                        key={uid}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {pos && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${getPosBadgeColor(
                                pos
                              )}`}
                            >
                              {pos}
                            </span>
                          )}
                          <span className="text-xs font-bold text-gray-900 truncate" title={name}>
                            {name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          {/* Goals Stepper */}
                          <div className="flex items-center gap-1" title="Goals scored">
                            <span className="text-[11px] font-bold text-gray-500">⚽</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'goals', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.goals || 0}
                              onChange={e => handleStatInput(uid, 'goals', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'goals', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>

                          {/* Assists Stepper */}
                          <div className="flex items-center gap-1" title="Assists">
                            <span className="text-[11px] font-bold text-gray-500">👟</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'assists', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.assists || 0}
                              onChange={e => handleStatInput(uid, 'assists', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'assists', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>

                          {/* Own Goals Stepper */}
                          <div className="flex items-center gap-1" title="Own Goals (Counts for Team Red)">
                            <span className="text-[10px] font-bold text-red-500">OG:</span>
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'ownGoals', -1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stats.ownGoals || 0}
                              onChange={e => handleStatInput(uid, 'ownGoals', e.target.value)}
                              className="w-7 h-5 text-center text-xs font-bold bg-white border border-gray-200 rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleStatChange(uid, 'ownGoals', 1)}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(match.teamWhite || []).length === 0 && (
                    <p className="text-xs text-gray-400 italic py-4 text-center">No players assigned to Team White yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mark as completed toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-purple-50 border border-purple-200 rounded-xl p-3">
            <input
              type="checkbox"
              checked={markCompleted}
              onChange={e => setMarkCompleted(e.target.checked)}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-bold text-purple-900 block">
                Mark match as Completed
              </span>
              <span className="text-[11px] text-purple-700">
                Moves match from Upcoming to History for all players on the roster.
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div>
            {(onClearScore && (match.scoreRed !== undefined || match.scoreWhite !== undefined)) && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to clear/unpublish the recorded score and player stats?")) {
                    await onClearScore();
                    onClose();
                  }
                }}
                disabled={saving}
                className="px-3.5 py-2 border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-bold rounded-lg text-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear / Unpublish Score
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-900 hover:bg-black text-white font-bold px-6 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Match Result
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
