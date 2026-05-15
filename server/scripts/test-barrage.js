/**
 * test-barrage.js — Vérifie la composition de la consolante.
 *
 * Usage : node server/scripts/test-barrage.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Team     = require('../models/Team');
const Match    = require('../models/Match');
require('../models/Group');     // nécessaire pour le populate 'group'
require('../models/Tournament');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB\n');

  // ── 1. Toutes les équipes non-qualifiées (tournamentPath = null, group != null)
  const eligibleTeams = await Team.find({ group: { $ne: null }, tournamentPath: null })
    .populate('group', 'name').lean();

  const byeTeams     = eligibleTeams.filter(t => t.groupRank != null && t.groupRank <= 4);
  const barrageTeams = eligibleTeams.filter(t => t.groupRank == null || t.groupRank >= 5);

  const rank5 = barrageTeams.filter(t => t.groupRank === 5);
  const rank6 = barrageTeams.filter(t => t.groupRank === 6);
  const rankN = barrageTeams.filter(t => t.groupRank == null);

  console.log('════════════════════════════════════════════');
  console.log(' ÉQUIPES ÉLIGIBLES CONSOLANTE (tournamentPath=null, group≠null)');
  console.log('════════════════════════════════════════════');
  console.log(`  Total éligibles      : ${eligibleTeams.length}`);
  console.log(`  BYE direct (rank≤4) : ${byeTeams.length}`);
  console.log(`  BARRAGE (rank≥5)    : ${barrageTeams.length}`);
  console.log(`    dont rank=5       : ${rank5.length}`);
  console.log(`    dont rank=6       : ${rank6.length}`);
  console.log(`    dont rank=null    : ${rankN.length}`);
  console.log('');

  // ── 2. Matchs de barrage existants
  const barrageMatches = await Match.find({ phase: 'consolante_barrage' })
    .populate('team1', 'name player1 player2 groupRank')
    .populate('team2', 'name player1 player2 groupRank')
    .lean();
  const playedBarrage  = barrageMatches.filter(m => m.played).length;

  console.log('────────────────────────────────────────────');
  console.log(' MATCHS DE BARRAGE EN BASE');
  console.log('────────────────────────────────────────────');
  console.log(`  Matchs barrage      : ${barrageMatches.length}`);
  console.log(`  Joués               : ${playedBarrage}/${barrageMatches.length}`);
  console.log('');

  // ── 3. Simulation : si le barrage est joué, combien rejoignent la consolante ?
  const barrageWinners = Math.ceil(barrageTeams.length / 2); // gagnants théoriques

  // Équipes r32 losers (déjà passées en tournamentPath=null par score r32)
  const r32LosersCount = byeTeams.filter(t => t.groupRank != null && t.groupRank <= 4).length;

  console.log('────────────────────────────────────────────');
  console.log(' PROJECTION BRACKET CONSOLANTE 1/16');
  console.log('────────────────────────────────────────────');
  console.log(`  BYE directs (≤ rank 4)         : ${byeTeams.length}`);
  console.log(`  Gagnants barrage (théoriques)  : ${barrageWinners}`);
  const total = byeTeams.length + barrageWinners;
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  TOTAL consolante 1/16          : ${total}`);
  console.log('');

  if (total === 32) {
    console.log('  ✓ TOTAL = 32 — bracket consolante 1/16 complet');
  } else if (total < 32) {
    console.log(`  ⚠ TOTAL = ${total} → manque ${32 - total} équipes pour remplir un bracket de 32`);
  } else {
    console.log(`  ⚠ TOTAL = ${total} → ${total - 32} équipes en trop (bracket de 32 dépassé)`);
  }
  console.log('');

  // ── 4. Détail équipes barrage
  if (barrageTeams.length > 0) {
    console.log('────────────────────────────────────────────');
    console.log(' DÉTAIL ÉQUIPES BARRAGE (rank ≥ 5 ou null)');
    console.log('────────────────────────────────────────────');
    for (const t of barrageTeams.sort((a, b) => (a.groupRank || 99) - (b.groupRank || 99))) {
      const name = t.player1 && t.player2 ? `${t.player1} / ${t.player2}` : t.name;
      const grp  = t.group?.name || '?';
      console.log(`  [rank ${t.groupRank ?? 'null'}] ${name.padEnd(30)} (poule ${grp})`);
    }
    console.log('');
  }

  // ── 5. Vérification supplémentaire : équipes tournamentPath='main'
  const mainCount = await Team.countDocuments({ tournamentPath: 'main' });
  const elimCount = await Team.countDocuments({ tournamentPath: 'eliminated' });
  const consCount = await Team.countDocuments({ tournamentPath: 'consolante' });
  const nullCount = await Team.countDocuments({ tournamentPath: null });

  console.log('────────────────────────────────────────────');
  console.log(' RÉPARTITION tournamentPath');
  console.log('────────────────────────────────────────────');
  console.log(`  main        : ${mainCount}`);
  console.log(`  null        : ${nullCount}`);
  console.log(`  consolante  : ${consCount}`);
  console.log(`  eliminated  : ${elimCount}`);
  console.log(`  ──────────────────────────────────────────`);
  const grandTotal = mainCount + nullCount + consCount + elimCount;
  console.log(`  TOTAL       : ${grandTotal}`);
  console.log('════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
