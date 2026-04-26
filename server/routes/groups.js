const express = require('express');
const Tournament      = require('../models/Tournament');
const Team            = require('../models/Team');
const Group           = require('../models/Group');
const Match           = require('../models/Match');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { computeStandings }          = require('../utils/standings');
const validateObjectId              = require('../middleware/validateObjectId');
const safeError                     = require('../utils/safeError');

const router = express.Router();

// Toutes les routes groupes sont réservées aux admins
router.use(requireAuth, requireAdmin);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Génère toutes les paires round-robin pour N équipes
// Retourne un tableau de [idxA, idxB]
function roundRobinPairs(n) {
  const pairs = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

// ─── GET /api/groups ──────────────────────────────────────────────────────────
// Lister tous les groupes. Filtre optionnel : ?phase=pool

router.get('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const filter = { tournament: tournament._id };
    if (req.query.phase) filter.phase = req.query.phase;

    const groups = await Group.find(filter)
      .populate('teams', 'name player1 player2 country tournamentPath')
      .sort({ name: 1 });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/groups/:id ──────────────────────────────────────────────────────
// Détail d'un groupe avec matchs et classement calculé en live.

router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const group = await Group.findById(req.params.id)
      .populate('teams', 'name player1 player2 country tournamentPath');
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    // Matchs bruts pour le calcul des standings (team1/team2 = ObjectIds)
    const rawMatches = await Match.find({ _id: { $in: group.matches } });

    // Matchs enrichis pour la réponse (équipes populées)
    const matches = await Match.find({ _id: { $in: group.matches } })
      .populate('team1',  'name player1 player2')
      .populate('team2',  'name player1 player2')
      .populate('winner', 'name');

    const tiebreaker = tournament.qualificationRules?.tiebreaker ||
      ['points', 'setDiff', 'setsWon', 'directConfrontation'];

    const raw = computeStandings(group.teams.map(t => t._id), rawMatches, tiebreaker);

    // Enrichir les standings avec les données de chaque équipe
    const teamMap = new Map(group.teams.map(t => [String(t._id), t]));
    const standings = raw.map(s => ({ ...s, team: teamMap.get(String(s.teamId)) }));

    res.json({ ...group.toObject(), matches, standings });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── POST /api/groups/draw ────────────────────────────────────────────────────
// Tirage au sort : crée les Group docs + Match docs round-robin.
// Body : { phase?: 'pool'|'consolante_pool', groupSize?: number, numGroups?: number }
// - phase 'pool'          → équipes sans groupe (team.group = null)
// - phase 'consolante_pool' → équipes avec tournamentPath = 'consolante'

router.post('/draw', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const phase = req.body.phase || 'pool';
    if (!['pool', 'consolante_pool'].includes(phase)) {
      return res.status(400).json({ error: 'phase invalide : "pool" ou "consolante_pool"' });
    }

    // Bloquer si des groupes existent déjà pour cette phase
    const existing = await Group.countDocuments({ tournament: tournament._id, phase });
    if (existing > 0) {
      return res.status(409).json({
        error: `Des groupes existent déjà pour la phase "${phase}". Utilisez POST /api/groups/regenerate pour recommencer.`,
      });
    }

    // Sélectionner les équipes selon la phase
    const teams = phase === 'pool'
      ? await Team.find({ group: null })
      : await Team.find({ tournamentPath: 'consolante' });

    if (teams.length < 4) {
      return res.status(400).json({
        error: `Pas assez d'équipes éligibles (minimum 4, trouvé ${teams.length})`,
      });
    }

    // Calcul de la taille des groupes
    let { groupSize, numGroups } = req.body;
    if (!groupSize && !numGroups) {
      groupSize = teams.length <= 20 ? 4 : 5;
    }
    if (numGroups && !groupSize) {
      groupSize = Math.ceil(teams.length / numGroups);
    }
    groupSize = parseInt(groupSize, 10);
    if (groupSize < 3) {
      return res.status(400).json({ error: 'groupSize minimum : 3' });
    }

    // Mélange aléatoire
    const shuffled = shuffle(teams);

    // Distribution en tranches de groupSize (le dernier groupe prend le reste)
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const groupSlices = [];
    for (let i = 0, g = 0; i < shuffled.length; i += groupSize, g++) {
      groupSlices.push({ letter: LETTERS[g] || `G${g + 1}`, teams: shuffled.slice(i, i + groupSize) });
    }

    // Détection des conflits pays (warn, jamais bloquant).
    // Comparaison normalisée : toLowerCase().trim() pour gérer "Paris" vs "paris", etc.
    const countryWarnings = [];
    for (const slice of groupSlices) {
      const seen = {};
      for (const team of slice.teams) {
        const key = team.country?.toLowerCase().trim();
        if (!key) continue;
        if (seen[key]) {
          countryWarnings.push(
            `Groupe ${slice.letter} : "${team.name}" et "${seen[key]}" ont le même pays/ville (${team.country})`
          );
        } else {
          seen[key] = team.name;
        }
      }
    }

    // Format de set à copier sur chaque match
    const setFormat = phase === 'pool'
      ? tournament.poolStageFormat
      : tournament.consolantePoolFormat;

    // Création des groupes et matchs en base
    const matchPhase = phase === 'pool' ? 'pool' : 'consolante_pool';
    const createdGroups = [];

    for (const slice of groupSlices) {
      // Créer le groupe
      const group = await Group.create({
        name: slice.letter,
        tournament: tournament._id,
        phase,
        teams: slice.teams.map(t => t._id),
      });

      // Créer les matchs round-robin
      const pairs = roundRobinPairs(slice.teams.length);
      const matchIds = [];

      for (const [i, j] of pairs) {
        const match = await Match.create({
          tournament: tournament._id,
          phase: matchPhase,
          team1: slice.teams[i]._id,
          team2: slice.teams[j]._id,
          setFormat: setFormat || {},
        });
        matchIds.push(match._id);
      }

      // Sauvegarder les matchs dans le groupe
      group.matches = matchIds;
      await group.save();

      // Mettre à jour team.group pour chaque équipe du groupe
      await Team.updateMany(
        { _id: { $in: slice.teams.map(t => t._id) } },
        { $set: { group: group._id } }
      );

      createdGroups.push({
        groupId:    group._id,
        name:       group.name,
        teamCount:  slice.teams.length,
        matchCount: matchIds.length,
      });
    }

    const totalMatches = createdGroups.reduce((s, g) => s + g.matchCount, 0);
    const response = {
      message: `${createdGroups.length} groupe(s) créé(s), ${totalMatches} matchs générés`,
      groups: createdGroups,
    };
    if (countryWarnings.length > 0) response.warnings = countryWarnings;

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── POST /api/groups/regenerate ─────────────────────────────────────────────
// Supprime tous les groupes d'une phase + leurs matchs + reset team.group.
// Renvoie un message invitant à relancer POST /api/groups/draw.
// Body : { confirm: true, phase?: 'pool'|'consolante_pool' }

router.post('/regenerate', async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({
        error: 'Envoyez { confirm: true } pour confirmer la suppression du tirage existant',
      });
    }

    const phase = req.body.phase || 'pool';
    if (!['pool', 'consolante_pool'].includes(phase)) {
      return res.status(400).json({ error: 'phase invalide : "pool" ou "consolante_pool"' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const groups = await Group.find({ tournament: tournament._id, phase });
    if (groups.length === 0) {
      return res.status(404).json({ error: `Aucun groupe trouvé pour la phase "${phase}"` });
    }

    const allMatchIds = groups.flatMap(g => g.matches);
    const allTeamIds  = groups.flatMap(g => g.teams);

    // Supprimer les matchs
    const { deletedCount: deletedMatches } = await Match.deleteMany({ _id: { $in: allMatchIds } });

    // Réinitialiser team.group
    await Team.updateMany({ _id: { $in: allTeamIds } }, { $set: { group: null } });

    // Supprimer les groupes
    await Group.deleteMany({ tournament: tournament._id, phase });

    res.json({
      message: `Tirage supprimé. Lancez POST /api/groups/draw pour recommencer.`,
      deletedGroups:  groups.length,
      deletedMatches,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────
// Supprimer un groupe manuellement (et tous ses matchs).

router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    await Match.deleteMany({ _id: { $in: group.matches } });
    await Team.updateMany({ _id: { $in: group.teams } }, { $set: { group: null } });
    await group.deleteOne();

    res.json({ message: 'Groupe supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
