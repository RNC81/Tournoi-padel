const express = require('express');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/teams — Inscription d'une équipe (accès public)
router.post('/', async (req, res) => {
  try {
    const { name, player1, player2 } = req.body;

    // Validation basique
    if (!name || !player1?.name || !player1?.email || !player2?.name || !player2?.email) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Vérifier que les inscriptions sont ouvertes
    const tournament = await Tournament.findOne();
    if (!tournament) {
      return res.status(503).json({ error: 'Le tournoi n\'est pas encore ouvert aux inscriptions' });
    }
    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Les inscriptions sont fermées' });
    }

    // Vérifier la limite de 100 équipes
    const count = await Team.countDocuments();
    if (count >= tournament.maxTeams) {
      return res.status(400).json({ error: 'Le nombre maximum d\'équipes est atteint (100)' });
    }

    // Vérifier que le nom d'équipe est unique
    const existing = await Team.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'Ce nom d\'équipe est déjà pris' });
    }

    const team = await Team.create({
      name: name.trim(),
      player1: {
        name: player1.name.trim(),
        email: player1.email.trim().toLowerCase(),
        phone: player1.phone?.trim() || '',
      },
      player2: {
        name: player2.name.trim(),
        email: player2.email.trim().toLowerCase(),
        phone: player2.phone?.trim() || '',
      },
    });

    res.status(201).json(team);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ce nom d\'équipe est déjà pris' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/teams — Liste de toutes les équipes (lecture publique)
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/teams/count — Nombre d'équipes inscrites (lecture publique)
router.get('/count', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    const tournament = await Tournament.findOne();
    res.json({ count, max: tournament?.maxTeams || 100 });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/teams/:id — Détail d'une équipe
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/teams/:id — Supprimer une équipe (admin uniquement)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });

    // On ne peut supprimer que pendant la phase d'inscription
    const tournament = await Tournament.findOne();
    if (tournament?.status !== 'registration') {
      return res.status(400).json({ error: 'Impossible de supprimer une équipe après le début du tournoi' });
    }

    await team.deleteOne();
    res.json({ message: 'Équipe supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
