/**
 * Migration fix : recharge les noms de joueurs depuis le CSV source.
 *
 * Le précédent script a inversé les noms qui étaient déjà corrects.
 * Ce script repart du CSV original pour reconstruire player1 et player2
 * avec le format définitif : "Prénom Nom".
 *
 * Usage :
 *   node server/scripts/migrate-fix.js
 *   (depuis la racine du projet)
 *
 * Prérequis : fichier CSV à l'emplacement server/scripts/Liste_IDP_Padel.csv
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs       = require('fs');
const path     = require('path');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const Team     = require('../models/Team');

const CSV_PATH = path.join(__dirname, 'Liste_IDP_Padel.csv');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Détecte les colonnes CSV par mots-clés dans les en-têtes
function detectColumns(columns) {
  const map = {};
  for (const col of columns) {
    const n = normalize(col);
    if (/prenom.*(cap|1)/.test(n) || (n.includes('prenom') && n.includes('cap')))   map.p1_first = col;
    else if (/nom.*(cap|1)/.test(n) || (n.includes('nom') && n.includes('cap')))    map.p1_last  = col;
    else if (/prenom.*(bin|2|partenaire)/.test(n) || (n.includes('prenom') && n.includes('bin'))) map.p2_first = col;
    else if (/nom.*(bin|2|partenaire)/.test(n) || (n.includes('nom') && n.includes('bin')))       map.p2_last  = col;
    else if (/pays|ville|city/.test(n)) map.country = col;
  }
  return map;
}

// Cherche une équipe par correspondance sur les mots (insensible à l'ordre)
function wordsMatch(dbStr, csvPart1, csvPart2) {
  const dbWords  = normalize(dbStr).split(/\s+/).sort().join(' ');
  const csvWords = [normalize(csvPart1), normalize(csvPart2)].filter(Boolean).sort().join(' ');
  return dbWords === csvWords;
}

const firstWord = str => (str || '').split(/\s+/)[0] || str;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  // Lecture du CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier CSV introuvable : ${CSV_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const firstLine = content.split('\n')[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const rows = parse(content, {
    delimiter,
    columns:            true,
    skip_empty_lines:   true,
    trim:               true,
    relax_column_count: true,
  });

  const columns = Object.keys(rows[0] || {});
  console.log(`\nCSV chargé : ${rows.length} lignes, délimiteur "${delimiter}"`);
  console.log(`Colonnes détectées : ${columns.join(' | ')}\n`);

  // Détection automatique des colonnes
  const colMap = detectColumns(columns);
  console.log('Mapping colonnes :');
  console.log(`  Prénom cap : "${colMap.p1_first || '?'}"`);
  console.log(`  Nom cap    : "${colMap.p1_last  || '?'}"`);
  console.log(`  Prénom bin : "${colMap.p2_first || '?'}"`);
  console.log(`  Nom bin    : "${colMap.p2_last  || '?'}"`);
  console.log(`  Pays/Ville : "${colMap.country  || '?'}"`);

  if (!colMap.p1_first || !colMap.p1_last || !colMap.p2_first || !colMap.p2_last) {
    console.error('\nImpossible de détecter toutes les colonnes requises. Vérifiez les en-têtes CSV.');
    process.exit(1);
  }

  // Connexion MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\nConnecté à MongoDB');

  const teams = await Team.find();
  console.log(`${teams.length} équipes en base\n`);

  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const p1_first = (row[colMap.p1_first] || '').trim();
    const p1_last  = (row[colMap.p1_last]  || '').trim();
    const p2_first = (row[colMap.p2_first] || '').trim();
    const p2_last  = (row[colMap.p2_last]  || '').trim();

    if (!p1_first && !p1_last) continue; // ligne vide

    // Format cible : "Prénom Nom"
    const newP1 = [p1_first, p1_last].filter(Boolean).join(' ');
    const newP2 = [p2_first, p2_last].filter(Boolean).join(' ');

    // Stratégies de matching (la mauvaise migration a pu produire "Nom Prénom")
    // On cherche une équipe dont les mots de player1 correspondent au CSV (peu importe l'ordre)
    const match = teams.find(t => wordsMatch(t.player1, p1_first, p1_last));

    if (!match) {
      console.log(`  [NON TROUVÉ] "${newP1}" / "${newP2}"`);
      notFound++;
      continue;
    }

    // Régénérer le nom auto si c'était un nom généré automatiquement
    const autoPatterns = [
      `${firstWord(match.player1)} / ${firstWord(match.player2)}`, // format actuel (mauvais)
      `${match.player1.split(/\s+/).pop()} / ${match.player2.split(/\s+/).pop()}`, // ancienne version lastWord
    ];
    const wasAuto = autoPatterns.includes(match.name);
    const newName = wasAuto
      ? `${firstWord(newP1)} / ${firstWord(newP2)}`
      : match.name; // nom manuel → on le laisse intact

    const changed = match.player1 !== newP1 || match.player2 !== newP2 || match.name !== newName;
    if (!changed) {
      console.log(`  [déjà correct] ${match.name}`);
      continue;
    }

    await Team.findByIdAndUpdate(match._id, {
      player1: newP1,
      player2: newP2,
      name:    newName,
    });

    console.log(`  [mis à jour] "${match.player1}" → "${newP1}" | "${match.player2}" → "${newP2}" | nom: "${match.name}" → "${newName}"`);
    updated++;
  }

  console.log(`\n✓ Migration terminée : ${updated} mis à jour, ${notFound} non trouvés`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
