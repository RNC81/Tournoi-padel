// Calcule le classement d'un groupe depuis les Match bruts (team1/team2 = ObjectIds non populés).
// teamIds : tableau d'ObjectId ou de strings
// matches : tableau de documents Match (non populés)
// tiebreaker : tableau de critères en ordre de priorité
//
// Règlement officiel :
//   - victoire = 3 pts, défaite = 1 pt, draw = 0 pt (ne devrait pas arriver en padel)
//   - gameDiff = total jeux marqués - total jeux concédés (ex: 6-3 → +3 pour le vainqueur)
//   - gamesWon = total jeux marqués
//
// Retourne un tableau trié avec :
//   { teamId, rank, points, played, won, lost,
//     gamesWon, gamesLost, gameDiff }

function computeStandings(
  teamIds,
  matches,
  tiebreaker = ['wins', 'gameDiff', 'gamesWon', 'directConfrontation']
) {
  const stats = {};
  for (const id of teamIds) {
    stats[String(id)] = {
      teamId:    id,
      points:    0,
      played:    0,
      won:       0,
      lost:      0,
      gamesWon:  0,   // total jeux marqués (score1 + score2 sur tous les sets)
      gamesLost: 0,
      gameDiff:  0,
    };
  }

  for (const match of matches) {
    if (!match.played) continue;
    const id1 = String(match.team1);
    const id2 = String(match.team2);
    if (!stats[id1] || !stats[id2]) continue;

    // Compter les jeux (pas les sets) — chaque set contribue score1+score2 jeux
    for (const set of match.sets) {
      stats[id1].gamesWon  += set.score1;
      stats[id1].gamesLost += set.score2;
      stats[id2].gamesWon  += set.score2;
      stats[id2].gamesLost += set.score1;
    }

    stats[id1].played++;
    stats[id2].played++;

    if (match.result === 'team1') {
      stats[id1].won++;    stats[id1].points += 3;
      stats[id2].lost++;   stats[id2].points += 1; // défaite = 1 pt
    } else if (match.result === 'team2') {
      stats[id2].won++;    stats[id2].points += 3;
      stats[id1].lost++;   stats[id1].points += 1;
    }
    // result === 'draw' → 0 pts (ne devrait pas arriver en padel)
  }

  for (const s of Object.values(stats)) {
    s.gameDiff = s.gamesWon - s.gamesLost;
  }

  const list = Object.values(stats);

  list.sort((a, b) => {
    for (const criterion of tiebreaker) {
      if (criterion === 'wins'     && b.won      !== a.won)      return b.won      - a.won;
      if (criterion === 'gameDiff' && b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (criterion === 'gamesWon' && b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;

      // Compatibilité descendante avec anciens noms (si tiebreaker stocké en DB)
      if (criterion === 'points'  && b.points  !== a.points)  return b.points  - a.points;
      if (criterion === 'setDiff' && b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (criterion === 'setsWon' && b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;

      if (criterion === 'directConfrontation') {
        const h2h = matches.find(m =>
          m.played && (
            (String(m.team1) === String(a.teamId) && String(m.team2) === String(b.teamId)) ||
            (String(m.team1) === String(b.teamId) && String(m.team2) === String(a.teamId))
          )
        );
        if (h2h && h2h.result && h2h.result !== 'draw') {
          const aWon =
            (String(h2h.team1) === String(a.teamId) && h2h.result === 'team1') ||
            (String(h2h.team2) === String(a.teamId) && h2h.result === 'team2');
          if (aWon)  return -1;
          const bWon =
            (String(h2h.team1) === String(b.teamId) && h2h.result === 'team1') ||
            (String(h2h.team2) === String(b.teamId) && h2h.result === 'team2');
          if (bWon)  return 1;
        }
      }
    }
    return 0; // égalité parfaite → tirage au sort (l'admin tranche)
  });

  return list.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Retourne les stats ajustées d'une équipe pour la comparaison équitable des wildcards.
 *
 * Problème : une poule de 6 joue 5 matchs, une poule de 5 joue 4 matchs.
 * Pour comparer les 4èmes entre poules de tailles différentes, on retire
 * le résultat contre le dernier classé de la poule de 6 (pour n'avoir que 4 matchs).
 *
 * @param {string}   teamId       — équipe dont on veut les stats ajustées
 * @param {string[]} allTeamIds   — toutes les équipes de la poule
 * @param {Object[]} groupMatches — tous les matchs de la poule
 * @param {number}   groupSize    — taille de la poule (nombre d'équipes)
 * @returns {Object|null}         — stats ajustées (ou stats normales si groupSize <= 5)
 */
function computeAdjustedStats(teamId, allTeamIds, groupMatches, groupSize) {
  // Pas d'ajustement pour les poules de 5 équipes ou moins
  if (groupSize <= 5) {
    return computeStandings(allTeamIds, groupMatches)
      .find(x => String(x.teamId) === String(teamId)) || null;
  }

  // Identifier le dernier classé (6ème) dans la poule complète
  const fullStandings = computeStandings(allTeamIds, groupMatches);
  const lastTeamId = String(fullStandings[fullStandings.length - 1].teamId);

  // Retirer uniquement le match entre teamId et lastTeamId
  const adjustedMatches = groupMatches.filter(m => {
    const t1 = String(m.team1), t2 = String(m.team2);
    return !(
      (t1 === String(teamId) && t2 === lastTeamId) ||
      (t2 === String(teamId) && t1 === lastTeamId)
    );
  });

  // Recalculer les stats sans le dernier
  const adjustedTeamIds = allTeamIds.filter(id => String(id) !== lastTeamId);
  return computeStandings(adjustedTeamIds, adjustedMatches)
    .find(x => String(x.teamId) === String(teamId)) || null;
}

module.exports = { computeStandings, computeAdjustedStats };
