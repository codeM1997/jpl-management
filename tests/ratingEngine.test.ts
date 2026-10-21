import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AppUser } from '../src/types.ts';
import { OFFICIAL_PLAYERS } from '../src/data/officialPlayers.ts';
import {
  POSITION_WEIGHTS,
  calculatePositionRatings,
  evaluateSplit,
  generateBalancedTeams,
  getFormationSlots,
  normalizePlayer,
} from '../src/utils/ratingEngine.ts';

const users: Record<string, AppUser> = {};
OFFICIAL_PLAYERS.forEach(p => {
  users[p.name] = { ...p, uid: p.name, secondaryPosition: p.secondaryPosition || undefined } as AppUser;
});
const byName = (...names: string[]) => names.map(n => { assert.ok(users[n], n); return n; });

function countPositions(uids: string[], positions: Record<string, string>) {
  const counts: Record<string, number> = {};
  uids.forEach(uid => { counts[positions[uid]] = (counts[positions[uid]] ?? 0) + 1; });
  return counts;
}

function assertFormation(uids: string[], positions: Record<string, string>) {
  assert.ok(uids.every(uid => positions[uid]), 'every player has a position');
  const expected: Record<string, number> = {};
  getFormationSlots(uids.length).forEach(pos => { expected[pos] = (expected[pos] ?? 0) + 1; });
  assert.deepEqual(countPositions(uids, positions), expected);
}

test('weights sum to 1, so all-5 attributes rate 5.0 everywhere', () => {
  for (const weights of Object.values(POSITION_WEIGHTS)) {
    assert.equal(Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 1000), 1000);
  }
  const r = calculatePositionRatings({ pace: 5, stamina: 5, dribbling: 5, passing: 5, finishing: 5, defending: 5, gameIQ: 5 });
  assert.deepEqual([r.def, r.mid, r.fwd], [5, 5, 5]);
});

test('12 players: valid 6v6 formations, no player lost', () => {
  const roster = Object.keys(users).slice(0, 12);
  const result = generateBalancedTeams(roster, users)!;
  assert.equal(result.teamRed.length, 6);
  assert.equal(result.teamWhite.length, 6);
  assert.deepEqual([...result.teamRed, ...result.teamWhite].sort(), [...roster].sort());
  assertFormation(result.teamRed, result.redPositions);
  assertFormation(result.teamWhite, result.whitePositions);
});

test('13 players: bigger team gets a 7-slot formation, no duplicate GK/FWD', () => {
  const roster = Object.keys(users).slice(0, 13);
  const result = generateBalancedTeams(roster, users)!;
  assertFormation(result.teamRed, result.redPositions);
  assertFormation(result.teamWhite, result.whitePositions);
});

test('two primary GKs end up in goal on opposite teams', () => {
  const roster = byName(
    'Vedu', 'Akshat Mittal',
    'Anshul Mittal', 'Kartik Tripathi', 'Shivesh', 'Dhruv',
    'Mandi', 'Karun', 'Abhinav', 'Pankaj',
    'Gaurav', 'Shivanu',
  );
  const result = generateBalancedTeams(roster, users)!;
  const positions = { ...result.redPositions, ...result.whitePositions };
  assert.equal(positions['Vedu'], 'GK');
  assert.equal(positions['Akshat Mittal'], 'GK');
  assert.notEqual(result.teamRed.includes('Vedu'), result.teamRed.includes('Akshat Mittal'));
});

test('evaluateSplit re-scores a manual swap', () => {
  const roster = Object.keys(users).slice(0, 12).map(uid => normalizePlayer(users[uid]));
  const before = evaluateSplit(roster.slice(0, 6), roster.slice(6));
  const after = evaluateSplit([...roster.slice(1, 6), roster[6]], [roster[0], ...roster.slice(7)]);
  assert.ok(after.teamWhite.includes(roster[0].uid));
  assert.ok(after.whitePositions[roster[0].uid], 'moved player gets a position in the new team');
  assert.notDeepEqual([before.redStrength, before.whiteStrength], [after.redStrength, after.whiteStrength]);
});
