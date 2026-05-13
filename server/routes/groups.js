const express = require('express');
const Tournament      = require('../models/Tournament');
const Team            = require('../models/Team');
const Group           = require('../models/Group');
const Match           = require('../models/Match');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { computeStandings }          = require('../utils/standings');
const { distributeTeams, calcNumGroups, roundRobinSchedule } = require('../utils/draw');
const validateObjectId              = require('../middleware/validateObjectId');
const safeError                     = require('../utils/safeError');

const router = express.Router();

// Toutes les routes groupes sont réservées aux admins
router.use(requireAuth, requireAdmin);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// roundRobinPairs remplacé par roundRobinSchedule (draw.js) — ordre par rounds de Berger

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
      ['wins', 'gameDiff', 'gamesWon', 'directConfrontation'];

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

    // Sélectionner les équipes selon la phase.
    // consolante_pool : équipes qui ont fait les poules principales mais n'ont PAS été qualifiées
    // (tournamentPath=null : pas encore 'main', pas déjà 'consolante' ou 'eliminated')
    const teams = phase === 'pool'
      ? await Team.find({ group: null })
      : await Team.find({ group: { $ne: null }, tournamentPath: null });

    if (teams.length < 4) {
      return res.status(400).json({
        error: `Pas assez d'équipes éligibles (minimum 4, trouvé ${teams.length})`,
      });
    }

    // Pour consolante_pool : sauvegarder bracketTarget dans consolanteQualificationRules
    if (phase === 'consolante_pool' && req.body.bracketTarget) {
      const bt = parseInt(req.body.bracketTarget, 10);
      if ([4, 8, 16, 32].includes(bt)) {
        await require('../models/Tournament').findOneAndUpdate(
          {},
          { $set: { 'consolanteQualificationRules.bracketTarget': bt } }
        );
      }
    }

    // Calcul du nombre de groupes
    let { groupSize, numGroups } = req.body;
    let numG;
    if (numGroups) {
      numG = parseInt(numGroups, 10);
    } else {
      const targetSize = groupSize ? parseInt(groupSize, 10) : (teams.length <= 20 ? 4 : 5);
      if (targetSize < 3) {
        return res.status(400).json({ error: 'groupSize minimum : 3' });
      }
      numG = calcNumGroups(teams.length, targetSize);
    }

    if (numG < 1) {
      return res.status(400).json({ error: 'Impossible de créer des groupes avec ces paramètres' });
    }

    // Vérifier que chaque groupe aura au moins 3 équipes
    const minTeamsPerGroup = Math.floor(teams.length / numG);
    if (minTeamsPerGroup < 3) {
      return res.status(400).json({
        error: `Trop peu d'équipes pour ${numG} groupes (minimum 3 par groupe, vous auriez ${minTeamsPerGroup})`,
      });
    }

    // Distribution par pays en serpentin (garantit dispersion pays + aucun groupe < floor(n/numG))
    const groupSlices = distributeTeams(teams, numG);

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

      // Créer les matchs round-robin — ordre de Berger (aucune équipe 2x dans un round)
      const pairs = roundRobinSchedule(slice.teams.length).flat();
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

      // Mettre à jour team.group pour chaque équipe du groupe.
      // Pour consolante_pool : assigner aussi tournamentPath='consolante'
      const teamUpdate = { group: group._id };
      if (phase === 'consolante_pool') teamUpdate.tournamentPath = 'consolante';
      await Team.updateMany(
        { _id: { $in: slice.teams.map(t => t._id) } },
        { $set: teamUpdate }
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

// ─── PATCH /api/groups/:id/match-order ───────────────────────────────────────
// Réordonne les matchs d'un groupe (pour l'ordre d'affichage sur le terrain).
// Body : { matchIds: [id1, id2, ...] } — doit contenir exactement les mêmes IDs que group.matches.

router.patch('/:id/match-order', validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    const { matchIds } = req.body;
    if (!Array.isArray(matchIds)) {
      return res.status(400).json({ error: 'matchIds doit être un tableau' });
    }

    // Vérifier que les IDs sont exactement les mêmes (pas d'ajout / suppression)
    const existing = group.matches.map(id => String(id)).sort();
    const provided = [...matchIds].map(String).sort();
    if (JSON.stringify(existing) !== JSON.stringify(provided)) {
      return res.status(400).json({
        error: 'matchIds doit contenir exactement les mêmes matchs que le groupe',
      });
    }

    group.matches = matchIds;
    await group.save();

    res.json({ message: 'Ordre des matchs mis à jour', matchIds });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
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
