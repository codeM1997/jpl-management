import type { PlayerMatchStats } from '../types';

export interface ParsedPlayerStat {
  line: string;
  parsedName: string;
  stats: PlayerMatchStats;
  matchedPlayer?: { uid: string; name: string };
}

export interface ParseSummaryResult {
  scoreRed?: number;
  scoreWhite?: number;
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
  players: { uid: string; name: string }[]
): { uid: string; name: string } | undefined {
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
 * Parses raw text copied from WhatsApp or notes and allocates goals/assists/scores
 */
export function parseMatchSummary(
  rawText: string,
  players: { uid: string; name: string }[]
): ParseSummaryResult {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let scoreRed: number | undefined;
  let scoreWhite: number | undefined;
  const playerStats: Record<string, PlayerMatchStats> = {};
  const matched: ParsedPlayerStat[] = [];
  const unmatched: ParsedPlayerStat[] = [];

  for (const line of lines) {
    // 1. Skip date & timestamp lines (e.g. "31-10-26 1:13:25", "18-10-26", "11/10/26")
    if (/^\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?\s*$/i.test(line)) {
      continue;
    }

    // 2. Check for score line (e.g. "12-10", "12 - 10", "12:10")
    const scoreMatch = line.match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
    if (scoreMatch) {
      scoreRed = parseInt(scoreMatch[1], 10);
      scoreWhite = parseInt(scoreMatch[2], 10);
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
    const match = findMatchingPlayer(cleanedLine, players);

    if (match) {
      const existing = playerStats[match.uid] || { goals: 0, assists: 0 };
      playerStats[match.uid] = {
        goals: existing.goals + goals,
        assists: existing.assists + assists,
        ownGoals: (existing.ownGoals || 0) + ownGoals,
      };

      matched.push({
        line,
        parsedName: cleanedLine,
        stats: statsObj,
        matchedPlayer: match,
      });
    } else {
      unmatched.push({
        line,
        parsedName: cleanedLine,
        stats: statsObj,
      });
    }
  }

  return {
    scoreRed,
    scoreWhite,
    playerStats,
    matched,
    unmatched,
  };
}
