const express = require('express');
const Tournament      = require('../models/Tournament');
const Group           = require('../models/Group');
const Match           = require('../models/Match');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateObjectId              = require('../middleware/validateObjectId');
const safeError                     = require('../utils/safeError');

const router = express.Router();

// Toutes les routes matchs sont réservées aux admins
router.use(requireAuth, requireAdmin);

// ─── HELPER : propagation du winner dans le bracket ──────────────────────────
//
// Quand un match knockout est joué, le winner est automatiquement placé dans
// le slot correspondant du match suivant (même tournoi, round suivant).
//
// Logique de position :
//   - match position P → next match position Math.ceil(P / 2)
//   - P impair  → slot team1 ; P pair → slot team2

const NEXT_PHASE = {
  'r32':              'r16',
  'r16':              'qf',
  'qf':               'sf',
  'sf':               'final',
  'consolante_r32':   'consolante_r16',
  'consolante_r16':   'consolante_qf',
  'consolante_qf':    'consolante_sf',
  'consolante_sf':    'consolante_final',
};

async function propagateWinner(match) {
  const nextPhase = NEXT_PHASE[match.phase];
  if (!nextPhase || !match.winner || match.position == null) return;

  const nextPosition = Math.ceil(match.position / 2);
  const slot = match.position % 2 === 1 ? 'team1' : 'team2';

  await Match.findOneAndUpdate(
    { tournament: match.tournament, phase: nextPhase, position: nextPosition },
    { $set: { [slot]: match.winner } }
  );
}

// ─── GET /api/matches ─────────────────────────────────────────────────────────
// Lister des matchs.
// Filtres query : ?phase=pool, ?groupId=xxx, ?played=true|false

router.get('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const filter = { tournament: tournament._id };

    if (req.query.phase) filter.phase = req.query.phase;
    if (req.query.played !== undefined) filter.played = req.query.played === 'true';

    // Filtre par groupe : retrouver les matchs via Group.matches
    if (req.query.groupId) {
      const group = await Group.findById(req.query.groupId);
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      filter._id = { $in: group.matches };
    }

    const matches = await Match.find(filter)
      .populate('team1',  'name player1 player2 country')
      .populate('team2',  'name player1 player2 country')
      .populate('winner', 'name')
      .sort({ position: 1, createdAt: 1 });

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/matches/:id ─────────────────────────────────────────────────────
// Détail d'un match avec équipes populées.

router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1',      'name player1 player2 country')
      .populate('team2',      'name player1 player2 country')
      .populate('winner',     'name')
      .populate('tournament', 'name');

    if (!match) return res.status(404).json({ error: 'Match introuvable' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /api/matches/:id/score ───────────────────────────────────────────────
// Saisir ou corriger le score d'un match.
// Body : { sets: [{ score1, score2 }, ...], result?: 'draw' }
//
// - Si result === 'draw' est passé explicitement → winner = null
// - Sinon → winner calculé depuis les sets (celui qui en gagne le plus)
// - Corrigeable autant de fois que nécessaire (winner recalculé à chaque appel)
// - Si phase knockout et winner présent → propagation au match suivant

router.put('/:id/score', validateObjectId, async (req, res) => {
  try {
    const { sets, result: forcedResult } = req.body;

    if (!Array.isArray(sets) || sets.length === 0) {
      return res.status(400).json({ error: '"sets" est requis et ne peut pas être vide' });
    }

    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      if (s.score1 == null || s.score2 == null || s.score1 < 0 || s.score2 < 0) {
        return res.status(400).json({ error: `Set ${i + 1} : score1 et score2 doivent être des entiers >= 0` });
      }
    }

    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match introuvable' });

    // Calcul du résultat et du winner
    let result, winner;

    if (forcedResult === 'draw') {
      result = 'draw';
      winner = null;
    } else {
      let wins1 = 0, wins2 = 0;
      for (const s of sets) {
        if (s.score1 > s.score2) wins1++;
        else if (s.score2 > s.score1) wins2++;
      }

      if (wins1 === wins2) {
        return res.status(400).json({
          error: 'Égalité de sets : utilisez { result: "draw" } si vous voulez forcer un nul, sinon corrigez les scores',
        });
      }

      result = wins1 > wins2 ? 'team1' : 'team2';
      winner = wins1 > wins2 ? match.team1 : match.team2;
    }

    match.sets   = sets;
    match.result = result;
    match.winner = winner;
    match.played = true;
    await match.save();

    // Propagation bracket (phases knockout uniquement)
    if (NEXT_PHASE[match.phase]) {
      await propagateWinner(match);
    }

    const populated = await Match.findById(match._id)
      .populate('team1',  'name player1 player2')
      .populate('team2',  'name player1 player2')
      .populate('winner', 'name');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── PUT /api/matches/:id ─────────────────────────────────────────────────────
// Modifier la planification d'un match : scheduledAt et/ou courtNumber.
// Body : { scheduledAt?: ISO date string, courtNumber?: number }

router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const { scheduledAt, courtNumber } = req.body;

    if (scheduledAt === undefined && courtNumber === undefined) {
      return res.status(400).json({ error: 'Fournissez au moins scheduledAt ou courtNumber' });
    }

    const updates = {};
    if (scheduledAt !== undefined) updates.scheduledAt  = scheduledAt ? new Date(scheduledAt) : null;
    if (courtNumber !== undefined) updates.courtNumber  = courtNumber;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('team1', 'name').populate('team2', 'name');

    if (!match) return res.status(404).json({ error: 'Match introuvable' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── DELETE /api/matches/:id/score ────────────────────────────────────────────
// Effacer le score d'un match : remet played à false, vide sets/result/winner.
// Utile pour corriger une erreur de saisie sur un match de poule.
// Attention : si c'est un match knockout, le winner est retiré du match suivant.

router.delete('/:id/score', validateObjectId, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match introuvable' });

    const hadWinner = match.winner;

    match.sets   = [];
    match.result = null;
    match.winner = null;
    match.played = false;
    await match.save();

    // Si knockout : retirer le winner du slot du match suivant
    let warning = null;
    if (NEXT_PHASE[match.phase] && hadWinner && match.position != null) {
      const nextPhase    = NEXT_PHASE[match.phase];
      const nextPosition = Math.ceil(match.position / 2);
      const slot         = match.position % 2 === 1 ? 'team1' : 'team2';

      const nextMatch = await Match.findOne({
        tournament: match.tournament,
        phase:      nextPhase,
        position:   nextPosition,
      });

      if (nextMatch) {
        if (nextMatch.played) {
          warning = `Le match suivant (${nextPhase} position ${nextPosition}) est déjà joué — son score n'a pas été modifié. Corrigez-le manuellement.`;
        } else {
          await Match.findByIdAndUpdate(nextMatch._id, { $set: { [slot]: null } });
        }
      }
    }

    res.json({ message: 'Score effacé', warning: warning || undefined });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

module.exports = router;
