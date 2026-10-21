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
  MAX_RATING_DIFF_TOLERANCE: 2.0,
  TOP_N_SPLITS: 5,
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
    (typeof player.attributes.gkRating === 'number' && player.attributes.gkRating >= 5.0)
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
  const p = attrs.pace ?? 5;
  const s = attrs.stamina ?? 5;
  const d = attrs.dribbling ?? 5;
  const pas = attrs.passing ?? 5;
  const f = attrs.finishing ?? 5;
  const def = attrs.defending ?? 5;
  const iq = attrs.gameIQ ?? 5;

  const defExact = (p * 0.15) + (s * 0.15) + (d * 0.10) + (pas * 0.10) + (f * 0.00) + (def * 0.35) + (iq * 0.15);
  const midExact = (p * 0.05) + (s * 0.20) + (d * 0.15) + (pas * 0.25) + (f * 0.10) + (def * 0.10) + (iq * 0.15);
  const fwdExact = (p * 0.15) + (s * 0.10) + (d * 0.20) + (pas * 0.10) + (f * 0.30) + (def * 0.00) + (iq * 0.15);

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
export function getFormationSlots(teamSize: number): Position[] {
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
  const slots: Position[] = ['GK', 'FWD'];
  const remaining = teamSize - 2;
  const defCount = Math.ceil(remaining / 2);
  const midCount = remaining - defCount;
  for (let i = 0; i < defCount; i++) slots.push('DEF');
  for (let i = 0; i < midCount; i++) slots.push('MID');
  return slots;
}

/**
 * Finds the optimal assignment of players into formation slots maximizing total strength.
 * For 6v6 (6 players, [GK, DEF, DEF, MID, MID, FWD]), evaluates all 180 unique combinations.
 */
function optimizeTeamLineup(
  players: NormalizedPlayer[],
  slots: Position[]
): { positions: Record<string, Position>; strength: number } {
  const n = players.length;

  // Pre-calculate effective ratings for each player at each distinct position
  const ratingCache = players.map(p => ({
    GK: getPlayerEffectiveRating(p, 'GK').effectiveRating,
    DEF: getPlayerEffectiveRating(p, 'DEF').effectiveRating,
    MID: getPlayerEffectiveRating(p, 'MID').effectiveRating,
    FWD: getPlayerEffectiveRating(p, 'FWD').effectiveRating,
  }));

  const fitPenaltyCache = players.map(p => ({
    GK: getPositionFitPenalty(p, 'GK'),
    DEF: getPositionFitPenalty(p, 'DEF'),
    MID: getPositionFitPenalty(p, 'MID'),
    FWD: getPositionFitPenalty(p, 'FWD'),
  }));

  let bestScore = -999999;
  let bestAssignment: Position[] = [];

  const used = new Array(n).fill(false);
  const currentAssignment = new Array<Position>(n);

  function search(slotIdx: number, currentScore: number) {
    if (slotIdx === slots.length) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAssignment = [...currentAssignment];
      }
      return;
    }

    const pos = slots[slotIdx];

    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        used[i] = true;
        currentAssignment[i] = pos;
        const rate = (ratingCache[i] as any)[pos];
        const fitPen = (fitPenaltyCache[i] as any)[pos];
        // Lineup solver maximizes rating while strongly disfavoring out-of-position assignments
        search(slotIdx + 1, currentScore + rate - (fitPen * 0.5));
        used[i] = false;
      }
    }
  }

  search(0, 0);

  let totalStrength = 0;
  const positions: Record<string, Position> = {};
  players.forEach((p, i) => {
    const pos = bestAssignment[i] || 'MID';
    positions[p.uid] = pos;
    totalStrength += (ratingCache[i] as any)[pos];
  });

  return {
    positions,
    strength: Math.round(totalStrength * 10) / 10,
  };
}

/**
 * 5-Step Team Generation Algorithm:
 * 1. Generate all splits into two teams (e.g. 462 splits for 12 players).
 * 2. Find best positions within each team (180 arrangements per team). Keep arrangement prioritizing primary/secondary fit and strength.
 * 3. Score each split:
 *    - Difference in team strength (diff up to 2.0 is allowed and minimally penalized; diff > 2.0 heavily penalized)
 *    - Position fit penalty (Primary: 0, Secondary / Flex: 0.2, Out-of-position: 3.0)
 *    - GK Coverage & Rotation Capability:
 *      * Dedicated primary GK in goal: 0
 *      * No primary GK, but >= 2 rotators (secondary GK or flex): 1.5
 *      * No primary GK, only 1 rotator: 5.0
 *      * No primary GK, 0 rotators: 15.0
 * 4. Pick randomly from the top 5 lowest-scoring splits for variety.
 * 5. Return assigned teams, positions, and scores.
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
  const slots = getFormationSlots(teamSize);

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

  // 2 & 3. Evaluate each split
  const evaluatedSplits: AssignedLineup[] = candidateSplits.map(split => {
    const redPlayers = split.redIndices.map(i => normalizedPlayers[i]);
    const whitePlayers = split.whiteIndices.map(i => normalizedPlayers[i]);

    const redOpt = optimizeTeamLineup(redPlayers, slots);
    const whiteOpt = optimizeTeamLineup(whitePlayers, slots);

    const strengthDiff = Math.round(Math.abs(redOpt.strength - whiteOpt.strength) * 10) / 10;

    // Position fit penalties
    let totalPositionPenalty = 0;
    let offPrimaryCount = 0;

    redPlayers.forEach(p => {
      const pos = redOpt.positions[p.uid];
      if (pos !== p.primaryPosition) offPrimaryCount++;
      totalPositionPenalty += getPositionFitPenalty(p, pos);
    });

    whitePlayers.forEach(p => {
      const pos = whiteOpt.positions[p.uid];
      if (pos !== p.primaryPosition) offPrimaryCount++;
      totalPositionPenalty += getPositionFitPenalty(p, pos);
    });

    // Goalkeeper coverage & rotation capability
    const redGkPenalty = evaluateTeamGk(redPlayers, redOpt.positions);
    const whiteGkPenalty = evaluateTeamGk(whitePlayers, whiteOpt.positions);
    const missingGkPenalty = Math.round((redGkPenalty + whiteGkPenalty) * 10) / 10;

    // Rating difference penalty (allow diff up to 2.0 without sacrificing position fit)
    let strengthDiffPenalty = 0;
    if (strengthDiff <= ALGORITHM_SETTINGS.MAX_RATING_DIFF_TOLERANCE) {
      strengthDiffPenalty = strengthDiff * 0.25;
    } else {
      strengthDiffPenalty = (ALGORITHM_SETTINGS.MAX_RATING_DIFF_TOLERANCE * 0.25) + ((strengthDiff - ALGORITHM_SETTINGS.MAX_RATING_DIFF_TOLERANCE) * 5.0);
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
  });

  // 4. Sort by splitScore ascending
  evaluatedSplits.sort((a, b) => a.splitScore - b.splitScore);

  // Take top N splits (default 5) and pick 1 randomly
  const topCount = Math.min(ALGORITHM_SETTINGS.TOP_N_SPLITS, evaluatedSplits.length);
  const randomIndex = Math.floor(Math.random() * topCount);

  return evaluatedSplits[randomIndex];
}
