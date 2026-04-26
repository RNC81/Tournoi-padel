// Calcule le classement d'un groupe depuis les Match bruts (team1/team2 = ObjectIds non populés).
// teamIds : tableau d'ObjectId ou de strings
// matches : tableau de documents Match (non populés)
// tiebreaker : tableau de critères en ordre de priorité
// Retourne un tableau trié avec { teamId, rank, points, played, won, lost, setsWon, setsLost, setDiff }

function computeStandings(
  teamIds,
  matches,
  tiebreaker = ['points', 'setDiff', 'setsWon', 'directConfrontation']
) {
  const stats = {};
  for (const id of teamIds) {
    stats[String(id)] = {
      teamId:   id,
      points:   0,
      played:   0,
      won:      0,
      lost:     0,
      setsWon:  0,
      setsLost: 0,
      setDiff:  0,
    };
  }

  for (const match of matches) {
    if (!match.played) continue;
    const id1 = String(match.team1);
    const id2 = String(match.team2);
    if (!stats[id1] || !stats[id2]) continue;

    let s1 = 0, s2 = 0;
    for (const set of match.sets) {
      if (set.score1 > set.score2)      s1++;
      else if (set.score2 > set.score1) s2++;
    }

    stats[id1].played++;
    stats[id1].setsWon  += s1;
    stats[id1].setsLost += s2;

    stats[id2].played++;
    stats[id2].setsWon  += s2;
    stats[id2].setsLost += s1;

    if (match.result === 'team1') {
      stats[id1].won++;  stats[id1].points += 3;
      stats[id2].lost++;
    } else if (match.result === 'team2') {
      stats[id2].won++;  stats[id2].points += 3;
      stats[id1].lost++;
    }
    // result === 'draw' → aucun point
  }

  for (const s of Object.values(stats)) {
    s.setDiff = s.setsWon - s.setsLost;
  }

  const list = Object.values(stats);

  list.sort((a, b) => {
    for (const criterion of tiebreaker) {
      if (criterion === 'points'  && b.points  !== a.points)  return b.points  - a.points;
      if (criterion === 'setDiff' && b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      if (criterion === 'setsWon' && b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;

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
    return 0;
  });

  return list.map((s, i) => ({ ...s, rank: i + 1 }));
}

module.exports = { computeStandings };
