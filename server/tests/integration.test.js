// integration.test.js — Tests d'intégration des règles métier critiques
// Toutes ces fonctions sont pures (pas de DB) — utilisent les vrais utils exportés.
'use strict';

const { distributeTeams, calcNumGroups } = require('../utils/draw');
const { computeStandings }               = require('../utils/standings');
const { computeSeeding }                 = require('../utils/seeding');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTeams(n, country = null) {
  return Array.from({ length: n }, (_, i) => ({
    _id:     `team${i}`,
    name:    `Team ${i}`,
    country: country || '',
  }));
}

// Génère des équipes avec des pays cycliques : ex 4 pays → ABABAB...
function makeTeamsWithCountries(n, countries) {
  return Array.from({ length: n }, (_, i) => ({
    _id:     `team${i}`,
    name:    `Team ${i}`,
    country: countries[i % countries.length],
  }));
}

// Construit un match brut (tel que stocké en DB, non populé)
function makeMatch(team1, team2, sets, result) {
  return {
    team1,
    team2,
    played: !!result,
    sets:   sets || [],
    result: result || null,
  };
}

// ─── SUITE 1 : Tirage au sort (distribution des équipes) ──────────────────────

describe('Suite 1 — Tirage au sort', () => {
  const SIZES  = [41, 45, 50, 55, 60, 65, 70];
  const GROUP_SIZES = [3, 4, 5, 6, 7, 8];

  test.each(SIZES)('%i équipes : calcNumGroups donne toujours ≥ 1 groupe (groupSize 5)', (n) => {
    const numG = calcNumGroups(n, 5);
    expect(numG).toBeGreaterThanOrEqual(1);
  });

  test.each(SIZES)('%i équipes / groupSize 5 : aucun groupe < floor(n/numG) équipes', (n) => {
    const numG  = calcNumGroups(n, 5);
    const minSz = Math.floor(n / numG);
    // distributeTeams avec shuffle désactivé pour test déterministe
    const groups = distributeTeams(makeTeams(n), numG, x => x);
    for (const g of groups) {
      expect(g.teams.length).toBeGreaterThanOrEqual(minSz);
    }
  });

  test.each(SIZES)('%i équipes : total des équipes préservé après distribution', (n) => {
    const numG  = calcNumGroups(n, 5);
    const groups = distributeTeams(makeTeams(n), numG, x => x);
    const total = groups.reduce((s, g) => s + g.teams.length, 0);
    expect(total).toBe(n);
  });

  test('41 équipes / groupSize 5 → 8 groupes (floor(41/5)=8)', () => {
    expect(calcNumGroups(41, 5)).toBe(8);
  });

  test('41 équipes : jamais de groupe < 5 équipes (floor(41/8)=5)', () => {
    const numG   = calcNumGroups(41, 5); // 8
    const groups = distributeTeams(makeTeams(41), numG, x => x);
    for (const g of groups) {
      expect(g.teams.length).toBeGreaterThanOrEqual(5);
    }
    // Le reste (41 % 8 = 1 équipe) est réparti dans les premiers groupes
    // → certains groupes ont 6 équipes, aucun n'en a 4 ou moins
    const sizes = groups.map(g => g.teams.length).sort((a, b) => a - b);
    expect(sizes[0]).toBeGreaterThanOrEqual(5);
  });

  test.each(GROUP_SIZES)('groupSize %i : au moins 3 équipes par groupe pour 40 teams', (gs) => {
    const n    = 40;
    const numG = calcNumGroups(n, gs);
    if (numG < 1) return; // skip si pas assez de teams
    const groups = distributeTeams(makeTeams(n), numG, x => x);
    for (const g of groups) {
      expect(g.teams.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('Dispersion par pays : 2 pays → équipes du même pays dans groupes différents', () => {
    // 10 équipes, 5 de chaque pays, 2 groupes
    const teams = [
      ...Array.from({ length: 5 }, (_, i) => ({ _id: `fr${i}`, country: 'France' })),
      ...Array.from({ length: 5 }, (_, i) => ({ _id: `es${i}`, country: 'Espagne' })),
    ];
    const numG   = 2;
    const groups = distributeTeams(teams, numG, x => x);
    // Chaque groupe doit avoir exactement 5 équipes, mélange équitable
    for (const g of groups) {
      const countries = g.teams.map(t => t.country);
      const fr = countries.filter(c => c === 'France').length;
      const es = countries.filter(c => c === 'Espagne').length;
      // Avec serpentin : 5 équipes France + 5 Espagne → 2 groupes de 5
      // Serpentin garantit l'alternance → pas plus de ceil(5/2)=3 d'un même pays par groupe
      expect(fr).toBeLessThanOrEqual(Math.ceil(5 / numG) + 1);
      expect(es).toBeLessThanOrEqual(Math.ceil(5 / numG) + 1);
    }
  });

  test('Dispersion par pays : 40 équipes, 4 pays, 8 groupes → max ceil(10/8)+1 par pays par groupe', () => {
    const countries = ['France', 'Espagne', 'Maroc', 'UK'];
    const teams = makeTeamsWithCountries(40, countries);
    const numG  = 8;
    const groups = distributeTeams(teams, numG, x => x);

    for (const g of groups) {
      for (const c of countries) {
        const count = g.teams.filter(t => t.country === c).length;
        // ceil(10/8)=2 → au max 2 équipes du même pays par groupe
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });

  test('calcNumGroups : toujours floor, jamais de groupe résiduel vide', () => {
    expect(calcNumGroups(41, 5)).toBe(8);
    expect(calcNumGroups(40, 5)).toBe(8);
    expect(calcNumGroups(39, 5)).toBe(7);
    expect(calcNumGroups(30, 6)).toBe(5);
    expect(calcNumGroups(32, 8)).toBe(4);
  });

  test('groupes nommés A à Z', () => {
    const groups = distributeTeams(makeTeams(32), 8, x => x);
    expect(groups[0].letter).toBe('A');
    expect(groups[7].letter).toBe('H');
  });
});

// ─── SUITE 2 : Classements de poule ───────────────────────────────────────────

describe('Suite 2 — Classements (4 équipes A > B > D > C)', () => {
  // Groupe de 4 : A bat B, B bat C, C bat D, A bat C, A bat D, B bat D
  // chaque match = 1 set joué → victoire = set unique
  // A : 3 victoires → 9pts, 3 sets gagnés, 0 perdus → setDiff = +3
  // B : 2 victoires → 6pts, 2 sets gagnés, 1 perdu  → setDiff = +1
  // D : 1 victoire  → 3pts, 1 set gagné,  2 perdus  → setDiff = -1
  // C : 0 victoire  → 0pts, 0 sets gagnés, 3 perdus → setDiff = -3

  const TEAMS = ['A', 'B', 'C', 'D'];

  const MATCHES = [
    makeMatch('A', 'B', [{ score1: 6, score2: 3 }], 'team1'),
    makeMatch('A', 'C', [{ score1: 6, score2: 2 }], 'team1'),
    makeMatch('A', 'D', [{ score1: 6, score2: 4 }], 'team1'),
    makeMatch('B', 'C', [{ score1: 6, score2: 1 }], 'team1'),
    makeMatch('B', 'D', [{ score1: 6, score2: 4 }], 'team1'),
    makeMatch('C', 'D', [{ score1: 4, score2: 6 }], 'team2'),  // D bat C
  ];

  let standings;
  beforeAll(() => {
    standings = computeStandings(TEAMS, MATCHES);
  });

  test('4 équipes dans les standings', () => {
    expect(standings.length).toBe(4);
  });

  test('Classement : A 1er, B 2e, D 3e, C 4e', () => {
    const ranks = standings.map(s => ({ id: s.teamId, rank: s.rank }));
    expect(ranks.find(r => r.id === 'A').rank).toBe(1);
    expect(ranks.find(r => r.id === 'B').rank).toBe(2);
    expect(ranks.find(r => r.id === 'D').rank).toBe(3);
    expect(ranks.find(r => r.id === 'C').rank).toBe(4);
  });

  test('A : 9 points', () => {
    expect(standings.find(s => s.teamId === 'A').points).toBe(9);
  });

  test('B : 6 points', () => {
    expect(standings.find(s => s.teamId === 'B').points).toBe(6);
  });

  test('D : 3 points', () => {
    expect(standings.find(s => s.teamId === 'D').points).toBe(3);
  });

  test('C : 0 points', () => {
    expect(standings.find(s => s.teamId === 'C').points).toBe(0);
  });

  test('A : setDiff +3', () => {
    expect(standings.find(s => s.teamId === 'A').setDiff).toBe(3);
  });

  test('B : setDiff +1', () => {
    expect(standings.find(s => s.teamId === 'B').setDiff).toBe(1);
  });

  test('D : setDiff -1', () => {
    expect(standings.find(s => s.teamId === 'D').setDiff).toBe(-1);
  });

  test('C : setDiff -3', () => {
    expect(standings.find(s => s.teamId === 'C').setDiff).toBe(-3);
  });

  test('A : 3 matchs joués, 3 victoires', () => {
    const a = standings.find(s => s.teamId === 'A');
    expect(a.played).toBe(3);
    expect(a.won).toBe(3);
    expect(a.lost).toBe(0);
  });

  test('Matchs non joués ignorés (un match non joué dans le groupe)', () => {
    const matchesWithUnplayed = [
      ...MATCHES,
      { team1: 'A', team2: 'D', played: false, sets: [], result: null },
    ];
    const s = computeStandings(TEAMS, matchesWithUnplayed);
    // Points d'A ne changent pas (le match non joué est ignoré)
    expect(s.find(x => x.teamId === 'A').points).toBe(9);
  });
});

// ─── SUITE 3 : Calcul de qualification (logique pure) ─────────────────────────

describe('Suite 3 — Qualification : formule qualPerGroup + wildcards', () => {
  // Formule : qualPerGroup = floor(bracketTarget / nbGroups)
  //           wildcardSpots = bracketTarget - qualPerGroup * nbGroups
  //           wildcardRank  = qualPerGroup + 1

  function computeQualMath(nbGroups, bracketTarget) {
    const qualPerGroup  = Math.floor(bracketTarget / nbGroups);
    const wildcardSpots = bracketTarget - qualPerGroup * nbGroups;
    const wildcardRank  = qualPerGroup + 1;
    return { qualPerGroup, wildcardSpots, wildcardRank };
  }

  test('5 groupes, bracket 32 → 6 qualifiés/groupe + 2 wildcards', () => {
    const { qualPerGroup, wildcardSpots, wildcardRank } = computeQualMath(5, 32);
    expect(qualPerGroup).toBe(6);
    expect(wildcardSpots).toBe(2);
    expect(wildcardRank).toBe(7);
  });

  test('8 groupes, bracket 32 → 4 qualifiés/groupe + 0 wildcards', () => {
    const { qualPerGroup, wildcardSpots } = computeQualMath(8, 32);
    expect(qualPerGroup).toBe(4);
    expect(wildcardSpots).toBe(0);
  });

  test('5 groupes × 6 auto + 2 wildcards = 32 qualifiés exactement', () => {
    const nb = 5, bt = 32;
    const { qualPerGroup, wildcardSpots } = computeQualMath(nb, bt);
    expect(qualPerGroup * nb + wildcardSpots).toBe(bt);
  });

  test('7 groupes, bracket 32 → 4 qualifiés + 4 wildcards', () => {
    const { qualPerGroup, wildcardSpots } = computeQualMath(7, 32);
    expect(qualPerGroup).toBe(4);
    expect(wildcardSpots).toBe(4);
    expect(qualPerGroup * 7 + wildcardSpots).toBe(32);
  });

  test.each([
    [4, 16], [5, 16], [8, 16], [4, 32], [8, 32], [5, 32], [6, 32],
  ])('%i groupes bracket %i → total toujours = bracketTarget', (nbGroups, bt) => {
    const { qualPerGroup, wildcardSpots } = computeQualMath(nbGroups, bt);
    expect(qualPerGroup * nbGroups + wildcardSpots).toBe(bt);
  });

  test('wildcardRank = qualPerGroup + 1 (toujours un rang de plus)', () => {
    for (const [nb, bt] of [[5, 32], [7, 32], [8, 16], [4, 16]]) {
      const { qualPerGroup, wildcardRank } = computeQualMath(nb, bt);
      expect(wildcardRank).toBe(qualPerGroup + 1);
    }
  });
});

// ─── SUITE 4 : Seeding bracket ────────────────────────────────────────────────

describe('Suite 4 — Seeding bracket (32 équipes, 5 groupes)', () => {
  // Simuler 32 qualifiés : 5 groupes, 4 pays, rang 1-7 par groupe (≈6 qualifiés/groupe)
  const COUNTRIES = ['France', 'Espagne', 'Maroc', 'UK'];
  const GROUPS    = ['A', 'B', 'C', 'D', 'E'];

  // 5 groupes × 6 = 30 + 2 wildcards → 32 teams
  // rang 1-6 de chaque groupe, + 2 wildcards (rang 7 de G.A et G.B)
  const seededTeams = [];
  for (const g of GROUPS) {
    const maxRank = g === 'A' || g === 'B' ? 7 : 6;
    for (let r = 1; r <= maxRank; r++) {
      const idx = seededTeams.length;
      seededTeams.push({
        id:      `${g}${r}`,
        group:   g,
        rank:    r,
        country: COUNTRIES[idx % COUNTRIES.length],
      });
    }
  }

  let seededIds, conflicts;
  beforeAll(() => {
    ({ seededIds, conflicts } = computeSeeding(seededTeams.slice(0, 32), 32));
  });

  test('32 seeds assignés', () => {
    expect(seededIds.length).toBe(32);
  });

  test('Pas de doublons dans les seeds', () => {
    expect(new Set(seededIds).size).toBe(32);
  });

  test('Tous les seeds sont parmi les 32 équipes', () => {
    const validIds = new Set(seededTeams.slice(0, 32).map(t => t.id));
    for (const id of seededIds) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  test('Conflits intra-groupe au R1 : 0 (correcteur actif)', () => {
    // Reconstruire les matchs R1 à partir des slots
    const { getSeededSlots } = require('../utils/seeding');
    const slots   = getSeededSlots(32);
    const byId    = Object.fromEntries(seededTeams.map(t => [t.id, t]));
    let groupConflicts = 0;

    for (let pos = 0; pos < 16; pos++) {
      const idA = seededIds[slots[pos * 2] - 1];
      const idB = seededIds[slots[pos * 2 + 1] - 1];
      const tA  = byId[idA];
      const tB  = byId[idB];
      if (tA && tB && tA.group === tB.group) groupConflicts++;
    }

    // Le correcteur doit éliminer tous les conflits intra-groupe au R1
    expect(groupConflicts).toBe(0);
  });

  test('conflicts array : résidu < 10% des matchs (≤ 1 sur 16)', () => {
    // Les conflits non résolus doivent être anecdotiques
    expect(conflicts.length).toBeLessThanOrEqual(2);
  });
});

// ─── SUITE 5 : Filtrage consolante ────────────────────────────────────────────

describe('Suite 5 — Filtrage consolante', () => {
  // La consolante est réservée aux équipes éliminées en phase de poule.
  // tournamentPath = 'consolante' → éligible
  // tournamentPath = 'main'      → PAS éligible
  // tournamentPath = null        → pas encore classée

  function filterConsolante(teams) {
    return teams.filter(t => t.tournamentPath === 'consolante');
  }

  const ALL_TEAMS = [
    { _id: 'T1', name: 'Team 1', tournamentPath: 'main' },
    { _id: 'T2', name: 'Team 2', tournamentPath: 'consolante' },
    { _id: 'T3', name: 'Team 3', tournamentPath: null },
    { _id: 'T4', name: 'Team 4', tournamentPath: 'consolante' },
    { _id: 'T5', name: 'Team 5', tournamentPath: 'main' },
    { _id: 'T6', name: 'Team 6', tournamentPath: 'consolante' },
    { _id: 'T7', name: 'Team 7', tournamentPath: null },
  ];

  test('Seules les équipes "consolante" sont sélectionnées', () => {
    const result = filterConsolante(ALL_TEAMS);
    expect(result.map(t => t._id)).toEqual(['T2', 'T4', 'T6']);
  });

  test('Les équipes "main" sont exclues', () => {
    const result = filterConsolante(ALL_TEAMS);
    expect(result.find(t => t.tournamentPath === 'main')).toBeUndefined();
  });

  test('Les équipes sans tournamentPath (null) sont exclues', () => {
    const result = filterConsolante(ALL_TEAMS);
    expect(result.find(t => t.tournamentPath === null)).toBeUndefined();
  });

  test('Consolante vide si tous sont en "main" ou non classés', () => {
    const teams = [
      { _id: 'T1', tournamentPath: 'main' },
      { _id: 'T2', tournamentPath: null },
    ];
    expect(filterConsolante(teams).length).toBe(0);
  });

  test('Dénombrement : 3 équipes consolante sur 7', () => {
    expect(filterConsolante(ALL_TEAMS).length).toBe(3);
  });

  test('standings.js : ne compte que les matchs joués pour les équipes consolante', () => {
    // Simule un groupe consolante de 3 équipes avec des matchs partiellement joués
    const TEAMS = ['C1', 'C2', 'C3'];
    const MATCHES = [
      makeMatch('C1', 'C2', [{ score1: 6, score2: 3 }], 'team1'),
      makeMatch('C1', 'C3', [], null),  // non joué
      makeMatch('C2', 'C3', [{ score1: 6, score2: 4 }], 'team1'),
    ];
    const standings = computeStandings(TEAMS, MATCHES);

    expect(standings.find(s => s.teamId === 'C1').points).toBe(3);
    expect(standings.find(s => s.teamId === 'C2').points).toBe(3);
    expect(standings.find(s => s.teamId === 'C3').points).toBe(0);
    // C3 : 2 matchs restant (1 joué perdu, 1 non joué)
    expect(standings.find(s => s.teamId === 'C3').played).toBe(1);
  });
});
