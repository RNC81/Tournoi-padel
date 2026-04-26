const crypto     = require('crypto');
const express    = require('express');
const Tournament = require('../models/Tournament');
const Group      = require('../models/Group');
const Match      = require('../models/Match');
const Team       = require('../models/Team');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes tournoi sont réservées aux admins
router.use(requireAuth, requireAdmin);

// ─── GET /api/tournament ──────────────────────────────────────────────────────
// Lire la config du tournoi singleton

router.get('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/tournament ─────────────────────────────────────────────────────
// Créer le tournoi singleton (échoue si un tournoi existe déjà)
// Body minimal : { name }
// Body complet  : { name, maxTeams, poolStageFormat, knockoutFormat, ... }

router.post('/', async (req, res) => {
  try {
    const existing = await Tournament.findOne();
    if (existing) {
      return res.status(409).json({ error: 'Un tournoi existe déjà. Utilisez PUT pour modifier.' });
    }

    const { name, maxTeams, poolStageFormat, knockoutFormat,
            consolantePoolFormat, consolanteKnockoutFormat,
            qualificationRules } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le champ "name" est requis' });
    }

    const tournament = await Tournament.create({
      name: name.trim(),
      ...(maxTeams              !== undefined && { maxTeams }),
      ...(poolStageFormat       !== undefined && { poolStageFormat }),
      ...(knockoutFormat        !== undefined && { knockoutFormat }),
      ...(consolantePoolFormat  !== undefined && { consolantePoolFormat }),
      ...(consolanteKnockoutFormat !== undefined && { consolanteKnockoutFormat }),
      ...(qualificationRules    !== undefined && { qualificationRules }),
    });

    res.status(201).json(tournament);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── PUT /api/tournament ──────────────────────────────────────────────────────
// Mettre à jour la config du tournoi (mise à jour partielle)
// Champs autorisés : name, maxTeams, currentPhase,
//   poolStageFormat, knockoutFormat, consolantePoolFormat,
//   consolanteKnockoutFormat, qualificationRules
// Note : le champ "status" est géré par PUT /api/tournament/status

router.put('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const allowed = [
      'name', 'date', 'location', 'maxTeams', 'currentPhase',
      'poolStageFormat', 'knockoutFormat',
      'consolantePoolFormat', 'consolanteKnockoutFormat',
      'qualificationRules',
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Trim le nom si fourni
    if (updates.name !== undefined) {
      if (!updates.name || !updates.name.trim()) {
        return res.status(400).json({ error: 'Le champ "name" ne peut pas être vide' });
      }
      updates.name = updates.name.trim();
    }

    const updated = await Tournament.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── PUT /api/tournament/status ───────────────────────────────────────────────
// Changer le statut du tournoi.
// Aucune validation de transition — n'importe quel statut peut aller vers n'importe quel autre.
// Exception : warning si on repasse à "registration" depuis "pool_stage".
// Body : { status: "registration" | "pool_stage" | "knockout" | "consolante" | "finished" | "setup" }

router.put('/status', async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['setup', 'registration', 'pool_stage', 'knockout', 'consolante', 'finished'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}`,
      });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const previousStatus = tournament.status;

    let warning = null;

    // Avertissement spécifique : retour en inscription depuis la phase de poule
    if (status === 'registration' && previousStatus === 'pool_stage') {
      warning = 'Le tirage au sort existant ne sera pas supprimé automatiquement. Utilisez /api/groups/regenerate si besoin.';
    }

    tournament.status = status;
    await tournament.save();

    res.json({ tournament, warning });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── GET /api/tournament/apikey ───────────────────────────────────────────────
// Retourne la clé API masquée. Avec ?reveal=true : retourne la clé complète.

router.get('/apikey', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const key = tournament.apiKey || process.env.API_KEY || null;

    if (!key) return res.json({ masked: null, full: null });

    const masked = '•'.repeat(key.length - 4) + key.slice(-4);
    const full   = req.query.reveal === 'true' ? key : null;

    res.json({ masked, full });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/tournament/apikey/regenerate ───────────────────────────────────
// Génère une nouvelle clé API et la stocke en DB. Body : { confirm: true }

router.post('/apikey/regenerate', async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation requise : { confirm: true }' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const newKey = crypto.randomBytes(32).toString('hex');
    tournament.apiKey = newKey;
    await tournament.save();

    const masked = '•'.repeat(newKey.length - 4) + newKey.slice(-4);
    res.json({ masked, full: newKey, message: 'Clé API régénérée avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/tournament/reset/pools ────────────────────────────────────────
// Supprime tous les groupes (phase pool), leurs matchs, et remet à zéro
// team.group + team.tournamentPath. Body : { confirm: true }

router.post('/reset/pools', async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation requise : { confirm: true }' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const tid = tournament._id;

    // Supprimer tous les groupes du tournoi
    const groupsDeleted = await Group.deleteMany({ tournament: tid });

    // Supprimer tous les matchs de poule (pool et consolante_pool)
    const matchesDeleted = await Match.deleteMany({
      tournament: tid,
      phase: { $in: ['pool', 'consolante_pool'] },
    });

    // Remettre à zéro l'affiliation des équipes
    const teamsUpdated = await Team.updateMany(
      {},
      { $set: { group: null, tournamentPath: null } }
    );

    res.json({
      message: 'Poules réinitialisées',
      groupsDeleted:  groupsDeleted.deletedCount,
      matchesDeleted: matchesDeleted.deletedCount,
      teamsUpdated:   teamsUpdated.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── POST /api/tournament/reset/bracket ──────────────────────────────────────
// Supprime tous les matchs knockout et remet tournamentPath à null.
// Les poules et le tirage restent intacts. Body : { confirm: true }

router.post('/reset/bracket', async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation requise : { confirm: true }' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const knockoutPhases = [
      'r32', 'r16', 'qf', 'sf', 'final',
      'consolante_r32', 'consolante_r16',
      'consolante_qf', 'consolante_sf', 'consolante_final',
    ];

    const matchesDeleted = await Match.deleteMany({
      tournament: tournament._id,
      phase: { $in: knockoutPhases },
    });

    const teamsUpdated = await Team.updateMany(
      {},
      { $set: { tournamentPath: null } }
    );

    res.json({
      message: 'Bracket réinitialisé',
      matchesDeleted: matchesDeleted.deletedCount,
      teamsUpdated:   teamsUpdated.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── POST /api/tournament/reset/all ──────────────────────────────────────────
// Supprime tous les Group et tous les Match. Remet team.group et
// team.tournamentPath à null. Le document Tournament lui-même est conservé.
// Body : { confirm: true }

router.post('/reset/all', async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation requise : { confirm: true }' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const tid = tournament._id;

    const groupsDeleted  = await Group.deleteMany({ tournament: tid });
    const matchesDeleted = await Match.deleteMany({ tournament: tid });
    const teamsUpdated   = await Team.updateMany(
      {},
      { $set: { group: null, tournamentPath: null } }
    );

    res.json({
      message: 'Tournoi entièrement réinitialisé (équipes conservées)',
      groupsDeleted:  groupsDeleted.deletedCount,
      matchesDeleted: matchesDeleted.deletedCount,
      teamsUpdated:   teamsUpdated.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

module.exports = router;
