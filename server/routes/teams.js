const express = require('express');
const multer  = require('multer');
const { parse } = require('csv-parse/sync');
const Team    = require('../models/Team');
const Group   = require('../models/Group');
const Match   = require('../models/Match');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const safeError        = require('../utils/safeError');

const router = express.Router();

// Multer : stockage en mémoire uniquement, pas d'écriture disque
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// Toutes les routes équipes sont réservées aux admins
router.use(requireAuth, requireAdmin);

// ─── POST /api/teams ─────────────────────────────────────────────────────────
// Créer une équipe manuellement.
// "name" est optionnel : si absent, auto-généré "[NomJoueur1] / [NomJoueur2]".
// "country" est libre (ville ou pays en toutes lettres, ex : "Paris", "London").

router.post('/', async (req, res) => {
  try {
    const { name, player1, player2, country, notes } = req.body;

    if (!player1 || !player2) {
      return res.status(400).json({ error: 'player1 et player2 sont requis' });
    }

    const p1 = player1.trim();
    const p2 = player2.trim();

    // Auto-génération du nom : premier mot (prénom) de chaque joueur
    const firstWord = str => str.split(/\s+/)[0] || str;
    const teamName = name?.trim() || `${firstWord(p1)} / ${firstWord(p2)}`;

    const team = await Team.create({
      name:    teamName,
      player1: p1,
      player2: p2,
      country: country?.trim() || '',
      notes:   notes?.trim()   || '',
    });

    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── GET /api/teams ──────────────────────────────────────────────────────────
// Lister toutes les équipes (group populé avec _id + name)

// ─── GET /api/teams/count ─────────────────────────────────────────────────────
// Nombre d'équipes inscrites — utilisé par la homepage pour la barre de progression.
// Route AVANT /:id pour éviter que "count" soit interprété comme un ObjectId.

router.get('/count', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/', async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('group', 'name')
      .sort({ registeredAt: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /api/teams/:id ──────────────────────────────────────────────────────
// Modifier une équipe — mise à jour partielle

router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const allowed = ['name', 'player1', 'player2', 'country', 'notes', 'tournamentPath'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = typeof req.body[key] === 'string'
          ? req.body[key].trim()
          : req.body[key];
      }
    }
    // country : texte libre, pas de transformation de casse

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('group', 'name');

    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── DELETE /api/teams/:id ───────────────────────────────────────────────────
// Supprimer une équipe
// Retire la team du Group.teams si elle y est assignée.
// Les Match existants ne sont PAS supprimés (historique conservé).

router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });

    // Retirer la team du tableau teams de son groupe
    if (team.group) {
      await Group.findByIdAndUpdate(team.group, { $pull: { teams: team._id } });
    }

    await team.deleteOne();
    res.json({ message: 'Équipe supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/teams/import-csv/parse ────────────────────────────────────────
// Étape 1 de l'import CSV : parser le fichier et retourner colonnes + lignes.
// Le frontend garde le résultat en mémoire et l'envoie à /confirm avec le mapping.

router.post('/import-csv/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu (champ attendu : "file")' });
    }

    const content = req.file.buffer.toString('utf-8');

    // Détection automatique du délimiteur (virgule ou point-virgule)
    const firstLine = content.split('\n')[0] || '';
    const commas    = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolons > commas ? ';' : ',';

    // Parser le CSV : la première ligne devient les clés des objets
    const rows = parse(content, {
      delimiter,
      columns:            true,  // première ligne = noms de colonnes
      skip_empty_lines:   true,
      trim:               true,
      relax_column_count: true,
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Fichier CSV vide ou illisible' });
    }

    const columns = Object.keys(rows[0]);

    res.json({ columns, rows, rowCount: rows.length });
  } catch (err) {
    res.status(400).json({ error: 'Impossible de parser le fichier CSV', detail: err.message });
  }
});

// ─── POST /api/teams/import-csv/confirm ──────────────────────────────────────
// Étape 2 de l'import CSV : créer les équipes à partir des lignes + mapping.
//
// mapping peut combiner deux colonnes pour un joueur :
//   { player1_first: "Prénom capitaine", player1_last: "Nom capitaine", ... }
//   ou en colonne unique :
//   { player1: "Nom complet joueur1", ... }
//
// Le champ "name" est optionnel : auto-généré si absent.
// Le champ "country" est du texte libre, pas de validation de format.

router.post('/import-csv/confirm', async (req, res) => {
  try {
    const { rows, mapping } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows manquant ou vide' });
    }
    if (!mapping) {
      return res.status(400).json({ error: 'mapping manquant' });
    }

    // Vérifier que player1, player2 et country ont au moins un mapping
    const hasPlayer1 = mapping.player1 || mapping.player1_first || mapping.player1_last;
    const hasPlayer2 = mapping.player2 || mapping.player2_first || mapping.player2_last;
    if (!hasPlayer1) return res.status(400).json({ error: "Mapping requis pour player1 (une colonne ou prénom+nom)" });
    if (!hasPlayer2) return res.status(400).json({ error: "Mapping requis pour player2 (une colonne ou prénom+nom)" });
    if (!mapping.country) return res.status(400).json({ error: "Mapping requis pour country" });

    // Reconstruit un nom de joueur depuis une ou deux colonnes du CSV
    function buildPlayer(row, singleKey, firstKey, lastKey) {
      if (mapping[singleKey]) return row[mapping[singleKey]]?.trim() || '';
      const first = mapping[firstKey] ? (row[mapping[firstKey]]?.trim() || '') : '';
      const last  = mapping[lastKey]  ? (row[mapping[lastKey]]?.trim()  || '') : '';
      return [first, last].filter(Boolean).join(' ');
    }

    // Premier mot = prénom (format stocké : "Prénom Nom")
    const firstWord = str => (str || '').split(/\s+/)[0] || str;

    const results = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2; // ligne 1 = en-têtes, index commence à 0

      const player1 = buildPlayer(row, 'player1', 'player1_first', 'player1_last');
      const player2 = buildPlayer(row, 'player2', 'player2_first', 'player2_last');
      const country = row[mapping.country]?.trim() || '';
      const notes   = mapping.notes ? (row[mapping.notes]?.trim() || '') : '';

      // name : colonne CSV explicite, ou auto-généré "Prénom1 / Prénom2"
      let name = mapping.name ? (row[mapping.name]?.trim() || '') : '';
      if (!name && player1 && player2) {
        name = `${firstWord(player1)} / ${firstWord(player2)}`;
      }

      if (!player1) {
        results.errors.push({ row: rowNum, reason: 'player1 manquant' });
        results.skipped++;
        continue;
      }
      if (!player2) {
        results.errors.push({ row: rowNum, reason: 'player2 manquant' });
        results.skipped++;
        continue;
      }

      try {
        await Team.create({ name, player1, player2, country, notes });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: rowNum, reason: err.message });
        results.skipped++;
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── PUT /api/teams/:id/move-group ───────────────────────────────────────────
// Déplacer une équipe dans une autre poule.
// Body : { groupId: "..." }
// Retire la team de son ancienne poule, l'ajoute dans la nouvelle.
// Les Match existants ne sont pas supprimés — un warning est retourné
// si des matchs joués existent dans l'ancienne poule.

router.put('/:id/move-group', validateObjectId, async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'groupId requis' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });

    const newGroup = await Group.findById(groupId);
    if (!newGroup) return res.status(404).json({ error: 'Groupe de destination introuvable' });

    if (String(team.group) === String(groupId)) {
      return res.status(400).json({ error: 'L\'équipe est déjà dans ce groupe' });
    }

    let warning = null;

    // Retirer la team de son groupe actuel et vérifier les matchs joués
    if (team.group) {
      const oldGroup = await Group.findById(team.group);

      if (oldGroup) {
        // Chercher les matchs joués impliquant cette team dans l'ancienne poule
        const playedCount = await Match.countDocuments({
          _id:    { $in: oldGroup.matches },
          played: true,
          $or:    [{ team1: team._id }, { team2: team._id }],
        });

        if (playedCount > 0) {
          warning = `${playedCount} match${playedCount > 1 ? 's' : ''} joué${playedCount > 1 ? 's' : ''} dans la poule "${oldGroup.name}" ne seront pas supprimés. Vérifiez les classements manuellement.`;
        }

        await Group.findByIdAndUpdate(team.group, { $pull: { teams: team._id } });
      }
    }

    // Ajouter la team dans le nouveau groupe (éviter les doublons)
    await Group.findByIdAndUpdate(groupId, { $addToSet: { teams: team._id } });

    // Mettre à jour la référence group sur la team
    team.group = groupId;
    await team.save();

    res.json({ team, warning });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

module.exports = router;
