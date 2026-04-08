/**
 * Génération automatique des poules pour le tournoi de padel.
 * Inspiré de la logique du projet FC26 (Tournoi-FC26-main), adapté pour le padel.
 *
 * Règles :
 * - ~4 équipes par poule (équilibré)
 * - Tirage aléatoire
 * - Matchs round-robin dans chaque poule (tous vs tous)
 */

/**
 * Calcule le nombre optimal de poules en fonction du nombre d'équipes.
 * On vise ~4 équipes par poule.
 *
 * Exemples :
 *   12 équipes → 3 poules de 4
 *   14 équipes → 4 poules (3-4-4-3) ... non, 3 poules de ~4.7 → 4 poules
 *   75 équipes → 19 poules (18 de 4, 1 de 3)
 *   10 équipes → 2 poules de 5
 */
function calculateNumGroups(numTeams) {
  let numGroups = Math.ceil(numTeams / 4);

  // Si le reste est 1 ou 2, on préfère floor pour éviter des groupes trop petits
  if (numTeams > 8 && numTeams % 4 <= 2) {
    numGroups = Math.floor(numTeams / 4);
  }

  return Math.max(numGroups, 1);
}

/**
 * Mélange un tableau aléatoirement (Fisher-Yates shuffle).
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Génère les poules et tous les matchs round-robin.
 *
 * @param {string[]} teamIds - Tableau des IDs MongoDB des équipes
 * @returns {Array} - Tableau de groupes { name, teamIds, matches }
 */
function generateGroups(teamIds) {
  const numTeams = teamIds.length;
  if (numTeams < 2) throw new Error('Il faut au moins 2 équipes pour générer des poules');

  const numGroups = calculateNumGroups(numTeams);

  // Mélange aléatoire des équipes
  const shuffled = shuffle(teamIds);

  // Distribution équilibrée : certains groupes ont 1 équipe de plus
  const baseSize = Math.floor(numTeams / numGroups);
  const remainder = numTeams % numGroups;

  const groups = [];
  let index = 0;

  for (let i = 0; i < numGroups; i++) {
    const size = i < remainder ? baseSize + 1 : baseSize;
    const groupTeams = shuffled.slice(index, index + size);
    index += size;

    // Générer tous les matchs round-robin (chaque équipe joue contre toutes les autres)
    const matches = [];
    for (let a = 0; a < groupTeams.length; a++) {
      for (let b = a + 1; b < groupTeams.length; b++) {
        matches.push({
          team1Id: groupTeams[a],
          team2Id: groupTeams[b],
          sets: [],
          winnerId: null,
          played: false,
        });
      }
    }

    groups.push({
      name: String.fromCharCode(65 + i), // A, B, C, D...
      teamIds: groupTeams,
      matches,
    });
  }

  return groups;
}

/**
 * Calcule le classement dans un groupe à partir des matchs joués.
 * Système padel : victoire = 3pts, défaite = 0pts (pas de nul en padel avec tiebreak)
 * Critères de départage : 1) points, 2) sets gagnés, 3) sets encaissés
 *
 * @param {Object} group - Le groupe avec ses matchs
 * @param {Map} teamMap - Map<teamId, teamObject> pour accéder aux noms
 * @returns {Array} - Équipes triées par classement
 */
function calculateGroupStandings(group, teamMap) {
  // Initialiser les stats
  const stats = {};
  for (const teamId of group.teamIds) {
    stats[teamId.toString()] = {
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      points: 0,
    };
  }

  // Calculer les stats depuis les matchs joués
  for (const match of group.matches) {
    if (!match.played || !match.winnerId) continue;

    const id1 = match.team1Id.toString();
    const id2 = match.team2Id.toString();
    const winnerId = match.winnerId.toString();

    // Compter les sets gagnés par chaque équipe
    let setsWon1 = 0;
    let setsWon2 = 0;
    for (const set of match.sets) {
      if (set.score1 > set.score2) setsWon1++;
      else if (set.score2 > set.score1) setsWon2++;
    }

    if (stats[id1]) {
      stats[id1].played++;
      stats[id1].setsFor += setsWon1;
      stats[id1].setsAgainst += setsWon2;
      if (winnerId === id1) { stats[id1].won++; stats[id1].points += 3; }
      else { stats[id1].lost++; }
    }
    if (stats[id2]) {
      stats[id2].played++;
      stats[id2].setsFor += setsWon2;
      stats[id2].setsAgainst += setsWon1;
      if (winnerId === id2) { stats[id2].won++; stats[id2].points += 3; }
      else { stats[id2].lost++; }
    }
  }

  // Trier : points → différence de sets → sets marqués
  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.setsFor - a.setsAgainst;
    const diffB = b.setsFor - b.setsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.setsFor - a.setsFor;
  });
}

module.exports = { generateGroups, calculateGroupStandings, calculateNumGroups };
