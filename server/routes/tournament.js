const express = require('express');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { generateGroups, calculateGroupStandings } = require('../utils/groupGenerator');
const { generateBracket, determineQualifiers, calculateBracketSize, advanceWinner } = require('../utils/bracketGenerator');

const router = express.Router();

// ─── LECTURE PUBLIQUE ────────────────────────────────────────────────────────

// GET /api/tournament — État général du tournoi
router.get('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne()
      .populate('qualifiedTeamIds', 'name player1 player2')
      .populate('consolationTeamIds', 'name player1 player2')
      .populate('championId', 'name player1 player2')
      .populate('consolationChampionId', 'name player1 player2');

    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/tournament/groups — Poules avec équipes et matchs
router.get('/groups', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    // Récupérer toutes les équipes d'un coup pour éviter les N+1 queries
    const teams = await Team.find();
    const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

    // Enrichir les groupes avec les données des équipes et le classement
    const enrichedGroups = tournament.groups.map(group => {
      const standings = calculateGroupStandings(group, teamMap);
      return {
        name: group.name,
        teams: group.teamIds.map(id => teamMap.get(id.toString())),
        matches: group.matches.map(match => ({
          _id: match._id,
          team1: teamMap.get(match.team1Id.toString()),
          team2: teamMap.get(match.team2Id.toString()),
          sets: match.sets,
          winner: match.winnerId ? teamMap.get(match.winnerId.toString()) : null,
          played: match.played,
        })),
        standings: standings.map((s, i) => ({
          position: i + 1,
          team: teamMap.get(s.teamId.toString()),
          ...s,
        })),
      };
    });

    res.json(enrichedGroups);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/tournament/bracket — Bracket principal
router.get('/bracket', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const teams = await Team.find();
    const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

    const enriched = tournament.knockoutMatches.map(m => ({
      _id: m._id,
      round: m.round,
      position: m.position,
      team1: m.team1Id ? teamMap.get(m.team1Id.toString()) : null,
      team2: m.team2Id ? teamMap.get(m.team2Id.toString()) : null,
      sets: m.sets,
      winner: m.winnerId ? teamMap.get(m.winnerId.toString()) : null,
      played: m.played,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/tournament/consolation — Bracket consolante
router.get('/consolation', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const teams = await Team.find();
    const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

    const enriched = tournament.consolationMatches.map(m => ({
      _id: m._id,
      round: m.round,
      position: m.position,
      team1: m.team1Id ? teamMap.get(m.team1Id.toString()) : null,
      team2: m.team2Id ? teamMap.get(m.team2Id.toString()) : null,
      sets: m.sets,
      winner: m.winnerId ? teamMap.get(m.winnerId.toString()) : null,
      played: m.played,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── ACTIONS ADMIN ───────────────────────────────────────────────────────────

// POST /api/tournament/init — Créer le tournoi initial (super_admin uniquement)
router.post('/init', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const existing = await Tournament.findOne();
    if (existing) return res.status(409).json({ error: 'Un tournoi existe déjà' });

    const tournament = await Tournament.create({
      name: req.body.name || 'Tournoi Paris Yaar Club',
      maxTeams: 100,
      status: 'registration',
    });

    res.status(201).json(tournament);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tournament/generate-groups — Tirage au sort et génération des poules
router.post('/generate-groups', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });
    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Les poules ne peuvent être générées que pendant la phase d\'inscription' });
    }

    const teams = await Team.find();
    if (teams.length < 4) {
      return res.status(400).json({ error: 'Il faut au moins 4 équipes pour générer des poules' });
    }

    const teamIds = teams.map(t => t._id);
    const groups = generateGroups(teamIds);

    // Mettre à jour chaque équipe avec son groupe
    for (const group of groups) {
      await Team.updateMany(
        { _id: { $in: group.teamIds } },
        { $set: { groupName: group.name, phase: 'group' } }
      );
    }

    tournament.groups = groups;
    tournament.status = 'group_stage';
    await tournament.save();

    res.json({ message: `${groups.length} poules générées`, groups: groups.map(g => g.name) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// PUT /api/tournament/matches/:matchId/score — Saisir le score d'un match de poule
router.put('/matches/:matchId/score', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sets } = req.body;
    // sets = [{ score1: 6, score2: 3 }, { score1: 4, score2: 6 }, { score1: 7, score2: 5 }]

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      return res.status(400).json({ error: 'Il faut au moins un set' });
    }
    if (sets.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 sets en padel' });
    }

    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    // Trouver le match dans les groupes
    let found = false;
    for (const group of tournament.groups) {
      const match = group.matches.id(req.params.matchId);
      if (match) {
        // Calculer le gagnant d'après les sets
        let wins1 = 0, wins2 = 0;
        for (const set of sets) {
          if (set.score1 > set.score2) wins1++;
          else if (set.score2 > set.score1) wins2++;
        }

        if (wins1 === wins2) {
          return res.status(400).json({ error: 'Le score doit désigner un gagnant (pas d\'égalité en padel)' });
        }

        match.sets = sets;
        match.winnerId = wins1 > wins2 ? match.team1Id : match.team2Id;
        match.played = true;

        // Mettre à jour les stats de l'équipe directement sur le modèle Team
        await updateTeamStats(group, tournament.groups);

        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Match introuvable' });
    }

    await tournament.save();
    res.json({ message: 'Score enregistré' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tournament/generate-bracket — Clôturer les poules et générer les brackets
router.post('/generate-bracket', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });
    if (tournament.status !== 'group_stage') {
      return res.status(400).json({ error: 'Le tournoi n\'est pas en phase de poule' });
    }

    // Vérifier que tous les matchs de poule sont joués
    const allPlayed = tournament.groups.every(g =>
      g.matches.every(m => m.played)
    );
    if (!allPlayed) {
      return res.status(400).json({ error: 'Tous les matchs de poule doivent être joués avant de générer les brackets' });
    }

    // Calculer les classements dans chaque groupe
    const teams = await Team.find();
    const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

    const groupsWithStandings = tournament.groups.map(group => ({
      ...group.toObject(),
      standings: calculateGroupStandings(group, teamMap),
    }));

    // Déterminer la taille du bracket selon l'option C
    const totalTeams = teams.length;
    const bracketSize = calculateBracketSize(totalTeams);

    // Qualifier les équipes et séparer les consolants
    const { qualifiedIds, consolationIds } = determineQualifiers(groupsWithStandings, bracketSize);

    // Générer les deux brackets
    const knockoutMatches = generateBracket(qualifiedIds);
    const consolationMatches = consolationIds.length >= 2 ? generateBracket(consolationIds) : [];

    // Mettre à jour les équipes
    await Team.updateMany({ _id: { $in: qualifiedIds } }, { $set: { phase: 'knockout' } });
    await Team.updateMany({ _id: { $in: consolationIds } }, { $set: { phase: 'consolation' } });

    tournament.qualifiedTeamIds = qualifiedIds;
    tournament.consolationTeamIds = consolationIds;
    tournament.knockoutMatches = knockoutMatches;
    tournament.consolationMatches = consolationMatches;
    tournament.status = 'knockout';
    await tournament.save();

    res.json({
      message: 'Brackets générés',
      bracketSize,
      qualified: qualifiedIds.length,
      consolation: consolationIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// PUT /api/tournament/bracket/:matchId/score — Saisir score d'un match de bracket principal
router.put('/bracket/:matchId/score', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sets } = req.body;
    if (!sets || sets.length === 0) return res.status(400).json({ error: 'Sets requis' });

    const tournament = await Tournament.findOne();
    const match = tournament.knockoutMatches.id(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match introuvable' });

    let wins1 = 0, wins2 = 0;
    for (const set of sets) {
      if (set.score1 > set.score2) wins1++;
      else if (set.score2 > set.score1) wins2++;
    }
    if (wins1 === wins2) return res.status(400).json({ error: 'Pas d\'égalité possible' });

    match.sets = sets;
    match.winnerId = wins1 > wins2 ? match.team1Id : match.team2Id;
    match.played = true;

    // Avancer le gagnant au match suivant
    tournament.knockoutMatches = advanceWinner(
      tournament.knockoutMatches.toObject ? tournament.knockoutMatches.toObject() : [...tournament.knockoutMatches],
      match.toObject ? match.toObject() : match
    );

    // Vérifier si c'est la finale
    const maxRound = Math.max(...tournament.knockoutMatches.map(m => m.round));
    if (match.round === maxRound) {
      tournament.championId = match.winnerId;
    }

    await tournament.save();
    res.json({ message: 'Score enregistré', winnerId: match.winnerId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/tournament/consolation/:matchId/score — Score bracket consolante
router.put('/consolation/:matchId/score', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sets } = req.body;
    if (!sets || sets.length === 0) return res.status(400).json({ error: 'Sets requis' });

    const tournament = await Tournament.findOne();
    const match = tournament.consolationMatches.id(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match introuvable' });

    let wins1 = 0, wins2 = 0;
    for (const set of sets) {
      if (set.score1 > set.score2) wins1++;
      else if (set.score2 > set.score1) wins2++;
    }
    if (wins1 === wins2) return res.status(400).json({ error: 'Pas d\'égalité possible' });

    match.sets = sets;
    match.winnerId = wins1 > wins2 ? match.team1Id : match.team2Id;
    match.played = true;

    tournament.consolationMatches = advanceWinner(
      tournament.consolationMatches.toObject ? tournament.consolationMatches.toObject() : [...tournament.consolationMatches],
      match.toObject ? match.toObject() : match
    );

    const maxRound = Math.max(...tournament.consolationMatches.map(m => m.round));
    if (match.round === maxRound) {
      tournament.consolationChampionId = match.winnerId;
    }

    await tournament.save();
    res.json({ message: 'Score enregistré', winnerId: match.winnerId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── HELPER ──────────────────────────────────────────────────────────────────

// Met à jour les stats des équipes sur le modèle Team (appelé après chaque score de poule)
async function updateTeamStats(group, allGroups) {
  // Recalculer les stats de toutes les équipes du groupe
  const stats = {};
  for (const teamId of group.teamIds) {
    stats[teamId.toString()] = { played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, points: 0 };
  }

  for (const match of group.matches) {
    if (!match.played || !match.winnerId) continue;
    const id1 = match.team1Id.toString();
    const id2 = match.team2Id.toString();
    let s1 = 0, s2 = 0;
    for (const set of match.sets) {
      if (set.score1 > set.score2) s1++; else if (set.score2 > set.score1) s2++;
    }
    if (stats[id1]) {
      stats[id1].played++; stats[id1].setsFor += s1; stats[id1].setsAgainst += s2;
      if (match.winnerId.toString() === id1) { stats[id1].won++; stats[id1].points += 3; }
      else stats[id1].lost++;
    }
    if (stats[id2]) {
      stats[id2].played++; stats[id2].setsFor += s2; stats[id2].setsAgainst += s1;
      if (match.winnerId.toString() === id2) { stats[id2].won++; stats[id2].points += 3; }
      else stats[id2].lost++;
    }
  }

  for (const [teamId, s] of Object.entries(stats)) {
    await Team.findByIdAndUpdate(teamId, { $set: { stats: s } });
  }
}

module.exports = router;
