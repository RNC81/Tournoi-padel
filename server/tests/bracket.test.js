// bracket.test.js — Tests unitaires pour les helpers du bracket (fonctions pures)
// Pas besoin de DB pour getBracketSize et getSeededSlots.

// On extrait les fonctions pures depuis le fichier bracket.js en les dupliquant ici,
// car elles ne sont pas exportées séparément. Alternative : les exporter dans un utils/bracket.js.

// ─── Fonctions extraites (copie exacte depuis routes/bracket.js) ───────────────

function getBracketSize(n) {
  if (n <= 4)  return 4;
  if (n <= 8)  return 8;
  if (n <= 16) return 16;
  return 32;
}

function getSeededSlots(size) {
  let slots = [1, 2];
  while (slots.length < size) {
    const n = slots.length * 2 + 1;
    slots = slots.flatMap(s => [s, n - s]);
  }
  return slots;
}

// ─── getBracketSize ────────────────────────────────────────────────────────────

describe('getBracketSize', () => {
  test('4 équipes → bracket 4', () => expect(getBracketSize(4)).toBe(4));
  test('3 équipes → bracket 4', () => expect(getBracketSize(3)).toBe(4));
  test('5 équipes → bracket 8', () => expect(getBracketSize(5)).toBe(8));
  test('8 équipes → bracket 8', () => expect(getBracketSize(8)).toBe(8));
  test('9 équipes → bracket 16', () => expect(getBracketSize(9)).toBe(16));
  test('16 équipes → bracket 16', () => expect(getBracketSize(16)).toBe(16));
  test('17 équipes → bracket 32', () => expect(getBracketSize(17)).toBe(32));
  test('32 équipes → bracket 32', () => expect(getBracketSize(32)).toBe(32));

  // Cas réaliste du tournoi (16 groupes × 2 qualifiés = 32 équipes)
  test('32 qualifiés → bracket 32', () => expect(getBracketSize(32)).toBe(32));

  // Cas avec wildcards (ex: 20 qualifiés)
  test('20 qualifiés → bracket 32', () => expect(getBracketSize(20)).toBe(32));
});

// ─── getSeededSlots ────────────────────────────────────────────────────────────

describe('getSeededSlots', () => {
  test('bracket 4 → 4 slots', () => {
    const slots = getSeededSlots(4);
    expect(slots.length).toBe(4);
  });

  test('bracket 8 → 8 slots', () => {
    const slots = getSeededSlots(8);
    expect(slots.length).toBe(8);
  });

  test('bracket 16 → 16 slots', () => {
    const slots = getSeededSlots(16);
    expect(slots.length).toBe(16);
  });

  test('bracket 32 → 32 slots', () => {
    const slots = getSeededSlots(32);
    expect(slots.length).toBe(32);
  });

  test('chaque slot est unique', () => {
    const slots = getSeededSlots(8);
    const unique = new Set(slots);
    expect(unique.size).toBe(8);
  });

  test('tous les seeds de 1 à N sont présents', () => {
    const size  = 16;
    const slots = getSeededSlots(size);
    for (let i = 1; i <= size; i++) {
      expect(slots).toContain(i);
    }
  });

  test('seed 1 et seed max sont dans le même demi-bracket (positions 0 et 1 du tableau)', () => {
    // Dans un bracket classique, seed 1 et seed size ne peuvent pas se rencontrer avant la finale
    // Le slot[0] = seed 1, le slot[1] = seed size (adversaire potentiel en finale seulement si bracket size=2)
    const slots = getSeededSlots(4);
    // Pour size=4 : slots = [1,4,3,2] → match1=(1 vs 4), match2=(3 vs 2)
    expect(slots[0]).toBe(1);
    expect(slots[1]).toBe(4);
  });

  test('bracket 8 : seed 1 affronte seed 8 en quart (position 1)', () => {
    const slots = getSeededSlots(8);
    // Les 2 premiers slots forment le match de position 1
    expect(slots[0]).toBe(1);
    expect(slots[1]).toBe(8);
  });
});

// ─── Nombre de matchs par phase ────────────────────────────────────────────────

describe('Nombre de matchs par taille de bracket', () => {
  // Un bracket de size N a N/2 matchs au premier round, N/4 au second, etc.
  // Total = N - 1 matchs pour le bracket principal

  function totalMatches(n) {
    return n - 1;
  }

  test('bracket 4 → 3 matchs', () => expect(totalMatches(4)).toBe(3));
  test('bracket 8 → 7 matchs', () => expect(totalMatches(8)).toBe(7));
  test('bracket 16 → 15 matchs', () => expect(totalMatches(16)).toBe(15));
  test('bracket 32 → 31 matchs', () => expect(totalMatches(32)).toBe(31));
});

// ─── Calcul des BYEs ──────────────────────────────────────────────────────────

describe('Calcul des BYEs', () => {
  // Les BYEs = slots qui dépassent le nombre d'équipes réelles
  function countByes(numTeams) {
    const size = getBracketSize(numTeams);
    return size - numTeams;
  }

  test('8 équipes dans bracket 8 → 0 BYE', () => expect(countByes(8)).toBe(0));
  test('5 équipes dans bracket 8 → 3 BYEs', () => expect(countByes(5)).toBe(3));
  test('16 équipes dans bracket 16 → 0 BYE', () => expect(countByes(16)).toBe(0));
  test('17 équipes dans bracket 32 → 15 BYEs', () => expect(countByes(17)).toBe(15));

  // Cas réaliste : 20 équipes qualifiées (ex: 10 groupes × 2)
  test('20 équipes → 12 BYEs (bracket 32)', () => expect(countByes(20)).toBe(12));
});

