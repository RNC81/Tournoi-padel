// standings.test.js — Tests unitaires pour computeStandings (fonction pure, pas de DB)
// Règlement officiel : victoire=3pts, défaite=1pt, gameDiff=jeux marqués-concédés

const { computeStandings, computeAdjustedStats } = require('../utils/standings');

function match(id, t1, t2, sets, result) {
  return { _id: id, team1: t1, team2: t2, sets, result, played: true };
}
function set(s1, s2) { return { score1: s1, score2: s2 }; }

// ─── Règlement points ────────────────────────────────────────────────────────────

describe('Règlement officiel — points', () => {
  const [A, B] = ['A', 'B'];

  test('victoire = 3 pts', () => {
    const m = match('m1', A, B, [set(6, 3)], 'team1');
    const s = computeStandings([A, B], [m]);
    expect(s.find(x => x.teamId === A).points).toBe(3);
  });

  test('défaite = 1 pt (pas 0)', () => {
    const m = match('m1', A, B, [set(6, 3)], 'team1');
    const s = computeStandings([A, B], [m]);
    expect(s.find(x => x.teamId === B).points).toBe(1);
  });

  test('wins et lost corrects', () => {
    const m = match('m1', A, B, [set(6, 3)], 'team1');
    const s = computeStandings([A, B], [m]);
    const a = s.find(x => x.teamId === A);
    const b = s.find(x => x.teamId === B);
    expect(a.won).toBe(1); expect(a.lost).toBe(0);
    expect(b.won).toBe(0); expect(b.lost).toBe(1);
  });

  test('poule 4 équipes : points avec défaite=1', () => {
    const [A, B, C, D] = ['A', 'B', 'C', 'D'];
    // A bat tout le monde (3V 0D → 9pts)
    // D perd tout (0V 3D → 3pts)
    const matches = [
      match('m1', A, B, [set(6, 3)], 'team1'),
      match('m2', A, C, [set(6, 2)], 'team1'),
      match('m3', A, D, [set(6, 1)], 'team1'),
      match('m4', B, C, [set(6, 4)], 'team1'),
      match('m5', B, D, [set(6, 0)], 'team1'),
      match('m6', C, D, [set(6, 2)], 'team1'),
    ];
    const s = computeStandings([A, B, C, D], matches);
    expect(s.find(x => x.teamId === A).points).toBe(9);  // 3V × 3pts
    expect(s.find(x => x.teamId === B).points).toBe(7);  // 2V × 3pts + 1D × 1pt
    expect(s.find(x => x.teamId === C).points).toBe(5);  // 1V × 3pts + 2D × 1pt
    expect(s.find(x => x.teamId === D).points).toBe(3);  // 0V + 3D × 1pt
  });
});

// ─── gameDiff basé sur les jeux (pas les sets) ────────────────────────────────

describe('gameDiff — basé sur les jeux marqués/concédés', () => {
  const [A, B] = ['A', 'B'];

  test('set 6-3 : gameDiff A=+3, B=-3', () => {
    const m = match('m1', A, B, [set(6, 3)], 'team1');
    const s = computeStandings([A, B], [m]);
    expect(s.find(x => x.teamId === A).gameDiff).toBe(3);   // 6-3=+3
    expect(s.find(x => x.teamId === B).gameDiff).toBe(-3);  // 3-6=-3
  });

  test('set 6-3 : gamesWon A=6, B=3', () => {
    const m = match('m1', A, B, [set(6, 3)], 'team1');
    const s = computeStandings([A, B], [m]);
    expect(s.find(x => x.teamId === A).gamesWon).toBe(6);
    expect(s.find(x => x.teamId === B).gamesWon).toBe(3);
  });

  test('2 sets 6-4 6-2 : gameDiff A=+6, gamesWon A=12', () => {
    const m = match('m1', A, B, [set(6, 4), set(6, 2)], 'team1');
    const s = computeStandings([A, B], [m]);
    const a = s.find(x => x.teamId === A);
    expect(a.gamesWon).toBe(12);   // 6+6
    expect(a.gamesLost).toBe(6);   // 4+2
    expect(a.gameDiff).toBe(6);    // 12-6
  });

  test('gameDiff cumule sur plusieurs matchs', () => {
    const [A, B, C] = ['A', 'B', 'C'];
    // A bat B 6-3, A bat C 6-2 → gamesWon=12, gamesLost=5, gameDiff=+7
    const matches = [
      match('m1', A, B, [set(6, 3)], 'team1'),
      match('m2', A, C, [set(6, 2)], 'team1'),
      match('m3', B, C, [set(6, 4)], 'team1'),
    ];
    const s = computeStandings([A, B, C], matches);
    const a = s.find(x => x.teamId === A);
    expect(a.gamesWon).toBe(12);
    expect(a.gamesLost).toBe(5);
    expect(a.gameDiff).toBe(7);
  });
});

