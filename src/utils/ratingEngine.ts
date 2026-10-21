import type { AppUser, Position } from '../types';

export interface PlayerAttributes {
  pace: number;
  stamina: number;
  dribbling: number;
  passing: number;
  finishing: number;
  defending: number;
  gameIQ: number;
  gkRating?: number | null;
}

export interface CalculatedPositionRatings {
  def: number;
  mid: number;
  fwd: number;
  bestPosition: 'DEF' | 'MID' | 'FWD';
}

export interface NormalizedPlayer {
  uid: string;
  name: string;
  primaryPosition: Position;
  secondaryPosition?: Position;
  happyAnywhere: boolean;
  attributes: PlayerAttributes;
  calculated: CalculatedPositionRatings;
  rawUser: AppUser;
}

export interface AssignedLineup {
  teamRed: string[];
  teamWhite: string[];
  redPositions: Record<string, Position>;
  whitePositions: Record<string, Position>;
  redStrength: number;
  whiteStrength: number;
  strengthDiff: number;
  offPrimaryCount: number;
  missingGkPenalty: number;
  splitScore: number;
}

export type SlotPosition = Exclude<Position, 'ST'>;
const SLOT_POSITIONS: SlotPosition[] = ['GK', 'DEF', 'MID', 'FWD'];

// Weights from Sunday 6v6 Weightage Structure
export const POSITION_WEIGHTS = {
  DEF: {
    pace: 0.15,
    stamina: 0.15,
    dribbling: 0.10,
    passing: 0.10,
    finishing: 0.00,
    defending: 0.35,
    gameIQ: 0.15,
  },
  MID: {
    pace: 0.05,
    stamina: 0.20,
    dribbling: 0.15,
    passing: 0.25,
    finishing: 0.10,
    defending: 0.10,
    gameIQ: 0.15,
  },
  FWD: {
    pace: 0.15,
    stamina: 0.10,
    dribbling: 0.20,
    passing: 0.10,
    finishing: 0.30,
    defending: 0.00,
    gameIQ: 0.15,
  },
} as const;

export const FAMILIARITY_MULTIPLIERS = {
  PRIMARY: 1.00,
  SECONDARY: 0.92,
  HAPPY_ANYWHERE: 0.95,
  OTHER: 0.85,
} as const;

export const ALGORITHM_SETTINGS = {
  PRIMARY_PENALTY: 0,
  SECONDARY_OR_FLEX_PENALTY: 0.20,
  OUT_OF_POSITION_PENALTY: 3.0,
  MAX_RATING_DIFF_PER_PLAYER: 2.0 / 6, // 2.0 total strength diff for 6v6, scales with team size
  GK_ROTATOR_MIN_RATING: 6.0,
  TOP_N_SPLITS: 5,
  VARIETY_SCORE_WINDOW: 0.5, // only splits within this of the best score are picked at random
} as const;

/**
 * Evaluates position fit penalty for a player in an assigned position.
 * Primary: 0, Secondary / Flex: 0.20, Neither: 3.0
 */
export function getPositionFitPenalty(player: NormalizedPlayer, assignedPos: Position): number {
  if (assignedPos === player.primaryPosition) {
    return ALGORITHM_SETTINGS.PRIMARY_PENALTY;
  }
  if (player.secondaryPosition && assignedPos === player.secondaryPosition) {
    return ALGORITHM_SETTINGS.SECONDARY_OR_FLEX_PENALTY;
  }
  if (player.happyAnywhere) {
    return ALGORITHM_SETTINGS.SECONDARY_OR_FLEX_PENALTY;
  }
  return ALGORITHM_SETTINGS.OUT_OF_POSITION_PENALTY;
}

/**
 * Checks if a player is capable / willing to keep goal or rotate into goal
 */
export function isGkCapable(player: NormalizedPlayer): boolean {
  return (
    player.primaryPosition === 'GK' ||
    player.secondaryPosition === 'GK' ||
    player.happyAnywhere ||
    (typeof player.attributes.gkRating === 'number' && player.attributes.gkRating >= ALGORITHM_SETTINGS.GK_ROTATOR_MIN_RATING)
  );
}

/**
 * Evaluates goalkeeper coverage and rotation capability for a team.
 * - Primary GK in goal: 0
 * - If no primary GK:
 *   - >= 2 rotators (secondary GK, flex, or high GK rating): 1.5
 *   - 1 rotator: 5.0
 *   - 0 rotators: 15.0
 */
export function evaluateTeamGk(teamPlayers: NormalizedPlayer[], positions: Record<string, Position>): number {
  const gkPlayer = teamPlayers.find(p => positions[p.uid] === 'GK');
  if (gkPlayer && gkPlayer.primaryPosition === 'GK') {
    return 0;
  }

  const rotators = teamPlayers.filter(isGkCapable).length;
  if (rotators >= 2) return 1.5;
  if (rotators === 1) return 5.0;
  return 15.0;
}

