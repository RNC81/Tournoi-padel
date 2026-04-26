/**
 * reimport-clean.js — Réimporte les noms propres depuis le CSV source.
 *
 * Structure CSV (1-based) :
 *   Col 1 : Nom capitaine
 *   Col 2 : Prénom capitaine
 *   Col 3 : Âge (ignoré)
 *   Col 4 : Pays / Ville
 *   Col 5 : Nom binôme
 *   Col 6 : Prénom binôme
 *   Col 7 : Âge (ignoré)
 *   Col 8 : Téléphone capitaine (IGNORÉ)
 *   Col 9 : Téléphone binôme   (IGNORÉ)
 *
 * Correspondance : 1ère ligne de données CSV ↔ 1ère équipe créée (tri par registeredAt ASC).
 *
 * Usage : node server/scripts/reimport-clean.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs     = require('fs');
const path   = require('path');
const { parse } = require('csv-parse/sync');
const mongoose  = require('mongoose');
const Team      = require('../models/Team');

const CSV_PATH = path.join(__dirname, 'Liste_IDP_Padel.csv');

const firstWord = str => (str || '').trim().split(/\s+/)[0] || str;

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier introuvable : ${CSV_PATH}`);
    process.exit(1);
  }

  // Lecture + parsing (avec en-tête ignoré via from_line: 2)
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parse(content, {
    delimiter:          ',',
    columns:            false,   // tableau positionnel, pas d'objet nommé
    from_line:          2,       // ignore la ligne d'en-tête
    skip_empty_lines:   true,
    trim:               true,
    relax_column_count: true,
  });

  console.log(`\nCSV : ${rows.length} lignes de données\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB');

  // Toutes les équipes triées par date de création (ordre d'import original)
  const teams = await Team.find().sort({ registeredAt: 1 });
  console.log(`Base : ${teams.length} équipes\n`);

  if (rows.length !== teams.length) {
    console.warn(`⚠  Attention : ${rows.length} lignes CSV ≠ ${teams.length} équipes en base.`);
    console.warn('   Le script mettra à jour les N premières (min des deux).\n');
  }

  const n = Math.min(rows.length, teams.length);
  let updated = 0;

  console.log('─'.repeat(80));
  console.log('Exemple des 5 premières lignes :');
  console.log('─'.repeat(80));

  for (let i = 0; i < n; i++) {
    const row   = rows[i];
    const team  = teams[i];

    // Reconstruction correcte : Prénom(col2) + Nom(col1)
    const p1 = [row[1], row[0]].filter(Boolean).join(' ').trim();  // Prénom Nom cap
    const p2 = [row[5], row[4]].filter(Boolean).join(' ').trim();  // Prénom Nom bin
    const country = (row[3] || '').trim();
    const name    = `${firstWord(p1)} / ${firstWord(p2)}`;

    if (i < 5) {
      console.log(`\nLigne ${i + 1}`);
      console.log(`  player1  : "${team.player1}" → "${p1}"`);
      console.log(`  player2  : "${team.player2}" → "${p2}"`);
      console.log(`  country  : "${team.country}" → "${country}"`);
      console.log(`  name     : "${team.name}" → "${name}"`);
    }

    await Team.findByIdAndUpdate(team._id, { player1: p1, player2: p2, country, name });
    updated++;
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\n✓ ${updated} équipes mises à jour`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
