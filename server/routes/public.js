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

// ─── GET /api/public/config ───────────────────────────────────────────────────
// Infos de base du tournoi — SANS auth (clé API non requise).
// Utilisé par la vue joueur pour afficher le nom/statut sans exposer la clé.

router.get('/config', async (req, res) => {
  try {
    const tournament = await Tournament.findOne()
      .select('name status date location')
      .lean();
    if (!tournament) return res.json({ name: null, status: null });

    res.json({
      name:     tournament.name,
      status:   tournament.status,
      date:     tournament.date   || null,
      location: tournament.location || null,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/document/schedule/preview ───────────────────────────────
// Aperçu du fichier horaires depuis MongoDB (sans clé API).
// Excel/ODS → { exists: true, type: 'excel', headers, rows }
// PDF       → { exists: true, type: 'pdf', url }
// Absent    → { exists: false }

router.get('/document/schedule/preview', async (req, res) => {
  try {
    const tournament = await Tournament.findOne()
      .select('+documents.schedule.data documents.schedule.filename documents.schedule.contentType')
      .lean();
    const doc = tournament?.documents?.schedule;
    if (!doc?.data) return res.json({ exists: false });

    const isPdf = doc.filename?.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return res.json({ exists: true, type: 'pdf', url: '/api/public/document/schedule' });
    }

    // Excel / ODS → SheetJS lit le buffer directement
    const XLSX   = require('xlsx');
    const buffer = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data);
    const wb     = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const data   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const rows   = data.filter(r => r.some(c => c !== '' && c != null));
    return res.json({ exists: true, type: 'excel', headers: rows[0] || [], rows: rows.slice(1) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/public/document/:type ──────────────────────────────────────────
// Sert le document depuis MongoDB (sans clé API).
// ?info=1 → retourne les métadonnées JSON au lieu du fichier.

router.get('/document/:type', async (req, res) => {
  const ALLOWED = ['rules', 'schedule'];
  const { type } = req.params;
  if (!ALLOWED.includes(type)) {
    return res.status(400).json({ error: 'Type invalide' });
  }
  try {
    if (req.query.info) {
      // Métadonnées seulement — pas de buffer
      const tournament = await Tournament.findOne()
        .select(`documents.${type}.filename documents.${type}.contentType documents.${type}.uploadedAt`)
        .lean();
      const doc = tournament?.documents?.[type];
      if (!doc?.filename) return res.json({ exists: false });
      return res.json({ exists: true, filename: doc.filename, updatedAt: doc.uploadedAt });
    }

    // Servir le fichier — inclure le buffer (select: false par défaut)
    const tournament = await Tournament.findOne()
      .select(`+documents.${type}.data documents.${type}.contentType documents.${type}.filename`)
      .lean();
    const doc = tournament?.documents?.[type];
    if (!doc?.data) return res.status(404).json({ error: 'Document non disponible' });

    const buffer = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data);
    res.set('Content-Type', doc.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.send(buffer);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
      .populate('teams', 'name player1 player2 country tournamentPath teamNumber')
      .select('-__v')
      .sort({ name: 1 })
      .lean();

    const tiebreaker = tournament.qualificationRules?.tiebreaker ||
      ['wins', 'gameDiff', 'gamesWon', 'directConfrontation'];

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
      .populate('teams', 'name player1 player2 country tournamentPath teamNumber')
      .select('-__v')
      .lean();
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    const populatedMatches = await Match.find({ _id: { $in: group.matches } })
      .populate('team1',  'name player1 player2 teamNumber')
      .populate('team2',  'name player1 player2 teamNumber')
      .populate('winner', 'name')
      .select('-__v -setFormat')
      .lean();

    const tiebreaker = tournament.qualificationRules?.tiebreaker ||
      ['wins', 'gameDiff', 'gamesWon', 'directConfrontation'];
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
      .populate('team1',  'name player1 player2 country teamNumber')
      .populate('team2',  'name player1 player2 country teamNumber')
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
      .populate('team1',  'name player1 player2 country teamNumber')
      .populate('team2',  'name player1 player2 country teamNumber')
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
