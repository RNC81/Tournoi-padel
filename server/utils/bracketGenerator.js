/**
 * Génération du bracket d'élimination directe.
 * Logique adaptée du projet FC26 pour le padel.
 *
 * Règle option C :
 *   < 40 équipes qualifiées → bracket de 16
 *   ≥ 40 équipes qualifiées → bracket de 32
 *
 * En pratique, ce sont les équipes qualifiées (top N des poules),
 * pas le total des équipes inscrites, qui déterminent la taille du bracket.
 *
 * La même fonction sert pour le bracket consolante.
 */

/**
 * Calcule la taille cible du bracket (prochaine puissance de 2).
 * Basé sur le nombre TOTAL d'équipes inscrites.
 *
 * < 40 équipes → 16 qualifiés pour le bracket principal
 * ≥ 40 équipes → 32 qualifiés pour le bracket principal
 */
function calculateBracketSize(totalTeams) {
  if (totalTeams < 40) return 16;
  return 32;
}

/**
 * Détermine combien d'équipes qualifient pour le bracket principal
 * et lesquelles vont en consolante.
 *
 * Stratégie :
 *   - Bracket de 16 : on prend les 16 meilleures équipes de poule
 *   - Bracket de 32 : on prend les 32 meilleures
 *   - Si le nb de qualifiés cible n'est pas divisible par nb de groupes,
 *     on complète avec les meilleurs 2èmes/3èmes classés cross-group.
 *
 * @param {Array} groups - Les groupes avec leurs classements calculés
 * @param {number} targetQualified - Taille du bracket (16 ou 32)
 * @returns {{ qualifiedIds: string[], consolationIds: string[] }}
 */
function determineQualifiers(groups, targetQualified) {
  const numGroups = groups.length;
  const qualifiedIds = [];
  const poolForExtra = []; // Candidats pour les places supplémentaires

  // Nombre de qualifiés directs par groupe (au minimum)
  const basePerGroup = Math.floor(targetQualified / numGroups);
  // Nombre de places supplémentaires à distribuer aux meilleurs 2èmes, etc.
  const extraSpots = targetQualified - basePerGroup * numGroups;

  for (const group of groups) {
    // group.standings = équipes triées par classement
    const standings = group.standings || [];
    for (let i = 0; i < standings.length; i++) {
      if (i < basePerGroup) {
        qualifiedIds.push(standings[i].teamId.toString());
      } else {
        // Candidat pour une place extra (avec ses stats pour le tri cross-group)
        poolForExtra.push(standings[i]);
      }
    }
  }

  // Trier le pool cross-group et prendre les meilleurs
  poolForExtra.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.setsFor - a.setsAgainst;
    const diffB = b.setsFor - b.setsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.setsFor - a.setsFor;
  });

  // Ajouter les extras (meilleurs non-qualifiés cross-group)
  for (let i = 0; i < extraSpots && i < poolForExtra.length; i++) {
    qualifiedIds.push(poolForExtra[i].teamId.toString());
  }

  // Tout le reste va en consolante
  const qualifiedSet = new Set(qualifiedIds);
  const consolationIds = poolForExtra
    .slice(extraSpots)
    .map(s => s.teamId.toString())
    .filter(id => !qualifiedSet.has(id));

  // Aussi les équipes des groupes qui ne sont pas dans le pool
  // (classées trop loin pour même être dans poolForExtra)
  for (const group of groups) {
    const standings = group.standings || [];
    for (const s of standings) {
      const id = s.teamId.toString();
      if (!qualifiedSet.has(id) && !consolationIds.includes(id)) {
        consolationIds.push(id);
      }
    }
  }

  return { qualifiedIds, consolationIds };
}

/**
 * Mélange un tableau aléatoirement.
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
 * Génère la structure complète d'un bracket d'élimination directe.
 *
 * @param {string[]} teamIds - IDs des équipes qualifiées (déjà à la bonne taille)
 * @returns {Array} - Tableau de matchs { round, position, team1Id, team2Id, feeder1, feeder2 }
 */
function generateBracket(teamIds) {
  const numTeams = teamIds.length;
  if (numTeams < 2) throw new Error('Il faut au moins 2 équipes pour un bracket');

  // S'assurer qu'on est bien une puissance de 2
  const bracketSize = nextPowerOfTwo(numTeams);
  const shuffled = shuffle(teamIds);

  const matches = [];

  // --- PREMIER TOUR (round 0) ---
  // Si on a moins d'équipes que la taille du bracket, certaines ont un "bye" (passage direct)
  const byes = bracketSize - numTeams;
  const firstRoundMatches = bracketSize / 2;

  let teamIndex = 0;
  for (let pos = 0; pos < firstRoundMatches; pos++) {
    const team1 = shuffled[teamIndex] || null;
    teamIndex++;

    let team2 = null;
    if (pos >= byes) {
      // Plus de byes disponibles : on apparie avec une autre équipe
      // En fait la logique de bye est : les `byes` premières positions ont un bye (team2 = null)
      // Non, la vraie logique : les byes sont distribués aux premiers slots
    }

    // Logique corrigée : si pos < byes, team2 = null (bye, l'équipe passe directement)
    if (pos < byes) {
      team2 = null; // Bye : cette équipe passe au tour suivant automatiquement
    } else {
      team2 = shuffled[teamIndex] || null;
      teamIndex++;
    }

    matches.push({
      round: 0,
      position: pos,
      team1Id: team1,
      team2Id: team2,
      sets: [],
      winnerId: team2 === null ? team1 : null, // Si bye, le gagnant est connu d'avance
      played: team2 === null, // Match avec bye considéré comme joué
      feeder1: null,
      feeder2: null,
    });
  }

  // --- ROUNDS SUIVANTS (vides, en attente des gagnants) ---
  const totalRounds = Math.log2(bracketSize);
  for (let round = 1; round < totalRounds; round++) {
    const numMatchesInRound = bracketSize / Math.pow(2, round + 1);
    for (let pos = 0; pos < numMatchesInRound; pos++) {
      // Les feeders indiquent d'où viennent les gagnants
      matches.push({
        round,
        position: pos,
        team1Id: null,
        team2Id: null,
        sets: [],
        winnerId: null,
        played: false,
        feeder1: { round: round - 1, position: pos * 2 },
        feeder2: { round: round - 1, position: pos * 2 + 1 },
      });
    }
  }

  return matches;
}

/**
 * Prochaine puissance de 2 supérieure ou égale à n.
 */
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Après la saisie d'un score, avance le gagnant au match suivant du bracket.
 * Met à jour les matchs en mémoire et retourne le tableau modifié.
 *
 * @param {Array} matches - Tous les matchs du bracket
 * @param {string} matchId - ID du match qui vient d'être joué
 * @param {string} winnerId - ID de l'équipe gagnante
 * @returns {Array} - Matches mis à jour
 */
function advanceWinner(matches, completedMatch) {
  const { round, position, winnerId } = completedMatch;

  // Chercher le match suivant dont ce match est un feeder
  const nextMatch = matches.find(m =>
    (m.feeder1?.round === round && m.feeder1?.position === position) ||
    (m.feeder2?.round === round && m.feeder2?.position === position)
  );

  if (!nextMatch) return matches; // Finale, pas de match suivant

  if (nextMatch.feeder1?.round === round && nextMatch.feeder1?.position === position) {
    nextMatch.team1Id = winnerId;
  } else {
    nextMatch.team2Id = winnerId;
  }

  return matches;
}

module.exports = { generateBracket, determineQualifiers, calculateBracketSize, advanceWinner };
