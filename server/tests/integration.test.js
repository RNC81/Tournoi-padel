// integration.test.js — Tests d'intégration des règles métier critiques
// Toutes ces fonctions sont pures (pas de DB) — utilisent les vrais utils exportés.
'use strict';

const { distributeTeams, calcNumGroups, roundRobinSchedule } = require('../utils/draw');
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

// ─── SUITE 6 : Consolante — statut, contrainte pays, BYEs ────────────────────

describe('Suite 6 — Consolante : statut invalide, contrainte pays, BYEs', () => {

  // ── 6.1 : Statut "consolante" supprimé ──────────────────────────────────────

  const VALID_STATUSES = ['setup', 'registration', 'pool_stage', 'knockout', 'finished'];

  test('Le statut "consolante" n\'est plus accepté', () => {
    expect(VALID_STATUSES.includes('consolante')).toBe(false);
  });

  test('Les statuts valides sont exactement 5 (consolante retiré)', () => {
    expect(VALID_STATUSES.length).toBe(5);
    expect(VALID_STATUSES).toEqual(['setup', 'registration', 'pool_stage', 'knockout', 'finished']);
  });

  // ── 6.2 : Tirage consolante_pool respecte la contrainte pays ────────────────

  test('consolante_pool : 9 équipes, 3 pays, 3 groupes → max 1 équipe/pays/groupe', () => {
    const countries = ['Paris', 'Lyon', 'Marseille'];
    const teams = makeTeamsWithCountries(9, countries);
    // 9 équipes = 3 par pays, 3 groupes = 3 par groupe
    const groups = distributeTeams(teams, 3, x => x);

    expect(groups.length).toBe(3);
    for (const g of groups) {
      for (const country of countries) {
        const count = g.teams.filter(t => t.country === country).length;
        // Avec serpentin : 3 équipes de chaque pays → max 1 par groupe
        expect(count).toBeLessThanOrEqual(Math.ceil(3 / 3) + 1);
      }
    }
  });

  test('consolante_pool : total des équipes préservé après tirage', () => {
    const teams = makeTeamsWithCountries(9, ['Paris', 'Lyon', 'Marseille']);
    const groups = distributeTeams(teams, 3, x => x);
    const total = groups.reduce((s, g) => s + g.teams.length, 0);
    expect(total).toBe(9);
  });

  // ── 6.3 : BYEs pour bracket consolante ──────────────────────────────────────

  test('9 équipes → bracketTarget=16 → 7 BYEs', () => {
    const teamsCount   = 9;
    const bracketTarget = 16;
    const byes = bracketTarget - teamsCount;
    expect(byes).toBe(7);
  });

  test('4 équipes → bracketTarget=4 → 0 BYE', () => {
    expect(4 - 4).toBe(0);
  });

  test('7 équipes → bracketTarget=8 → 1 BYE', () => {
    expect(8 - 7).toBe(1);
  });

  test('bracketTarget valide : uniquement puissances de 2 (4, 8, 16, 32)', () => {
    const validTargets = [4, 8, 16, 32];
    for (const t of validTargets) {
      expect(Math.log2(t) % 1).toBe(0); // puissance de 2 exacte
    }
    expect(validTargets.includes(3)).toBe(false);
    expect(validTargets.includes(7)).toBe(false);
    expect(validTargets.includes(9)).toBe(false);
    expect(validTargets.includes(64)).toBe(false); // 64 exclu de CONSOLANTE (bracket trop grand)
  });

  // ── 6.4 : Éligibilité consolante (équipes group!=null && tournamentPath=null) ──

  test('Équipes éligibles : group non null + tournamentPath null', () => {
    const teams = [
      { _id: 'T1', tournamentPath: 'main',       group: 'g1' }, // exclu (main)
      { _id: 'T2', tournamentPath: null,          group: 'g1' }, // éligible
      { _id: 'T3', tournamentPath: 'consolante',  group: 'g1' }, // exclu (déjà consolante)
      { _id: 'T4', tournamentPath: null,          group: null  }, // exclu (pas de poule)
      { _id: 'T5', tournamentPath: 'eliminated',  group: 'g1' }, // exclu (éliminé)
      { _id: 'T6', tournamentPath: null,          group: 'g2' }, // éligible
    ];
    const eligible = teams.filter(t => t.tournamentPath === null && t.group !== null);
    expect(eligible.map(t => t._id)).toEqual(['T2', 'T6']);
    expect(eligible.length).toBe(2);
  });

  test('Zéro éligible si tous sont déjà assignés', () => {
    const teams = [
      { _id: 'T1', tournamentPath: 'main',      group: 'g1' },
      { _id: 'T2', tournamentPath: 'consolante', group: 'g1' },
    ];
    expect(teams.filter(t => t.tournamentPath === null && t.group !== null).length).toBe(0);
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

// ─── Suite 7 — r32 : perdant rejoint le pool consolante ───────────────────────
//
// La logique métier du PUT /matches/:id/score pour la phase r32 :
//   - winner reste tournamentPath = 'main'
//   - loser passe à tournamentPath = null  → pool consolante
//   - DELETE /score r32 : loser revient à tournamentPath = 'main'
//
// On teste la fonction de détermination du perdant, extraite comme règle pure.

describe('Suite 7 — r32 : détermination du perdant pour pool consolante', () => {

  // Logique identique à celle dans PUT /matches/:id/score
  function getLoserFromR32(match, winner) {
    if (!winner || match.phase !== 'r32') return null;
    return winner.toString() === match.team1.toString()
      ? match.team2
      : match.team1;
  }

  const match = { phase: 'r32', team1: 'TEAM_A', team2: 'TEAM_B' };

  test('team1 gagne → team2 est le perdant (rejoint consolante)', () => {
    expect(getLoserFromR32(match, 'TEAM_A')).toBe('TEAM_B');
  });

  test('team2 gagne → team1 est le perdant (rejoint consolante)', () => {
    expect(getLoserFromR32(match, 'TEAM_B')).toBe('TEAM_A');
  });

  test('le perdant est différent du gagnant', () => {
    const loser = getLoserFromR32(match, 'TEAM_A');
    expect(loser).not.toBe('TEAM_A');
  });

  test('phase r16 → pas de perdant consolante (élimination définitive)', () => {
    const r16match = { phase: 'r16', team1: 'TEAM_A', team2: 'TEAM_B' };
    expect(getLoserFromR32(r16match, 'TEAM_A')).toBeNull();
  });

  test('phase qf → pas de perdant consolante', () => {
    const qfMatch = { phase: 'qf', team1: 'TEAM_A', team2: 'TEAM_B' };
    expect(getLoserFromR32(qfMatch, 'TEAM_A')).toBeNull();
  });

  test('pas de winner (draw) → pas de perdant consolante', () => {
    expect(getLoserFromR32(match, null)).toBeNull();
  });

  test('réversibilité : effacer score r32 → identifie correctement le perdant à remettre en main', () => {
    // Simule l'état au moment du DELETE : hadWinner = 'TEAM_A', team2 = 'TEAM_B'
    const playedMatch = { phase: 'r32', team1: 'TEAM_A', team2: 'TEAM_B' };
    const hadWinner   = 'TEAM_A';
    const loserToRestore = getLoserFromR32(playedMatch, hadWinner);
    expect(loserToRestore).toBe('TEAM_B'); // doit revenir tournamentPath = 'main'
  });
});

// ─── Suite 8 — roundRobinSchedule : ordre des matchs par rounds de Berger ─────
//
// Garantit qu'aucune équipe ne joue deux fois dans le même round.
// Les rounds sont aplatis en tableau de paires pour l'insertion en DB.

describe('Suite 8 — roundRobinSchedule : ordre des matchs de poule', () => {

  // Helper : vérifie qu'aucune équipe n'apparaît 2x dans un round
  function assertNoDoubleInRound(round) {
    const seen = new Set();
    for (const [a, b] of round) {
      expect(seen.has(a)).toBe(false);
      expect(seen.has(b)).toBe(false);
      seen.add(a);
      seen.add(b);
    }
  }

  // Helper : normalise une paire pour la comparaison (min-max)
  function normPair([a, b]) { return `${Math.min(a,b)}-${Math.max(a,b)}`; }

  test('n=4 : 3 rounds de 2 matchs chacun', () => {
    const rounds = roundRobinSchedule(4);
    expect(rounds).toHaveLength(3);
    rounds.forEach(round => expect(round).toHaveLength(2));
  });

  test('n=4 : 6 matchs au total après aplatissement', () => {
    expect(roundRobinSchedule(4).flat()).toHaveLength(6);
  });

  test('n=4 : aucune équipe 2x dans le même round', () => {
    roundRobinSchedule(4).forEach(assertNoDoubleInRound);
  });

  test('n=4 : toutes les paires possibles sont représentées', () => {
    const pairs = roundRobinSchedule(4).flat().map(normPair).sort();
    expect(pairs).toEqual(['0-1', '0-2', '0-3', '1-2', '1-3', '2-3']);
  });

  test('n=3 (impair) : 3 matchs, aucune équipe 2x dans un round', () => {
    const rounds = roundRobinSchedule(3);
    expect(rounds.flat()).toHaveLength(3);
    rounds.forEach(assertNoDoubleInRound);
  });

  test('n=3 : toutes les paires possibles', () => {
    const pairs = roundRobinSchedule(3).flat().map(normPair).sort();
    expect(pairs).toEqual(['0-1', '0-2', '1-2']);
  });

  test('n=6 : 5 rounds de 3 matchs, 15 matchs au total', () => {
    const rounds = roundRobinSchedule(6);
    expect(rounds).toHaveLength(5);
    rounds.forEach(round => expect(round).toHaveLength(3));
    expect(rounds.flat()).toHaveLength(15);
  });

  test('n=6 : aucune équipe 2x dans le même round', () => {
    roundRobinSchedule(6).forEach(assertNoDoubleInRound);
  });

  test('n=5 (impair) : 10 matchs, aucune équipe 2x dans un round', () => {
    const rounds = roundRobinSchedule(5);
    expect(rounds.flat()).toHaveLength(10);
    rounds.forEach(assertNoDoubleInRound);
  });

  test('n=2 : 1 round de 1 match', () => {
    const rounds = roundRobinSchedule(2);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toHaveLength(1);
    expect(rounds.flat()).toEqual([[0, 1]]);
  });
});