// ─── Ordre de classement ─────────────────────────────────────────────────────────

describe('Ordre classement — wins > gameDiff > gamesWon > directConfrontation', () => {

  test('plus de wins prime sur gameDiff', () => {
    const [A, B, C] = ['A', 'B', 'C'];
    // A : 2V, gameDiff faible | B : 1V, gameDiff élevé
    const matches = [
      match('m1', A, B, [set(6, 5)], 'team1'),  // A bat B 6-5 (gameDiff A: +1)
      match('m2', A, C, [set(6, 5)], 'team1'),  // A bat C 6-5 (gameDiff A: +2 total)
      match('m3', B, C, [set(6, 0)], 'team1'),  // B bat C 6-0 (gameDiff B: +1+6=+7 total)
    ];
    const s = computeStandings([A, B, C], matches);
    expect(s[0].teamId).toBe(A); // 2V > 1V malgré gameDiff A: +2 vs B: +7
    expect(s[1].teamId).toBe(B);
  });

  test('gameDiff départage à égalité de wins', () => {
    const [A, B, C] = ['A', 'B', 'C'];
    // A et B : 1V chacun, gameDiff différents
    const matches = [
      match('m1', A, B, [set(6, 3)], 'team1'),  // A bat B : gameDiff A=+3
      match('m2', C, A, [set(6, 1)], 'team1'),  // C bat A : gameDiff A=-5
      match('m3', C, B, [set(6, 4)], 'team1'),  // C bat B : gameDiff B=-4 → total B: 3-6-4=-7
    ];
    // A: 1V 1D, gameDiff = (6-3)+(1-6) = 3-5 = -2
    // B: 0V 2D — wait, B: 1D à A, 1D à C → 0V
    // let me pick better numbers
    // A: 1V 1D (bat B, perd contre C)
    // B: 1V 1D (bat C, perd contre A)
    // C: 1V 1D
    const matches2 = [
      match('m1', A, B, [set(6, 2)], 'team1'),  // A bat B
      match('m2', B, C, [set(6, 3)], 'team1'),  // B bat C
      match('m3', C, A, [set(6, 5)], 'team1'),  // C bat A
    ];
    // A: 1V 1D, gamesWon=6+5=11, gamesLost=2+6=8, gameDiff=+3
    // B: 1V 1D, gamesWon=2+6=8,  gamesLost=6+3=9, gameDiff=-1
    // C: 1V 1D, gamesWon=3+6=9,  gamesLost=6+5=11, gameDiff=-2... wait
    // C: gamesWon = 3(lost to B)+6(beat A) = 9, gamesLost = 6(lost to B)+5(beat A)=11?
    // C: match vs B: C lost (B beat C) → C: 3 scored, 6 conceded
    // C: match vs A: C won → C: 6 scored, 5 conceded
    // C: gamesWon=9, gamesLost=11, gameDiff=-2
    const s = computeStandings([A, B, C], matches2);
    expect(s[0].teamId).toBe(A); // gameDiff +3
    expect(s[1].teamId).toBe(B); // gameDiff -1
    expect(s[2].teamId).toBe(C); // gameDiff -2
  });

  test('classement complet — A 1er, D dernier', () => {
    const [A, B, C, D] = ['A', 'B', 'C', 'D'];
    const matches = [
      match('m1', A, B, [set(6, 2)], 'team1'),
      match('m2', A, C, [set(6, 3)], 'team1'),
      match('m3', A, D, [set(6, 1)], 'team1'),
      match('m4', B, C, [set(6, 3)], 'team1'),
      match('m5', B, D, [set(6, 2)], 'team1'),
      match('m6', C, D, [set(6, 4)], 'team1'),
    ];
    const s = computeStandings([A, B, C, D], matches);
    expect(s[0].teamId).toBe(A);
    expect(s[3].teamId).toBe(D);
  });
});

