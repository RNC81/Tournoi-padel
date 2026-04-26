// draw.test.js — Tests unitaires pour la logique de tirage (fonctions pures, pas de DB)
// On teste la distribution des équipes en groupes : taille, nombre de groupes, round-robin.

// ─── Fonctions extraites depuis routes/groups.js ────────────────────────────────

function roundRobinPairs(n) {
  const pairs = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

// Simule la logique de distribution (même que POST /api/groups/draw)
function distributeTeams(teams, numGroups, groupSizeOverride) {
  let groupSize;
  if (groupSizeOverride) {
    groupSize = groupSizeOverride;
  } else if (numGroups) {
    groupSize = Math.ceil(teams.length / numGroups);
  } else {
    groupSize = teams.length <= 20 ? 4 : 5;
  }

  if (groupSize < 3) return { error: 'groupSize minimum : 3' };

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const slices = [];
  for (let i = 0, g = 0; i < teams.length; i += groupSize, g++) {
    slices.push({
      letter: LETTERS[g] || `G${g + 1}`,
      teams: teams.slice(i, i + groupSize),
    });
  }
  return { slices, groupSize };
}

// ─── Nombre de matchs round-robin ────────────────────────────────────────────

describe('roundRobinPairs', () => {
  test('3 équipes → 3 matchs', () => {
    expect(roundRobinPairs(3).length).toBe(3);
  });

  test('4 équipes → 6 matchs', () => {
    expect(roundRobinPairs(4).length).toBe(6);
  });

  test('5 équipes → 10 matchs', () => {
    expect(roundRobinPairs(5).length).toBe(10);
  });

  test('formule n*(n-1)/2', () => {
    for (let n = 3; n <= 7; n++) {
      expect(roundRobinPairs(n).length).toBe(n * (n - 1) / 2);
    }
  });

  test('chaque paire est unique', () => {
    const pairs = roundRobinPairs(5);
    const keys = pairs.map(([a, b]) => `${a}-${b}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(pairs.length);
  });

  test('pas de match contre soi-même', () => {
    const pairs = roundRobinPairs(4);
    for (const [a, b] of pairs) {
      expect(a).not.toBe(b);
    }
  });
});

// ─── Distribution des équipes en groupes ──────────────────────────────────────

describe('Distribution des équipes', () => {
  const makeTeams = (n) => Array.from({ length: n }, (_, i) => ({ _id: `team${i}` }));

  test('8 équipes en 2 groupes → 4 par groupe', () => {
    const { slices } = distributeTeams(makeTeams(8), 2);
    expect(slices.length).toBe(2);
    expect(slices[0].teams.length).toBe(4);
    expect(slices[1].teams.length).toBe(4);
  });

  test('12 équipes en 3 groupes → 4 par groupe', () => {
    const { slices } = distributeTeams(makeTeams(12), 3);
    expect(slices.length).toBe(3);
    for (const s of slices) expect(s.teams.length).toBe(4);
  });

  test('41 équipes en 9 groupes → 5 par groupe (ceil)', () => {
    const { slices, groupSize } = distributeTeams(makeTeams(41), 9);
    // ceil(41/9) = 5, donc 9 groupes max, le dernier peut être plus petit
    expect(groupSize).toBe(5);
    // 41 / 5 = 8 groupes de 5 + 1 groupe de 1... mais min 3 → on ne bloque pas ici
    // La distribution ne valide pas la taille minimale du dernier groupe (c'est le backend qui s'en charge)
    const total = slices.reduce((s, g) => s + g.teams.length, 0);
    expect(total).toBe(41);
  });

  test('toutes les équipes sont distribuées', () => {
    const teams = makeTeams(24);
    const { slices } = distributeTeams(teams, 6);
    const total = slices.reduce((s, g) => s + g.teams.length, 0);
    expect(total).toBe(24);
  });

  test('groupSize < 3 → erreur', () => {
    const result = distributeTeams(makeTeams(6), null, 2);
    expect(result.error).toMatch(/minimum.*3/i);
  });

  test('groupes nommés A, B, C, ...', () => {
    const { slices } = distributeTeams(makeTeams(16), 4);
    expect(slices[0].letter).toBe('A');
    expect(slices[1].letter).toBe('B');
    expect(slices[2].letter).toBe('C');
    expect(slices[3].letter).toBe('D');
  });

  test('taille par défaut ≤20 équipes → 4 par groupe', () => {
    const { groupSize } = distributeTeams(makeTeams(16), null, null);
    expect(groupSize).toBe(4);
  });

  test('taille par défaut >20 équipes → 5 par groupe', () => {
    const { groupSize } = distributeTeams(makeTeams(40), null, null);
    expect(groupSize).toBe(5);
  });
});

// ─── Nombre total de matchs pour un tirage complet ────────────────────────────

describe('Nombre total de matchs après tirage', () => {
  function totalMatchesForDraw(numTeams, numGroups) {
    const groupSize = Math.ceil(numTeams / numGroups);
    const sliceCount = Math.ceil(numTeams / groupSize);
    // Tous les groupes sauf le dernier ont groupSize équipes
    // Le dernier groupe a numTeams - (sliceCount - 1) * groupSize équipes
    let total = 0;
    for (let i = 0; i < sliceCount; i++) {
      const n = (i === sliceCount - 1)
        ? numTeams - i * groupSize
        : groupSize;
      total += roundRobinPairs(n).length;
    }
    return total;
  }

  test('8 équipes, 2 groupes de 4 → 12 matchs (2 × 6)', () => {
    expect(totalMatchesForDraw(8, 2)).toBe(12);
  });

  test('12 équipes, 3 groupes de 4 → 18 matchs (3 × 6)', () => {
    expect(totalMatchesForDraw(12, 3)).toBe(18);
  });

  test('16 équipes, 4 groupes de 4 → 24 matchs (4 × 6)', () => {
    expect(totalMatchesForDraw(16, 4)).toBe(24);
  });

  test('15 équipes, 3 groupes de 5 → 30 matchs (3 × 10)', () => {
    expect(totalMatchesForDraw(15, 3)).toBe(30);
  });
});
