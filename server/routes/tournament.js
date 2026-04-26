const express = require('express');
const Tournament = require('../models/Tournament');
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
      'name', 'maxTeams', 'currentPhase',
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

module.exports = router;