// ─── Confrontation directe ───────────────────────────────────────────────────────

describe('Confrontation directe', () => {
  const [A, B, C] = ['A', 'B', 'C'];

  const matches = [
    match('m1', A, B, [set(6, 4)], 'team1'),  // A bat B
    match('m2', B, C, [set(6, 4)], 'team1'),  // B bat C
    match('m3', C, A, [set(6, 4)], 'team1'),  // C bat A
  ];

  test('chacun a 1V 1D (wins pareil)', () => {
    const s = computeStandings([A, B, C], matches);
    for (const x of s) expect(x.won).toBe(1);
  });

  test('A vs B seul : A gagne (confrontation directe)', () => {
    const s = computeStandings([A, B], [matches[0]]);
    expect(s[0].teamId).toBe(A);
  });
});

// ─── Matchs non joués ignorés ────────────────────────────────────────────────────

describe('Matchs non joués', () => {
  const [A, B] = ['A', 'B'];

  test('match played=false ignoré', () => {
    const notPlayed = { _id: 'm1', team1: A, team2: B, sets: [], result: null, played: false };
    const s = computeStandings([A, B], [notPlayed]);
    expect(s[0].points).toBe(0);
    expect(s[0].played).toBe(0);
  });
});

// ─── computeAdjustedStats ────────────────────────────────────────────────────────

