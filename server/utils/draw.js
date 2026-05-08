// utils/draw.js — Logique pure de distribution des équipes en groupes.
// Exportée séparément pour être testable sans DB.
'use strict';

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Calcule le nombre de groupes à créer depuis une taille cible.
 *   numG = floor(n / groupSize)
 * Le reste (n % groupSize équipes) est distribué dans les groupes existants (+1 par groupe).
 * JAMAIS de nouveau groupe créé pour les équipes restantes.
 */
function calcNumGroups(n, groupSize) {
  return Math.floor(n / groupSize);
}

/**
 * Distribue les équipes en numG groupes avec serpentin par pays.
 *
 * Garanties :
 *  1. Aucun groupe n'a moins de floor(n/numG) équipes (reste → premiers groupes)
 *  2. Équipes du même pays dispersées dans des groupes différents
 *
 * @param {Array<{country?: string}>} teams
 * @param {number}   numG
 * @param {Function} [shuffleFn] — remplacée par x=>x dans les tests pour déterminisme
 * @returns {Array<{letter: string, teams: Array}>}
 */
function distributeTeams(teams, numG, shuffleFn = shuffle) {
  if (numG < 1) throw new Error('numG doit être ≥ 1');

  // 1. Tri par pays normalisé → équipes du même pays adjacentes
  const sorted = [...teams].sort((a, b) => {
    const ca = (a.country || '').toLowerCase().trim();
    const cb = (b.country || '').toLowerCase().trim();
    return ca.localeCompare(cb);
  });

  // 2. Serpentin : alterne la direction à chaque cycle de numG équipes.
  //    Résultat : des équipes consécutives (même pays) atterrissent dans des groupes différents.
  const buckets = Array.from({ length: numG }, () => []);
  for (let i = 0; i < sorted.length; i++) {
    const cycle = Math.floor(i / numG);
    const pos   = i % numG;
    const g     = cycle % 2 === 0 ? pos : numG - 1 - pos;
    buckets[g].push(sorted[i]);
  }

  // 3. Mélange léger à l'intérieur de chaque groupe (évite la prédictibilité)
  for (const b of buckets) shuffleFn(b);

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return buckets.map((teamList, i) => ({
    letter: LETTERS[i] || `G${i + 1}`,
    teams:  teamList,
  }));
}

/**
 * Génère les matchs round-robin organisés par rounds (algorithme de Berger).
 * Garantie : aucune équipe ne joue deux fois dans le même round.
 *
 * @param {number} n — nombre d'équipes
 * @returns {Array<Array<[number, number]>>} — tableau de rounds,
 *   chaque round étant un tableau de paires [idxA, idxB].
 *   Aplatir avec .flat() pour obtenir la liste ordonnée des matchs.
 *
 * Exemple n=4 :
 *   Round 0 : [[0,3],[1,2]]
 *   Round 1 : [[0,2],[3,1]]
 *   Round 2 : [[0,1],[2,3]]
 *
 * Pour n impair, un slot "bye" est ajouté (index n) et ignoré dans les paires.
 */
function roundRobinSchedule(n) {
  const rounds = [];
  if (n < 2) return rounds;

  const N      = n % 2 === 0 ? n : n + 1;  // slot bye si impair
  const circle = Array.from({ length: N }, (_, i) => i);

  for (let r = 0; r < N - 1; r++) {
    const round = [];
    for (let i = 0; i < N / 2; i++) {
      const a = circle[i];
      const b = circle[N - 1 - i];
      // Exclure les paires impliquant le slot bye (index n)
      if (a < n && b < n) round.push([a, b]);
    }
    if (round.length > 0) rounds.push(round);

    // Rotation de Berger : circle[0] est fixe, circle[1..N-1] tourne
    const last = circle[N - 1];
    for (let i = N - 1; i > 1; i--) circle[i] = circle[i - 1];
    circle[1] = last;
  }

  return rounds;
}

module.exports = { distributeTeams, calcNumGroups, shuffle, roundRobinSchedule };
