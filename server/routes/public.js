const express    = require('express');
const rateLimit  = require('express-rate-limit');
const mongoose   = require('mongoose');
const Tournament = require('../models/Tournament');
const Team       = require('../models/Team');
const Group      = require('../models/Group');
const Match      = require('../models/Match');
const { computeStandings } = require('../utils/standings');

const router = express.Router();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// Rate limiting : 100 requêtes par minute par IP
const limiter = rateLimit({
  windowMs:        60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests, please try again later' },
});

// Vérification de la clé API dans le header x-api-key.
// Option B : clé DB en priorité, fallback sur process.env.API_KEY.
// Réponse volontairement vague pour ne pas aider un attaquant.
const apiKeyAuth = async (req, res, next) => {
  try {
    const key = req.headers['x-api-key'];
    if (!key) return res.status(401).json({ error: 'Unauthorized' });

    const tournament = await Tournament.findOne().select('apiKey').lean();
    const validKey   = tournament?.apiKey || process.env.API_KEY;

    if (!validKey || key !== validKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  } catch {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

router.use(limiter);
router.use(apiKeyAuth);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Calcule les standings d'un groupe et les enrichit avec les données équipe.
async function enrichGroupWithStandings(group, tiebreaker) {
  const rawMatches = await Match.find({ _id: { $in: group.matches } }).lean();
  const teamIds    = group.teams.map(t => t._id);
  const raw        = computeStandings(teamIds, rawMatches, tiebreaker);
  const teamMap    = new Map(group.teams.map(t => [String(t._id), t]));
  return raw.map(s => ({ ...s, team: teamMap.get(String(s.teamId)) }));
}

// ─── GET /api/public/tournament ───────────────────────────────────────────────
// Infos générales du tournoi. Ne retourne jamais les données d'auth.

router.get('/tournament', async (req, res) => {
  try {
    const tournament = await Tournament.findOne().lean();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const teamCount = await Team.countDocuments();

    res.json({
      name:               tournament.name,
      status:             tournament.status,
      maxTeams:           tournament.maxTeams,
      currentPhase:       tournament.currentPhase,
      teamCount,
      qualificationRules: tournament.qualificationRules,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/teams ────────────────────────────────────────────────────
// Liste toutes les équipes inscrites.
// Exclut : notes (données internes), __v (version MongoDB).

router.get('/teams', async (req, res) => {
  try {
    const teams = await Team.find()
      .select('-notes -__v')
      .sort({ registeredAt: 1 })
      .lean();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/groups ───────────────────────────────────────────────────
// Liste tous les groupes avec standings calculés.
// Filtre optionnel : ?phase=pool|consolante_pool

router.get('/groups', async (req, res) => {
  try {
    const tournament = await Tournament.findOne().lean();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const filter = { tournament: tournament._id };
    if (req.query.phase) filter.phase = req.query.phase;

    const groups = await Group.find(filter)
      .populate('teams', 'name player1 player2 country tournamentPath')
      .select('-__v')
      .sort({ name: 1 })
      .lean();

    const tiebreaker = tournament.qualificationRules?.tiebreaker ||
      ['points', 'setDiff', 'setsWon', 'directConfrontation'];

    const enriched = await Promise.all(groups.map(async group => {
      const standings = await enrichGroupWithStandings(group, tiebreaker);
      return {
        _id:      group._id,
        name:     group.name,
        phase:    group.phase,
        teams:    group.teams,
        standings,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/groups/:id ───────────────────────────────────────────────
// Détail d'un groupe avec matchs et standings.

router.get('/groups/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const tournament = await Tournament.findOne().lean();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const group = await Group.findById(req.params.id)
      .populate('teams', 'name player1 player2 country tournamentPath')
      .select('-__v')
      .lean();
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    const populatedMatches = await Match.find({ _id: { $in: group.matches } })
      .populate('team1',  'name player1 player2')
      .populate('team2',  'name player1 player2')
      .populate('winner', 'name')
      .select('-__v -setFormat')
      .lean();

    const tiebreaker = tournament.qualificationRules?.tiebreaker ||
      ['points', 'setDiff', 'setsWon', 'directConfrontation'];
    const standings = await enrichGroupWithStandings(group, tiebreaker);

    res.json({
      _id:      group._id,
      name:     group.name,
      phase:    group.phase,
      teams:    group.teams,
      matches:  populatedMatches,
      standings,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/bracket ──────────────────────────────────────────────────
// Bracket principal groupé par phase.

router.get('/bracket', async (req, res) => {
  try {
    const tournament = await Tournament.findOne().lean();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const phases = ['r32', 'r16', 'qf', 'sf', 'final'];
    const matches = await Match.find({
      tournament: tournament._id,
      phase:      { $in: phases },
    })
      .populate('team1',  'name player1 player2 country')
      .populate('team2',  'name player1 player2 country')
      .populate('winner', 'name')
      .select('-__v -setFormat')
      .sort({ position: 1 })
      .lean();

    const result = {};
    for (const phase of phases) {
      const list = matches.filter(m => m.phase === phase);
      if (list.length > 0) result[phase] = list;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/bracket/consolante ──────────────────────────────────────
// Bracket consolante groupé par phase.

router.get('/bracket/consolante', async (req, res) => {
  try {
    const tournament = await Tournament.findOne().lean();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const phases = [
      'consolante_r32', 'consolante_r16',
      'consolante_qf',  'consolante_sf',  'consolante_final',
    ];
    const matches = await Match.find({
      tournament: tournament._id,
      phase:      { $in: phases },
    })
      .populate('team1',  'name player1 player2 country')
      .populate('team2',  'name player1 player2 country')
      .populate('winner', 'name')
      .select('-__v -setFormat')
      .sort({ position: 1 })
      .lean();

    const result = {};
    for (const phase of phases) {
      const list = matches.filter(m => m.phase === phase);
      if (list.length > 0) result[phase] = list;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