/**
 * Normalizes positions, converting legacy 'ST' to 'FWD'
 */
export function sanitizePosition(pos?: Position | string): Position {
  if (!pos) return 'MID';
  if (pos === 'ST') return 'FWD';
  if (pos === 'GK' || pos === 'DEF' || pos === 'MID' || pos === 'FWD') return pos;
  return 'MID';
}

/**
 * Calculates DEF, MID, FWD ratings and determines best outfield position
 */
export function calculatePositionRatings(attrs: PlayerAttributes): CalculatedPositionRatings {
  const weighted = (pos: keyof typeof POSITION_WEIGHTS) => {
    const weights = POSITION_WEIGHTS[pos];
    return (Object.keys(weights) as (keyof typeof weights)[])
      .reduce((sum, attr) => sum + (attrs[attr] ?? 5) * weights[attr], 0);
  };

  const defExact = weighted('DEF');
  const midExact = weighted('MID');
  const fwdExact = weighted('FWD');

  const defRounded = Math.round(defExact * 10) / 10;
  const midRounded = Math.round(midExact * 10) / 10;
  const fwdRounded = Math.round(fwdExact * 10) / 10;

  // Best outfield position: highest of DEF / MID / FWD. Tie-break order: DEF -> MID -> FWD
  let bestPosition: 'DEF' | 'MID' | 'FWD' = 'DEF';
  let highest = defExact;

  if (midExact > highest) {
    highest = midExact;
    bestPosition = 'MID';
  }
  if (fwdExact > highest) {
    highest = fwdExact;
    bestPosition = 'FWD';
  }

  return {
    def: defRounded,
    mid: midRounded,
    fwd: fwdRounded,
    bestPosition,
  };
}

/**
 * Normalizes user data with seamless backwards compatibility for existing players
 */
export function normalizePlayer(user: AppUser): NormalizedPlayer {
  const attrs: PlayerAttributes = {
    pace: typeof user.pace === 'number' ? user.pace : 5,
    stamina: typeof user.stamina === 'number' ? user.stamina : 5,
    dribbling: typeof user.dribbling === 'number' ? user.dribbling : 5,
    passing: typeof user.passing === 'number' ? user.passing : (user.passingRating ?? 5),
    finishing: typeof user.finishing === 'number' ? user.finishing : (user.attackRating ?? 5),
    defending: typeof user.defending === 'number' ? user.defending : (user.defRating ?? 5),
    gameIQ: typeof user.gameIQ === 'number' ? user.gameIQ : (user.iqRating ?? 5),
    gkRating: typeof user.gkRating === 'number' ? user.gkRating : (user.primaryPosition === 'GK' || (Array.isArray(user.preferredPos) && user.preferredPos[0] === 'GK') ? 5 : null),
  };

  let primary = user.primaryPosition;
  let secondary = user.secondaryPosition;

  if (!primary && Array.isArray(user.preferredPos) && user.preferredPos.length > 0) {
    primary = user.preferredPos[0];
    if (user.preferredPos.length > 1) {
      secondary = user.preferredPos[1];
    }
  }

  const primaryPosition = sanitizePosition(primary);
  const secondaryPosition = secondary ? sanitizePosition(secondary) : undefined;
  const happyAnywhere = Boolean(user.happyAnywhere);

  const calculated = calculatePositionRatings(attrs);

  return {
    uid: user.uid,
    name: user.name || 'Unknown Player',
    primaryPosition,
    secondaryPosition,
    happyAnywhere,
    attributes: attrs,
    calculated,
    rawUser: user,
  };
}

/**
 * Calculates the familiarity multiplier for an assigned position
 * Rule: When more than one applies, the higher multiplier is used.
 */
export function getFamiliarityMultiplier(
  assignedPos: Position,
  primaryPos: Position,
  secondaryPos?: Position,
  happyAnywhere?: boolean
): number {
  if (assignedPos === primaryPos) {
    return FAMILIARITY_MULTIPLIERS.PRIMARY; // 1.00
  }

  const isSecondary = secondaryPos && assignedPos === secondaryPos;
  const isHappy = Boolean(happyAnywhere);

  if (isHappy && isSecondary) {
    return Math.max(FAMILIARITY_MULTIPLIERS.HAPPY_ANYWHERE, FAMILIARITY_MULTIPLIERS.SECONDARY); // 0.95 vs 0.92 -> 0.95
  }

  if (isSecondary) {
    return FAMILIARITY_MULTIPLIERS.SECONDARY; // 0.92
  }

  if (isHappy) {
    return FAMILIARITY_MULTIPLIERS.HAPPY_ANYWHERE; // 0.95
  }

  return FAMILIARITY_MULTIPLIERS.OTHER; // 0.85
}

