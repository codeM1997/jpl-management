import type { PlayerMatchStats } from '../types';

export interface PlayerWithTeam {
  uid: string;
  name: string;
  team?: 'red' | 'white';
}

export interface ParsedPlayerStat {
  line: string;
  parsedName: string;
  stats: PlayerMatchStats;
  matchedPlayer?: PlayerWithTeam;
}

export interface ParseSummaryResult {
  scoreRed: number;
  scoreWhite: number;
  redGoals: number;
  whiteGoals: number;
  redOwnGoals: number;
  whiteOwnGoals: number;
  playerStats: Record<string, PlayerMatchStats>;
  matched: ParsedPlayerStat[];
  unmatched: ParsedPlayerStat[];
}

/**
 * Normalizes name for matching (lowercase, strips parenthesized suffixes like '(Guest)', trims)
 */
function cleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(guest\)\s*/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the best player match from available roster/team players
 */
function findMatchingPlayer(
  parsedName: string,
  players: PlayerWithTeam[]
): PlayerWithTeam | undefined {
  const target = cleanName(parsedName);
  if (!target) return undefined;

  const targetParts = target.split(' ').filter(Boolean);

  // 1. Exact full match
  const exact = players.find(p => cleanName(p.name) === target);
  if (exact) return exact;

  // 2. Exact match on guest uid (e.g. guest:Jadli:123)
  const guestMatch = players.find(p => {
    if (p.uid.startsWith('guest:')) {
      const gName = cleanName(p.uid.split(':')[1] || '');
      return gName === target || gName.startsWith(target) || target.startsWith(gName);
    }
    return false;
  });
  if (guestMatch) return guestMatch;

  // 3. First name exact match
  const firstNameMatch = players.find(p => {
    const pFirst = cleanName(p.name).split(' ')[0];
    return pFirst === target || pFirst === targetParts[0];
  });
  if (firstNameMatch) return firstNameMatch;

  // 4. First name + last initial match (e.g. "Kartik T" matching "Kartik Tyagi")
  if (targetParts.length > 1) {
    const initialMatch = players.find(p => {
      const pParts = cleanName(p.name).split(' ').filter(Boolean);
      if (pParts.length > 1 && pParts[0] === targetParts[0]) {
        return pParts[1].startsWith(targetParts[1]);
      }
      return false;
    });
    if (initialMatch) return initialMatch;
  }

  // 5. Starts with match
  const startsWithMatch = players.find(p => {
    const pClean = cleanName(p.name);
    return pClean.startsWith(target) || target.startsWith(pClean);
  });
  if (startsWithMatch) return startsWithMatch;

  // 6. Substring contains match
  const containsMatch = players.find(p => {
    const pClean = cleanName(p.name);
    return pClean.includes(target) || target.includes(pClean);
  });
  if (containsMatch) return containsMatch;

  return undefined;
}

/**
 * Calculates match scores strictly from player goals and opponent own goals
 * Team Red Score = Red Goals + White Own Goals
 * Team White Score = White Goals + Red Own Goals
 */
export function calculateScoresFromStats(
  playerStats: Record<string, PlayerMatchStats>,
  teamRed: string[] = [],
  teamWhite: string[] = []
): {
  scoreRed: number;
  scoreWhite: number;
  redGoals: number;
  whiteGoals: number;
  redOwnGoals: number;
  whiteOwnGoals: number;
} {
  let redGoals = 0;
  let redOwnGoals = 0;
  let whiteGoals = 0;
  let whiteOwnGoals = 0;

  teamRed.forEach(uid => {
    const s = playerStats[uid];
    if (s) {
      redGoals += s.goals || 0;
      redOwnGoals += s.ownGoals || 0;
    }
  });

  teamWhite.forEach(uid => {
    const s = playerStats[uid];
    if (s) {
      whiteGoals += s.goals || 0;
      whiteOwnGoals += s.ownGoals || 0;
    }
  });

  return {
    scoreRed: redGoals + whiteOwnGoals,
    scoreWhite: whiteGoals + redOwnGoals,
    redGoals,
    whiteGoals,
    redOwnGoals,
    whiteOwnGoals,
  };
}

