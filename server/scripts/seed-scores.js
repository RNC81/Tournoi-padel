/**
 * seed-scores.js — Simule une phase de poule complète avec des scores aléatoires.
 *
 * Pour chaque match de poule non joué :
 *   - génère un score réaliste (sets courts, target=4)
 *   - met à jour le match directement en base (même logique que PUT /matches/:id/score)
 *
 * Usage : node server/scripts/seed-scores.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose             = require('mongoose');
const Match                = require('../models/Match');
const Group                = require('../models/Group');
const Tournament           = require('../models/Tournament');
const { computeStandings } = require('../utils/standings');

// ─── Génération de scores ─────────────────────────────────────────────────────

const TARGET = 4; // sets en format court pour aller vite

// Retourne un score de set où le gagnant atteint TARGET et le perdant ≤ TARGET-1
function randomSet(team1Wins) {
  const lose = Math.floor(Math.random() * TARGET); // 0 à TARGET-1
  return team1Wins
    ? { score1: TARGET, score2: lose }
    : { score1: lose,   score2: TARGET };
}

// Génère le score d'un match complet (best of 3)
// team1Win : true → team1 gagne, false → team2 gagne
function generateMatchScore(team1Win) {
  const straight = Math.random() < 0.65; // 65% de chance de 2-0
  if (straight) {
    return {
      sets:   [randomSet(team1Win), randomSet(team1Win)],
      result: team1Win ? 'team1' : 'team2',
    };
  }
  // 2-1 : gagnant perd le 2ème set
  return {
    sets: [
      randomSet(team1Win),
      randomSet(!team1Win), // set intermédiaire perdu
      randomSet(team1Win),
    ],
    result: team1Win ? 'team1' : 'team2',
  };
}

// ─── Affichage classement ─────────────────────────────────────────────────────

async function printStandings(group, tournament) {
  const rawMatches = await Match.find({ _id: { $in: group.matches } });
  const tiebreaker = tournament.qualificationRules?.tiebreaker ||
    ['points', 'setDiff', 'setsWon', 'directConfrontation'];
  const standings  = computeStandings(
    group.teams.map(t => t._id || t),
    rawMatches,
    tiebreaker
  );

  // Récupérer les noms des équipes
  const Team   = require('../models/Team');
  const teamMap = {};
  const teams   = await Team.find({ _id: { $in: group.teams } }, 'name player1');
  for (const t of teams) teamMap[String(t._id)] = t.name || t.player1 || '?';

  console.log(`\n  Poule ${group.name} — classement :`);
  for (const s of standings) {
    const name = teamMap[String(s.teamId)] || String(s.teamId);
    console.log(
      `    ${s.rank}. ${name.padEnd(28)} ${String(s.points).padStart(2)} pts | ` +
      `V:${s.won} D:${s.lost} | diff ${s.setDiff >= 0 ? '+' : ''}${s.setDiff}`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB\n');

  const tournament = await Tournament.findOne();
  if (!tournament) { console.error('Aucun tournoi configuré.'); process.exit(1); }

  // Tous les matchs de poule non joués (avec des équipes assignées)
  const unplayed = await Match.find({
    tournament: tournament._id,
    phase:      'pool',
    played:     false,
    team1:      { $ne: null },
    team2:      { $ne: null },
  });

  if (unplayed.length === 0) {
    console.log('Aucun match de poule en attente. Les poules sont déjà complètes.');
    process.exit(0);
  }

  console.log(`${unplayed.length} matchs à jouer...\n`);

  let done = 0;
  for (const match of unplayed) {
    const team1Win = Math.random() < 0.5;
    const { sets, result } = generateMatchScore(team1Win);
    const winner = team1Win ? match.team1 : match.team2;

    match.sets   = sets;
    match.result = result;
    match.winner = winner;
    match.played = true;
    await match.save();
    done++;
  }

  console.log(`✓ ${done} matchs joués\n`);
  console.log('─'.repeat(60));

  // Afficher le classement de chaque groupe
  const groups = await Group.find({
    tournament: tournament._id,
    phase:      'pool',
  }).sort({ name: 1 });

  for (const group of groups) {
    await printStandings(group, tournament);
  }

  console.log('\n─'.repeat(60));
  console.log('\nPhase de poule terminée. Vous pouvez maintenant générer le bracket.');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
