// utils/seeding.js
// Calcule l'ordre optimal des seeds pour le bracket.
//
// Contrainte 1 : distribution snake par quart → même groupe jamais opposé au R1 si possible
// Contrainte 2 : correcteur swap pour conflits intra-groupe ET intra-pays au R1
// Jamais bloquant : conflits résiduels retournés dans `conflicts`.

'use strict';

// Même algo que routes/bracket.js (dupliqué pour éviter la dépendance circulaire)
function getSeededSlots(size) {
  let slots = [1, 2];
  while (slots.length < size) {
    const n = slots.length * 2 + 1;
    slots = slots.flatMap(s => [s, n - s]);
  }
  return slots;
}

// Indices (0-based) dans seededTeams appartenant à chaque quart (0-3).
// Un quart = bracketSize/8 matchs consécutifs du premier tour.
function quarterIndices(bracketSize, slots) {
  const matchesPerQ = (bracketSize / 2) / 4;
  const result = [[], [], [], []];
  for (let pos = 1; pos <= bracketSize / 2; pos++) {
    const q = Math.floor((pos - 1) / matchesPerQ);
    result[q].push(slots[(pos - 1) * 2]     - 1);  // seed fort
    result[q].push(slots[(pos - 1) * 2 + 1] - 1);  // seed faible
  }
  for (const arr of result) arr.sort((a, b) => a - b);
  return result;
}

function hasConflict(a, b) {
  if (!a || !b) return false;
  if (a.group && b.group && a.group === b.group) return true;
  const ca = a.country?.toLowerCase().trim();
  const cb = b.country?.toLowerCase().trim();
  return !!(ca && cb && ca === cb);
}

function conflictReason(a, b) {
  if (a?.group && a.group === b?.group) return `même poule (${a.group})`;
  return `même pays (${a?.country})`;
}

/**
 * computeSeeding — calcule l'ordre des seeds pour le bracket.
 *
 * @param {Array<{id:string, group:string, rank:number, country:string}>} teams
 * @param {number} bracketSize  — 8 | 16 | 32 | 64
 * @returns {{ seededIds: string[], conflicts: string[] }}
 */
function computeSeeding(teams, bracketSize) {
  const slots = getSeededSlots(bracketSize);
  const qIdxs = quarterIndices(bracketSize, slots);

  // ── 1. Tri tier-interleaved : 1er de chaque groupe, puis 2e, etc. ────────────
  const sorted = [...teams].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (a.group || '').localeCompare(b.group || '');
  });

  // ── 2. Distribution en serpentin dans les 4 quarts ──────────────────────────
  // Pattern : Q0, Q1, Q2, Q3, Q3, Q2, Q1, Q0, Q0, Q1, ...
  const buckets = [[], [], [], []];
  let q = 0, dir = 1;
  for (const team of sorted) {
    buckets[q].push(team);
    if      (q === 3 && dir === 1)  dir = -1;
    else if (q === 0 && dir === -1) dir = 1;
    else                            q  += dir;
  }

  // ── 3. Assignation des positions de seed par quart ───────────────────────────
  const seededIds = new Array(bracketSize).fill(null);
  for (let qi = 0; qi < 4; qi++) {
    const positions = qIdxs[qi];
    const bucket    = buckets[qi];
    for (let i = 0; i < bucket.length && i < positions.length; i++) {
      seededIds[positions[i]] = bucket[i].id;
    }
  }

  // ── 4. Correcteur : swap pour résoudre les conflits R1 ──────────────────────
  const byId    = Object.fromEntries(teams.map(t => [t.id, t]));
  const n       = bracketSize / 2;   // matchs au premier tour
  const qM      = n / 4;             // matchs par quart
  const conflicts = [];

  for (let pos = 1; pos <= n; pos++) {
    const iA = slots[(pos - 1) * 2]     - 1;
    const iB = slots[(pos - 1) * 2 + 1] - 1;
    const tA = byId[seededIds[iA]];
    const tB = byId[seededIds[iB]];

    if (!hasConflict(tA, tB)) continue;

    // Chercher un swap dans le même quart
    const qStart = Math.floor((pos - 1) / qM) * qM + 1;
    const qEnd   = qStart + qM - 1;
    let swapped  = false;

    for (let other = qStart; other <= qEnd && !swapped; other++) {
      if (other === pos) continue;

      const oA_idx = slots[(other - 1) * 2]     - 1;
      const oB_idx = slots[(other - 1) * 2 + 1] - 1;
      const oA = byId[seededIds[oA_idx]];
      const oB = byId[seededIds[oB_idx]];

      // Swap iB ↔ oB : nouveaux matchs → (tA vs oB) et (oA vs tB)
      if (!hasConflict(tA, oB) && !hasConflict(oA, tB)) {
        [seededIds[iB], seededIds[oB_idx]] = [seededIds[oB_idx], seededIds[iB]];
        swapped = true;
        break;
      }
    }

    // Si pas de swap dans le même quart, essayer dans tout le bracket
    if (!swapped) {
      for (let other = 1; other <= n && !swapped; other++) {
        if (other === pos) continue;
        const oB_idx = slots[(other - 1) * 2 + 1] - 1;
        const oA_idx = slots[(other - 1) * 2]     - 1;
        const oA = byId[seededIds[oA_idx]];
        const oB = byId[seededIds[oB_idx]];
        if (!hasConflict(tA, oB) && !hasConflict(oA, tB)) {
          [seededIds[iB], seededIds[oB_idx]] = [seededIds[oB_idx], seededIds[iB]];
          swapped = true;
        }
      }
    }

    if (!swapped) {
      conflicts.push(`R1 pos ${pos} : ${conflictReason(tA, tB)} (non résolu)`);
    }
  }

  return { seededIds: seededIds.filter(Boolean), conflicts };
}

module.exports = { computeSeeding, getSeededSlots };