// ─── computeSeeding ────────────────────────────────────────────────────────────

const { computeSeeding, getSeededSlots: getSlots } = require('../utils/seeding');

// Construit 32 équipes simulant 5 poules (A×9, B×9, C×9, D×9, E×5) + 3 wildcards
// même logique que computeQualification avec bracketTarget=32
function makeQualifiedTeams(countryOverrides = {}) {
  const teams = [];
  const groupSizes = { A: 9, B: 9, C: 9, D: 9, E: 5 };

  // Auto-qualifiés : 6 par groupe A-D, 5 depuis E
  for (const [g, size] of Object.entries(groupSizes)) {
    const maxQual = g === 'E' ? 5 : 6;
    for (let rank = 1; rank <= maxQual; rank++) {
      const id = `${g}${rank}`;
      teams.push({
        id,
        group: g,
        rank,
        country: countryOverrides[id] || `pays-${g}-${rank}`,
      });
    }
  }

  // 3 wildcards : 7e place de A, B, C (rang 8 dans le tri global)
  for (const [i, g] of ['A', 'B', 'C'].entries()) {
    const id = `${g}WC`;
    teams.push({ id, group: g, rank: 8 + i, country: countryOverrides[id] || `pays-wc-${g}` });
  }

  return teams; // 6+6+6+6+5 + 3 = 32
}

describe('computeSeeding — propriétés de base', () => {
  test('retourne exactement bracketSize IDs', () => {
    const teams = makeQualifiedTeams();
    const { seededIds } = computeSeeding(teams, 32);
    expect(seededIds.length).toBe(32);
  });

  test('tous les IDs sont uniques', () => {
    const teams = makeQualifiedTeams();
    const { seededIds } = computeSeeding(teams, 32);
    expect(new Set(seededIds).size).toBe(32);
  });

  test('tous les IDs proviennent de l\'entrée', () => {
    const teams = makeQualifiedTeams();
    const inputIds = new Set(teams.map(t => t.id));
    const { seededIds } = computeSeeding(teams, 32);
    for (const id of seededIds) {
      expect(inputIds.has(id)).toBe(true);
    }
  });

  test('0 conflit quand les pays sont tous différents', () => {
    const teams = makeQualifiedTeams(); // pays uniques par défaut
    const { conflicts } = computeSeeding(teams, 32);
    expect(conflicts.length).toBe(0);
  });
});

describe('computeSeeding — contrainte groupe au R1', () => {
  function firstRoundConflicts(seededIds, teams, bracketSize) {
    const slots  = getSlots(bracketSize);
    const byId   = Object.fromEntries(teams.map(t => [t.id, t]));
    const bad    = [];
    for (let pos = 1; pos <= bracketSize / 2; pos++) {
      const iA = slots[(pos - 1) * 2]     - 1;
      const iB = slots[(pos - 1) * 2 + 1] - 1;
      const tA = byId[seededIds[iA]];
      const tB = byId[seededIds[iB]];
      if (tA && tB && tA.group === tB.group) bad.push([tA.id, tB.id]);
    }
    return bad;
  }

  test('0 match R1 intra-groupe avec pays tous différents', () => {
    const teams = makeQualifiedTeams();
    const { seededIds } = computeSeeding(teams, 32);
    const bad = firstRoundConflicts(seededIds, teams, 32);
    expect(bad).toHaveLength(0);
  });

  test('fonctionne aussi pour bracket 16', () => {
    // 4 groupes × 4 qualifiés = 16
    const teams = [];
    for (const g of ['A', 'B', 'C', 'D']) {
      for (let rank = 1; rank <= 4; rank++) {
        teams.push({ id: `${g}${rank}`, group: g, rank, country: `pays-${g}-${rank}` });
      }
    }
    const { seededIds, conflicts } = computeSeeding(teams, 16);
    expect(seededIds.length).toBe(16);
    expect(conflicts.length).toBe(0);
    const bad = firstRoundConflicts(seededIds, teams, 16);
    expect(bad).toHaveLength(0);
  });
});

describe('computeSeeding — contrainte pays au R1', () => {
  test('conflits pays résolus quand possible', () => {
    // Même pays pour A1 et A-WC → ils ne doivent pas se retrouver en R1
    const overrides = { A1: 'France', AWC: 'France' };
    const teams = makeQualifiedTeams(overrides);
    const { seededIds, conflicts } = computeSeeding(teams, 32);
    const slots = getSlots(32);
    const byId  = Object.fromEntries(teams.map(t => [t.id, t]));

    // Vérifier que A1 et AWC ne sont pas en face à face
    const a1Seed  = seededIds.indexOf('A1');
    const awcSeed = seededIds.indexOf('AWC');
    let areOpponents = false;
    for (let pos = 1; pos <= 16; pos++) {
      const iA = slots[(pos - 1) * 2]     - 1;
      const iB = slots[(pos - 1) * 2 + 1] - 1;
      if ((iA === a1Seed && iB === awcSeed) || (iA === awcSeed && iB === a1Seed)) {
        areOpponents = true;
      }
    }
    expect(areOpponents).toBe(false);
  });

  test('génère quand même si conflit pays inévitable, et le log', () => {
    // Tous dans le même pays → conflits inévitables mais génération non bloquée
    const overrides = {};
    const teams = makeQualifiedTeams();
    const sameCountry = teams.map(t => ({ ...t, country: 'France' }));
    const { seededIds, conflicts } = computeSeeding(sameCountry, 32);
    expect(seededIds.length).toBe(32); // génération non bloquée
    // Des conflits sont attendus mais <= nombre de matchs R1
    expect(conflicts.length).toBeLessThanOrEqual(16);
  });
});