/**
 * Parses raw text copied from WhatsApp or notes and allocates goals/assists/scores
 * Does NOT take the final score from text lines (like '12-10').
 * Calculates final scores strictly from parsed goals and opponent own goals.
 */
export function parseMatchSummary(
  rawText: string,
  players: PlayerWithTeam[],
  teamRedUids?: string[],
  teamWhiteUids?: string[]
): ParseSummaryResult {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const playerStats: Record<string, PlayerMatchStats> = {};
  const matched: ParsedPlayerStat[] = [];
  const unmatched: ParsedPlayerStat[] = [];

  for (const line of lines) {
    // 1. Skip date & timestamp lines (e.g. "31-10-26 1:13:25", "18-10-26", "11/10/26")
    if (/^\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?\s*$/i.test(line)) {
      continue;
    }

    // 2. Explicitly skip standalone score line (e.g. "12-10", "12 - 10", "12:10")
    // Do NOT take score from text - we derive score directly from parsed player goals & own goals!
    if (/^\s*\d+\s*[-:]\s*\d+\s*$/.test(line)) {
      continue;
    }

    // 3. Extract stats tokens
    let goals = 0;
    let assists = 0;
    let ownGoals = 0;
    let hasStats = false;

    // Check own goals first (e.g. "3og", "1 own goal")
    const ogMatch = line.match(/(\d+)\s*(?:og|own\s*goals?)\b/i);
    if (ogMatch) {
      ownGoals = parseInt(ogMatch[1], 10);
      hasStats = true;
    }

    // Check regular goals (e.g. "3g", "3 goals", but NOT "3og")
    const gMatch = line.match(/(?<!o)(\d+)\s*(?:g|goals?)\b/i);
    if (gMatch) {
      goals = parseInt(gMatch[1], 10);
      hasStats = true;
    }

    // Check assists (e.g. "2a", "2 assists")
    const aMatch = line.match(/(\d+)\s*(?:a|assists?)\b/i);
    if (aMatch) {
      assists = parseInt(aMatch[1], 10);
      hasStats = true;
    }

    if (!hasStats) {
      // Line doesn't look like a player stat line
      continue;
    }

    // 4. Strip stats tokens from the line to extract the player's name
    const cleanedLine = line
      .replace(/(\d+)\s*(?:og|own\s*goals?)\b/gi, '')
      .replace(/(?<!o)(\d+)\s*(?:g|goals?)\b/gi, '')
      .replace(/(\d+)\s*(?:a|assists?)\b/gi, '')
      .replace(/^[-•*#\d.]+\s*/, '') // Remove list bullets or leading numbers
      .replace(/[-:,]+$/, '') // Remove trailing punctuation
      .trim();

    if (!cleanedLine) continue;

    const statsObj: PlayerMatchStats = {
      goals,
      assists,
      ...(ownGoals > 0 ? { ownGoals } : {}),
    };

    // 5. Match with roster/team players
    const matchedPlayer = findMatchingPlayer(cleanedLine, players);

    if (matchedPlayer) {
      const existing = playerStats[matchedPlayer.uid] || { goals: 0, assists: 0 };
      playerStats[matchedPlayer.uid] = {
        goals: existing.goals + goals,
        assists: existing.assists + assists,
        ownGoals: (existing.ownGoals || 0) + ownGoals,
      };

      matched.push({
        line,
        parsedName: cleanedLine,
        stats: statsObj,
        matchedPlayer,
      });
    } else {
      unmatched.push({
        line,
        parsedName: cleanedLine,
        stats: statsObj,
      });
    }
  }

  // Derive red and white rosters for score calculation
  const redList = teamRedUids || players.filter(p => p.team === 'red').map(p => p.uid);
  const whiteList = teamWhiteUids || players.filter(p => p.team === 'white').map(p => p.uid);

  const scores = calculateScoresFromStats(playerStats, redList, whiteList);

  return {
    scoreRed: scores.scoreRed,
    scoreWhite: scores.scoreWhite,
    redGoals: scores.redGoals,
    whiteGoals: scores.whiteGoals,
    redOwnGoals: scores.redOwnGoals,
    whiteOwnGoals: scores.whiteOwnGoals,
    playerStats,
    matched,
    unmatched,
  };
}