/**
 * Returns raw rating, multiplier, and effective rating for a player in a position
 */
export function getPlayerEffectiveRating(player: NormalizedPlayer, position: Position): {
  rawRating: number;
  multiplier: number;
  effectiveRating: number;
} {
  let rawRating = 5.0;

  if (position === 'GK') {
    rawRating = typeof player.attributes.gkRating === 'number' ? player.attributes.gkRating : 3.5;
  } else if (position === 'DEF') {
    rawRating = player.calculated.def;
  } else if (position === 'MID') {
    rawRating = player.calculated.mid;
  } else if (position === 'FWD' || position === 'ST') {
    rawRating = player.calculated.fwd;
  }

  const multiplier = getFamiliarityMultiplier(
    position,
    player.primaryPosition,
    player.secondaryPosition,
    player.happyAnywhere
  );

  const effectiveRating = Math.round(rawRating * multiplier * 10) / 10;

  return {
    rawRating,
    multiplier,
    effectiveRating,
  };
}

/**
 * Creates formation slots based on team size.
 * For 6 players: [GK, DEF, DEF, MID, MID, FWD] (Default Sunday 6v6)
 */
export function getFormationSlots(teamSize: number): SlotPosition[] {
  if (teamSize === 6) {
    return ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD'];
  }
  if (teamSize === 5) {
    return ['GK', 'DEF', 'DEF', 'MID', 'FWD'];
  }
  if (teamSize === 7) {
    return ['GK', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD'];
  }

  // Generic fallback
  const slots: SlotPosition[] = ['GK', 'FWD'];
  const remaining = teamSize - 2;
  const defCount = Math.ceil(remaining / 2);
  const midCount = remaining - defCount;
  for (let i = 0; i < defCount; i++) slots.push('DEF');
  for (let i = 0; i < midCount; i++) slots.push('MID');
  return slots;
}

/**
 * Finds the optimal assignment of players into formation slots maximizing total strength.
 * Assigns each player a position from the remaining slot counts, so duplicate slots
 * (DEF, DEF) aren't permuted: 180 arrangements for 6v6 instead of 720.
 */
function optimizeTeamLineup(
  players: NormalizedPlayer[],
  slots: SlotPosition[]
): { positions: Record<string, Position>; strength: number } {
  const ratingCache = players.map(p => {
    const r = {} as Record<SlotPosition, number>;
    SLOT_POSITIONS.forEach(pos => { r[pos] = getPlayerEffectiveRating(p, pos).effectiveRating; });
    return r;
  });

  const fitPenaltyCache = players.map(p => {
    const r = {} as Record<SlotPosition, number>;
    SLOT_POSITIONS.forEach(pos => { r[pos] = getPositionFitPenalty(p, pos); });
    return r;
  });

  const remaining: Record<SlotPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  slots.forEach(pos => remaining[pos]++);

  let bestScore = -Infinity;
  let bestAssignment: SlotPosition[] = [];
  const currentAssignment: SlotPosition[] = [];

  function search(playerIdx: number, currentScore: number) {
    if (playerIdx === players.length) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAssignment = [...currentAssignment];
      }
      return;
    }

    for (const pos of SLOT_POSITIONS) {
      if (remaining[pos] === 0) continue;
      remaining[pos]--;
      currentAssignment[playerIdx] = pos;
      // Same fit penalty the split score uses, so the lineup optimizes what the split is judged on
      search(playerIdx + 1, currentScore + ratingCache[playerIdx][pos] - fitPenaltyCache[playerIdx][pos]);
      remaining[pos]++;
    }
  }

  search(0, 0);

  let totalStrength = 0;
  const positions: Record<string, Position> = {};
  players.forEach((p, i) => {
    const pos = bestAssignment[i];
    positions[p.uid] = pos;
    totalStrength += ratingCache[i][pos];
  });

  return {
    positions,
    strength: Math.round(totalStrength * 10) / 10,
  };
}

/**
 * Picks the best positions within each team and scores the split:
 * - Difference in team strength (diff up to MAX_RATING_DIFF_PER_PLAYER × team size is minimally penalized; beyond that heavily penalized)
 * - Position fit penalty (Primary: 0, Secondary / Flex: 0.2, Out-of-position: 3.0)
 * - GK Coverage & Rotation Capability:
 *   * Dedicated primary GK in goal: 0
 *   * No primary GK, but >= 2 rotators (secondary GK, flex, or GK rating >= 6): 1.5
 *   * No primary GK, only 1 rotator: 5.0
 *   * No primary GK, 0 rotators: 15.0
 * Used both by the generator and to re-score teams after manual edits.
 */