describe('computeAdjustedStats — comparaison équitable wildcards', () => {
  test('poule de 5 : pas d\'ajustement, stats normales retournées', () => {
    const teams = ['A', 'B', 'C', 'D', 'E'];
    const matches = [
      match('m1', 'A', 'B', [set(6, 3)], 'team1'),
      match('m2', 'A', 'C', [set(6, 2)], 'team1'),
      match('m3', 'A', 'D', [set(6, 1)], 'team1'),
      match('m4', 'A', 'E', [set(6, 4)], 'team1'),
      match('m5', 'B', 'C', [set(6, 3)], 'team1'),
      match('m6', 'B', 'D', [set(6, 2)], 'team1'),
      match('m7', 'B', 'E', [set(6, 3)], 'team1'),
      match('m8', 'C', 'D', [set(6, 2)], 'team1'),
      match('m9', 'C', 'E', [set(6, 3)], 'team1'),
      match('m10', 'D', 'E', [set(6, 4)], 'team1'),
    ];
    const adj = computeAdjustedStats('A', teams, matches, 5);
    expect(adj).not.toBeNull();
    expect(adj.won).toBe(4); // A bat tout le monde
  });

  test('poule de 6 : retire le match contre le dernier classé', () => {
    // 6 équipes : A domine, F est le dernier
    const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
    // Simplification : A bat tout le monde, F perd tout
    const matchesOf6 = [
      match('m1',  'A', 'B', [set(6, 3)], 'team1'),
      match('m2',  'A', 'C', [set(6, 2)], 'team1'),
      match('m3',  'A', 'D', [set(6, 1)], 'team1'),
      match('m4',  'A', 'E', [set(6, 4)], 'team1'),
      match('m5',  'A', 'F', [set(6, 0)], 'team1'), // A bat F
      match('m6',  'B', 'C', [set(6, 4)], 'team1'),
      match('m7',  'B', 'D', [set(6, 3)], 'team1'),
      match('m8',  'B', 'E', [set(6, 2)], 'team1'),
      match('m9',  'B', 'F', [set(6, 1)], 'team1'), // B bat F
      match('m10', 'C', 'D', [set(6, 3)], 'team1'),
      match('m11', 'C', 'E', [set(6, 2)], 'team1'),
      match('m12', 'C', 'F', [set(6, 1)], 'team1'), // C bat F
      match('m13', 'D', 'E', [set(6, 4)], 'team1'),
      match('m14', 'D', 'F', [set(6, 2)], 'team1'), // D bat F
      match('m15', 'E', 'F', [set(6, 3)], 'team1'), // E bat F
    ];
    // F est dernier → son match vs A (m5) doit être retiré pour A
    // Stats normales de A : 5V, gamesWon=30 (6×5), gamesLost=10 (3+2+1+4+0)
    // Stats ajustées de A : 4V (sans F), gamesWon=24 (6×4), gamesLost=10 (3+2+1+4)

    const adjA = computeAdjustedStats('A', teams, matchesOf6, 6);
    expect(adjA.won).toBe(4);       // 4 victoires sans le match vs F
    expect(adjA.gamesWon).toBe(24); // 6*4 = 24 jeux gagnés
  });

  test('poule de 6 : stats ajustées = moins de matchs joués', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
    const matchesOf6 = [
      match('m1', 'A', 'B', [set(6, 3)], 'team1'),
      match('m2', 'A', 'C', [set(6, 2)], 'team1'),
      match('m3', 'A', 'D', [set(6, 1)], 'team1'),
      match('m4', 'A', 'E', [set(6, 4)], 'team1'),
      match('m5', 'A', 'F', [set(6, 0)], 'team1'),
      match('m6', 'B', 'C', [set(6, 3)], 'team1'),
      match('m7', 'B', 'D', [set(6, 2)], 'team1'),
      match('m8', 'B', 'E', [set(6, 1)], 'team1'),
      match('m9', 'B', 'F', [set(6, 3)], 'team1'),
      match('m10', 'C', 'D', [set(6, 4)], 'team1'),
      match('m11', 'C', 'E', [set(6, 2)], 'team1'),
      match('m12', 'C', 'F', [set(6, 1)], 'team1'),
      match('m13', 'D', 'E', [set(6, 3)], 'team1'),
      match('m14', 'D', 'F', [set(6, 2)], 'team1'),
      match('m15', 'E', 'F', [set(6, 4)], 'team1'),
    ];
    const normal = computeStandings(teams, matchesOf6).find(x => x.teamId === 'A');
    const adj    = computeAdjustedStats('A', teams, matchesOf6, 6);
    expect(adj.played).toBe(normal.played - 1); // 1 match en moins
  });
});

// ─── Suite 8 — Meilleurs 4èmes ───────────────────────────────────────────────
//
// Cette suite teste la logique d'équité wildcard :
// un 4ème de poule de 6 a ses stats ajustées (match vs dernier retiré)
// pour être comparé équitablement à un 4ème de poule de 5.
//
// La fonction de tri wildcard est extraite comme pure function (même logique
// que dans bracket.js computeQualification) pour éviter un accès DB.

