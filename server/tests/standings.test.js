// standings.test.js — Tests unitaires pour computeStandings (fonction pure, pas de DB)

const { computeStandings } = require('../utils/standings');

// Helpers pour construire des matchs et équipes de test
const T = (id) => id; // teamId = simple string

function match(id, t1, t2, sets, result) {
  return { _id: id, team1: t1, team2: t2, sets, result, played: true };
}

function set(s1, s2) {
  return { score1: s1, score2: s2 };
}

// ─── Poule 3 équipes ────────────────────────────────────────────────────────────

describe('Poule 3 équipes — classement simple', () => {
  const [A, B, C] = ['A', 'B', 'C'];

  // A bat B (2-0), A bat C (2-0), B bat C (2-0)
  // → A: 6pts, B: 3pts, C: 0pts
  const matches = [
    match('m1', A, B, [set(4, 2), set(4, 1)], 'team1'),
    match('m2', A, C, [set(4, 0), set(4, 2)], 'team1'),
    match('m3', B, C, [set(4, 3), set(4, 2)], 'team1'),
  ];

  test('classement par points', () => {
    const standings = computeStandings([A, B, C], matches);
    expect(standings[0].teamId).toBe(A);
    expect(standings[1].teamId).toBe(B);
    expect(standings[2].teamId).toBe(C);
  });

  test('points corrects (victoire = 3pts)', () => {
    const standings = computeStandings([A, B, C], matches);
    expect(standings[0].points).toBe(6);
    expect(standings[1].points).toBe(3);
    expect(standings[2].points).toBe(0);
  });

  test('wins/losses corrects', () => {
    const standings = computeStandings([A, B, C], matches);
    const a = standings.find(s => s.teamId === A);
    expect(a.won).toBe(2);
    expect(a.lost).toBe(0);
    expect(a.played).toBe(2);
  });

  test('ranks commencent à 1', () => {
    const standings = computeStandings([A, B, C], matches);
    expect(standings.map(s => s.rank)).toEqual([1, 2, 3]);
  });
});

// ─── Poule 4 équipes — différence de sets comme départage ──────────────────────

describe('Poule 4 équipes — départage par setDiff', () => {
  const [A, B, C, D] = ['A', 'B', 'C', 'D'];

  // A et B ont tous les deux 6 pts
  // A: setDiff +3, B: setDiff +1
  const matches = [
    match('m1', A, B, [set(4, 2), set(4, 2)], 'team1'),  // A bat B
    match('m2', A, C, [set(4, 3), set(4, 3)], 'team1'),  // A bat C
    match('m3', B, C, [set(4, 1), set(4, 2)], 'team1'),  // B bat C
    match('m4', A, D, [set(4, 0), set(4, 0)], 'team1'),  // A bat D
    match('m5', B, D, [set(4, 0), set(4, 0)], 'team1'),  // B bat D
    match('m6', C, D, [set(4, 0), set(4, 0)], 'team1'),  // C bat D
  ];

  test('A avant B malgré égalité de points (setDiff)', () => {
    const standings = computeStandings([A, B, C, D], matches);
    expect(standings[0].teamId).toBe(A);
    expect(standings[1].teamId).toBe(B);
  });

  test('D dernier avec 0 points', () => {
    const standings = computeStandings([A, B, C, D], matches);
    expect(standings[3].teamId).toBe(D);
    expect(standings[3].points).toBe(0);
  });
});

// ─── Confrontation directe ──────────────────────────────────────────────────────

describe('Départage par confrontation directe', () => {
  const [A, B, C] = ['A', 'B', 'C'];

  // Tous à 3 points, setDiff identique
  // A bat B, B bat C, C bat A
  const matches = [
    match('m1', A, B, [set(4, 2), set(4, 2)], 'team1'),  // A bat B
    match('m2', B, C, [set(4, 2), set(4, 2)], 'team1'),  // B bat C
    match('m3', C, A, [set(4, 2), set(4, 2)], 'team1'),  // C bat A
  ];

  test('chacun a 3 points', () => {
    const standings = computeStandings([A, B, C], matches);
    for (const s of standings) expect(s.points).toBe(3);
  });

  test('confrontation directe départage A vs B → A gagne', () => {
    // On compare seulement A vs B
    const standingsAB = computeStandings([A, B], [matches[0]]);
    expect(standingsAB[0].teamId).toBe(A);
  });
});

// ─── Matchs non joués ignorés ───────────────────────────────────────────────────

describe('Matchs non joués', () => {
  const [A, B] = ['A', 'B'];

  test('match played=false ignoré', () => {
    const matchNotPlayed = { _id: 'm1', team1: A, team2: B, sets: [], result: null, played: false };
    const standings = computeStandings([A, B], [matchNotPlayed]);
    expect(standings[0].points).toBe(0);
    expect(standings[1].points).toBe(0);
    expect(standings[0].played).toBe(0);
  });
});

// ─── setDiff calculé correctement ───────────────────────────────────────────────

describe('Calcul setDiff', () => {
  const [A, B] = ['A', 'B'];

  test('A gagne 2-1: setDiff A=+1, B=-1', () => {
    const m = match('m1', A, B, [set(4, 2), set(2, 4), set(4, 1)], 'team1');
    const standings = computeStandings([A, B], [m]);
    const a = standings.find(s => s.teamId === A);
    const b = standings.find(s => s.teamId === B);
    expect(a.setDiff).toBe(1);
    expect(b.setDiff).toBe(-1);
    expect(a.setsWon).toBe(2);
    expect(b.setsWon).toBe(1);
  });
});