export function evaluateSplit(redPlayers: NormalizedPlayer[], whitePlayers: NormalizedPlayer[]): AssignedLineup {
  const redOpt = optimizeTeamLineup(redPlayers, getFormationSlots(redPlayers.length));
  const whiteOpt = optimizeTeamLineup(whitePlayers, getFormationSlots(whitePlayers.length));

  const strengthDiff = Math.round(Math.abs(redOpt.strength - whiteOpt.strength) * 10) / 10;

  // Position fit penalties
  let totalPositionPenalty = 0;
  let offPrimaryCount = 0;

  [...redPlayers, ...whitePlayers].forEach(p => {
    const pos = redOpt.positions[p.uid] ?? whiteOpt.positions[p.uid];
    if (pos !== p.primaryPosition) offPrimaryCount++;
    totalPositionPenalty += getPositionFitPenalty(p, pos);
  });

  // Goalkeeper coverage & rotation capability
  const redGkPenalty = evaluateTeamGk(redPlayers, redOpt.positions);
  const whiteGkPenalty = evaluateTeamGk(whitePlayers, whiteOpt.positions);
  const missingGkPenalty = Math.round((redGkPenalty + whiteGkPenalty) * 10) / 10;

  // Rating difference penalty (allow small diff without sacrificing position fit)
  const tolerance = ALGORITHM_SETTINGS.MAX_RATING_DIFF_PER_PLAYER * Math.max(redPlayers.length, whitePlayers.length);
  let strengthDiffPenalty = 0;
  if (strengthDiff <= tolerance) {
    strengthDiffPenalty = strengthDiff * 0.25;
  } else {
    strengthDiffPenalty = (tolerance * 0.25) + ((strengthDiff - tolerance) * 5.0);
  }

  const splitScore = Math.round(
    (strengthDiffPenalty + totalPositionPenalty + missingGkPenalty) * 100
  ) / 100;

  return {
    teamRed: redPlayers.map(p => p.uid),
    teamWhite: whitePlayers.map(p => p.uid),
    redPositions: redOpt.positions,
    whitePositions: whiteOpt.positions,
    redStrength: redOpt.strength,
    whiteStrength: whiteOpt.strength,
    strengthDiff,
    offPrimaryCount,
    missingGkPenalty,
    splitScore,
  };
}

/**
 * Team Generation Algorithm:
 * 1. Generate all splits into two teams (e.g. 462 splits for 12 players).
 * 2. Score each split with evaluateSplit.
 * 3. Pick randomly from the top 5 splits within VARIETY_SCORE_WINDOW of the best score.
 */
export function generateBalancedTeams(
  rosterUids: string[],
  userMap: Record<string, AppUser>
): AssignedLineup | null {
  if (rosterUids.length < 2) return null;

  const normalizedPlayers = rosterUids.map(uid => {
    const raw = userMap[uid] || { uid, name: 'Player' };
    return normalizePlayer(raw);
  });

  const totalPlayers = normalizedPlayers.length;
  const teamSize = Math.floor(totalPlayers / 2);

  // 1. Generate unique combinations of team splits
  // To avoid duplicate mirror teams, fix player[0] in Team Red
  const candidateSplits: { redIndices: number[]; whiteIndices: number[] }[] = [];

  function getSplits(start: number, current: number[]) {
    if (current.length === teamSize - 1) {
      const redIndices = [0, ...current];
      const redSet = new Set(redIndices);
      const whiteIndices: number[] = [];
      for (let i = 0; i < totalPlayers; i++) {
        if (!redSet.has(i)) whiteIndices.push(i);
      }
      candidateSplits.push({ redIndices, whiteIndices });
      return;
    }

    const needed = teamSize - 1 - current.length;
    for (let i = start; i <= totalPlayers - needed; i++) {
      current.push(i);
      getSplits(i + 1, current);
      current.pop();
    }
  }

  getSplits(1, []);

  if (candidateSplits.length === 0) return null;

  // 2. Evaluate each split
  const evaluatedSplits = candidateSplits.map(split => evaluateSplit(
    split.redIndices.map(i => normalizedPlayers[i]),
    split.whiteIndices.map(i => normalizedPlayers[i])
  ));

  // 3. Sort by splitScore ascending, pick randomly among the near-best
  evaluatedSplits.sort((a, b) => a.splitScore - b.splitScore);

  const maxScore = evaluatedSplits[0].splitScore + ALGORITHM_SETTINGS.VARIETY_SCORE_WINDOW;
  const pool = evaluatedSplits
    .slice(0, ALGORITHM_SETTINGS.TOP_N_SPLITS)
    .filter(s => s.splitScore <= maxScore);

  return pool[Math.floor(Math.random() * pool.length)];
}