// Même helper de tri que dans bracket.js wildcardCandidates.sort(...)
function sortWildcards(candidates, tiebreaker = ['wins', 'gameDiff', 'gamesWon']) {
  return [...candidates].sort((a, b) => {
    for (const c of tiebreaker) {
      if (c === 'wins'     && b.won      !== a.won)      return b.won      - a.won;
      if (c === 'gameDiff' && b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (c === 'gamesWon' && b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    }
    return 0;
  });
}

describe('Suite 8 — Meilleurs 4èmes (computeAdjustedStats + tri wildcard)', () => {

  // ── Données communes ──────────────────────────────────────────────────────
  //
  // Pool de 6 : A(1er) B(2e) C(3e) D(4e) E(5e) F(6e)
  // A bat tout, B bat C D E F, C bat D E F, D bat E F, E bat F
  // → F est dernier

  const teams6 = ['A', 'B', 'C', 'D', 'E', 'F'];
  const ms6 = [
    match('m1',  'A', 'B', [set(6, 3)], 'team1'),
    match('m2',  'A', 'C', [set(6, 2)], 'team1'),
    match('m3',  'A', 'D', [set(6, 1)], 'team1'),
    match('m4',  'A', 'E', [set(6, 4)], 'team1'),
    match('m5',  'A', 'F', [set(6, 0)], 'team1'),
    match('m6',  'B', 'C', [set(6, 4)], 'team1'),
    match('m7',  'B', 'D', [set(6, 3)], 'team1'),
    match('m8',  'B', 'E', [set(6, 2)], 'team1'),
    match('m9',  'B', 'F', [set(6, 1)], 'team1'),
    match('m10', 'C', 'D', [set(6, 3)], 'team1'),
    match('m11', 'C', 'E', [set(6, 2)], 'team1'),
    match('m12', 'C', 'F', [set(6, 1)], 'team1'),
    match('m13', 'D', 'E', [set(6, 4)], 'team1'),
    match('m14', 'D', 'F', [set(6, 2)], 'team1'),
    match('m15', 'E', 'F', [set(6, 3)], 'team1'),
  ];

  // Pool de 5 : P(1er) Q(2e) R(3e) D2(4e) S(5e)
  // P bat tout, Q bat R D2 S, R bat D2 S, D2 bat S
  const teams5 = ['P', 'Q', 'R', 'D2', 'S'];
  const ms5 = [
    match('p1', 'P', 'Q',  [set(6, 3)], 'team1'),
    match('p2', 'P', 'R',  [set(6, 2)], 'team1'),
    match('p3', 'P', 'D2', [set(6, 1)], 'team1'),
    match('p4', 'P', 'S',  [set(6, 4)], 'team1'),
    match('p5', 'Q', 'R',  [set(6, 3)], 'team1'),
    match('p6', 'Q', 'D2', [set(6, 2)], 'team1'),
    match('p7', 'Q', 'S',  [set(6, 3)], 'team1'),
    match('p8', 'R', 'D2', [set(6, 2)], 'team1'),
    match('p9', 'R', 'S',  [set(6, 3)], 'team1'),
    match('p10','D2','S',  [set(6, 4)], 'team1'),
  ];

  // ─── Test 1 ───────────────────────────────────────────────────────────────

  test('Test 1 — poule de 6 : stats ajustées de D (4ème) retirent le match vs F (6ème)', () => {
    // D cru : beat E(m13) + F(m14), lost to A(m3) B(m7) C(m10) → 5 matchs
    // D ajusté (sans F) : beat E, lost to A B C → 4 matchs
    //   gamesWon : 6(vs E)+1(vs A)+3(vs B)+3(vs C) = 13
    //   gamesLost: 4(vs E)+6(vs A)+6(vs B)+6(vs C) = 22
    //   gameDiff  = 13-22 = -9

    const adjD = computeAdjustedStats('D', teams6, ms6, 6);

    expect(adjD).not.toBeNull();
    expect(adjD.played).toBe(4);       // un match en moins (sans F)
    expect(adjD.won).toBe(1);          // seule victoire restante : vs E
    expect(adjD.lost).toBe(3);
    expect(adjD.gamesWon).toBe(13);
    expect(adjD.gamesLost).toBe(22);
    expect(adjD.gameDiff).toBe(-9);
  });

  // ─── Test 2 ───────────────────────────────────────────────────────────────

  test('Test 2 — poule de 5 : stats ajustées de D2 (4ème) = stats brutes', () => {
    // Pool de 5 → pas d'ajustement, computeAdjustedStats retourne les stats normales
    // D2 : beat S(p10), lost to P(p3) Q(p6) R(p8) → 4 matchs joués
    //   gamesWon : 6(vs S)+1(vs P)+2(vs Q)+2(vs R) = 11
    //   gamesLost: 4(vs S)+6(vs P)+6(vs Q)+6(vs R) = 22
    //   gameDiff  = 11-22 = -11

    const rawStandings = computeStandings(teams5, ms5);
    const rawD2  = rawStandings.find(x => x.teamId === 'D2');
    const adjD2  = computeAdjustedStats('D2', teams5, ms5, 5);

    expect(adjD2).not.toBeNull();
    expect(adjD2.played).toBe(rawD2.played);
    expect(adjD2.won).toBe(rawD2.won);
    expect(adjD2.lost).toBe(rawD2.lost);
    expect(adjD2.gamesWon).toBe(rawD2.gamesWon);
    expect(adjD2.gameDiff).toBe(rawD2.gameDiff);
  });

  // ─── Test 3 ───────────────────────────────────────────────────────────────

  test('Test 3 — comparaison équitable : les deux 4èmes ont played=4 après ajustement', () => {
    // 4ème poule de 6 → ajusté à 4 matchs
    // 4ème poule de 5 → brut = 4 matchs (pas d'ajustement)
    // Les deux sont comparables sur la même base (4 matchs)

    const adjD  = computeAdjustedStats('D',  teams6, ms6, 6);
    const adjD2 = computeAdjustedStats('D2', teams5, ms5, 5);

    expect(adjD.played).toBe(4);
    expect(adjD2.played).toBe(4);
    // Comparaison sur le même nombre de matchs → équitable
    expect(adjD.played).toBe(adjD2.played);
  });

  // ─── Test 4 ───────────────────────────────────────────────────────────────

  test('Test 4 — sélection des 2 meilleurs 4èmes parmi 5 candidats', () => {
    // Simuler des candidats wildcard (stats ajustées ou brutes selon taille)
    // Format : { teamId, won, gameDiff, gamesWon } — comme computeStandings output
    const candidates = [
      { teamId: 'W1', won: 2, gameDiff: +4,  gamesWon: 20 }, // 1er attendu
      { teamId: 'W2', won: 1, gameDiff: +2,  gamesWon: 18 }, // 3e (1V < 2V)
      { teamId: 'W3', won: 2, gameDiff: +1,  gamesWon: 15 }, // 2e (2V mais gameDiff inférieur)
      { teamId: 'W4', won: 0, gameDiff: -3,  gamesWon: 10 }, // 5e
      { teamId: 'W5', won: 1, gameDiff: -1,  gamesWon: 14 }, // 4e
    ];

    const sorted = sortWildcards(candidates);
    const top2   = sorted.slice(0, 2).map(c => c.teamId);

    // W1 (2V, diff+4) et W3 (2V, diff+1) sont les meilleurs 4èmes
    expect(top2).toContain('W1');
    expect(top2).toContain('W3');
    expect(top2).not.toContain('W2'); // 1V seulement
    expect(top2).not.toContain('W4');
    expect(top2).not.toContain('W5');
    // W1 est forcément premier (meilleur gameDiff parmi les 2V)
    expect(sorted[0].teamId).toBe('W1');
    expect(sorted[1].teamId).toBe('W3');
  });

  // ─── Test 5 ───────────────────────────────────────────────────────────────

  test('Test 5 — égalité parfaite : pas de crash, résultat déterministe sur même données', () => {
    // Deux 4èmes avec exactement les mêmes stats ajustées
    const tie1 = [
      { teamId: 'X1', won: 1, gameDiff: 0, gamesWon: 15 },
      { teamId: 'X2', won: 1, gameDiff: 0, gamesWon: 15 },
    ];
    const tie2 = [
      { teamId: 'X1', won: 1, gameDiff: 0, gamesWon: 15 },
      { teamId: 'X2', won: 1, gameDiff: 0, gamesWon: 15 },
    ];

    // Ne doit pas planter
    expect(() => sortWildcards(tie1)).not.toThrow();

    const run1 = sortWildcards(tie1);
    const run2 = sortWildcards(tie2);

    // Les deux runs donnent le même premier (déterministe)
    expect(run1[0].teamId).toBe(run2[0].teamId);

    // Le résultat est l'un des deux (pas undefined ni crash)
    expect(['X1', 'X2']).toContain(run1[0].teamId);
  });
});
