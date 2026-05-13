const express = require('express');
const Tournament = require('../models/Tournament');
const Team       = require('../models/Team');
const Group      = require('../models/Group');
const Match      = require('../models/Match');
const { requireAuth, requireAdmin }  = require('../middleware/auth');
const { computeStandings }           = require('../utils/standings');
const safeError                      = require('../utils/safeError');

const { computeSeeding } = require('../utils/seeding');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

// Séquences de phases pour chaque taille de bracket
const MAIN_PHASES = {
  4:  ['sf',                    'final'],
  8:  ['qf',  'sf',             'final'],
  16: ['r16', 'qf',  'sf',      'final'],
  32: ['r32', 'r16', 'qf', 'sf','final'],
  64: ['r64', 'r32', 'r16','qf','sf','final'],
};

const CONSOLANTE_PHASES = {
  4:  ['consolante_sf',                'consolante_final'],
  8:  ['consolante_qf',  'consolante_sf',   'consolante_final'],
  16: ['consolante_r16', 'consolante_qf',   'consolante_sf',  'consolante_final'],
  32: ['consolante_r32', 'consolante_r16',  'consolante_qf',  'consolante_sf',  'consolante_final'],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Taille minimale du bracket (puissance de 2) qui contient n équipes
function getBracketSize(n) {
  if (n <= 4)  return 4;
  if (n <= 8)  return 8;
  if (n <= 16) return 16;
  return 32;
}

// Ordre des seeds pour un bracket de taille size.
// Garantit que le seed 1 affronte le seed size, le seed 2 affronte size-1, etc.
// Résultat : tableau où slots[i] = numéro du seed qui occupe ce slot.
// Les slots vont par paires : (slots[0], slots[1]) = match pos 1, (slots[2], slots[3]) = match pos 2...
function getSeededSlots(size) {
  let slots = [1, 2];
  while (slots.length < size) {
    const n = slots.length * 2 + 1;
    slots = slots.flatMap(s => [s, n - s]);
  }
  return slots;
}

// setFormat à copier sur un match à sa création
function getSetFormat(phase, tournament) {
  const kf = tournament.knockoutFormat           || {};
  const cf = tournament.consolanteKnockoutFormat || {};
  return {
    qf:                kf.qf,
    sf:                kf.sf,
    final:             kf.final,
    consolante_qf:     cf.qf,
    consolante_sf:     cf.sf,
    consolante_final:  cf.final,
  }[phase] || {}; // r32/r16 → {} (Option C : configuré au lancement du round)
}

// Calcule la qualification depuis les poules d'une phase donnée.
// bracketTarget : taille du bracket cible (puissance de 2 : 8, 16, 32, 64).
// La logique est : qualifiedPerGroup = floor(bracketTarget / nbGroupes)
//                  wildcardSpots     = bracketTarget - (qualifiedPerGroup × nbGroupes)
//                  wildcardRank      = qualifiedPerGroup + 1
// → garantit EXACTEMENT bracketTarget qualifiés (0 BYE) si assez d'équipes.
// Retourne { qualified: [ObjectId, ...], consolante: [ObjectId, ...] }
async function computeQualification(tournament, poolPhase, bracketTarget) {
  const groups = await Group.find({
    tournament: tournament._id,
    phase: poolPhase,
  }).sort({ name: 1 });

  if (groups.length === 0) return { qualified: [], consolante: [], qualifiedMeta: [] };

  const tiebreaker = tournament.qualificationRules?.tiebreaker ??
    ['wins', 'gameDiff', 'gamesWon', 'directConfrontation'];

  const nbGroups      = groups.length;
  const qualPerGroup  = Math.floor(bracketTarget / nbGroups);
  const wildcardRank  = qualPerGroup + 1;
  // wildcardSpots de base : places non distribuées par la division entière
  const baseWildcards = bracketTarget - (qualPerGroup * nbGroups);

  const autoQualifiedIds   = new Set();
  const wildcardCandidates = [];
  let extraWildcards = 0;
  const metaMap = {}; // id → { id, group, rank } pour le seeding

  for (const group of groups) {
    const rawMatches = await Match.find({ _id: { $in: group.matches } });
    const standings  = computeStandings(group.teams, rawMatches, tiebreaker);
    const actualQual = Math.min(qualPerGroup, standings.length);
    extraWildcards  += qualPerGroup - actualQual;

    for (let i = 0; i < actualQual; i++) {
      const id = String(standings[i].teamId);
      autoQualifiedIds.add(id);
      metaMap[id] = { id, group: group.name, rank: i + 1 };
    }

    if (standings.length >= wildcardRank) {
      wildcardCandidates.push({ ...standings[wildcardRank - 1], groupName: group.name });
    }
  }

  const totalWildcards = baseWildcards + extraWildcards;

  wildcardCandidates.sort((a, b) => {
    for (const criterion of tiebreaker) {
      if (criterion === 'wins'     && b.won      !== a.won)      return b.won      - a.won;
      if (criterion === 'gameDiff' && b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (criterion === 'gamesWon' && b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      // Compatibilité descendante
      if (criterion === 'points'  && b.points   !== a.points)   return b.points   - a.points;
      if (criterion === 'setDiff' && b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (criterion === 'setsWon' && b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    }
    return 0;
  });

  const wildcardList = wildcardCandidates
    .slice(0, totalWildcards)
    .filter(c => !autoQualifiedIds.has(String(c.teamId)));

  const wildcardIds = wildcardList.map(c => String(c.teamId));
  wildcardList.forEach((c, i) => {
    const id = String(c.teamId);
    metaMap[id] = { id, group: c.groupName, rank: wildcardRank + i };
  });

  const qualifiedIds = [...autoQualifiedIds, ...wildcardIds];

  // Récupérer le pays des qualifiés pour le seeding
  const qualTeams = await Team.find({ _id: { $in: qualifiedIds } }, 'country');
  for (const t of qualTeams) {
    const id = String(t._id);
    if (metaMap[id]) metaMap[id].country = t.country || '';
  }
  const qualifiedMeta = qualifiedIds.map(id => metaMap[id] || { id, group: '', rank: 99, country: '' });

  // Consolante : toutes les équipes des groupes qui ne sont PAS qualifiées
  const allGroupTeams = await Team.find({
    group: { $in: groups.map(g => g._id) },
  });
  const consolanteIds = allGroupTeams
    .map(t => String(t._id))
    .filter(id => !qualifiedIds.includes(id));

  return { qualified: qualifiedIds, consolante: consolanteIds, qualifiedMeta };
}

// Crée tous les matchs d'un bracket complet en base.
// seededTeams : tableau d'ObjectIds (index 0 = seed 1, ..., index N-1 = seed N)
// phases      : tableau de phases dans l'ordre du bracket (ex: ['r16','qf','sf','final'])
// Les slots au-delà des équipes disponibles sont des BYEs (auto-victoire).
// Retourne le nombre total de matchs créés.
async function createFullBracket(tournamentId, seededTeams, phases, tournament) {
  // taille = 2^nombre de phases (ex: 4 phases → 16 équipes)
  const bSize = Math.pow(2, phases.length);
  const slots = getSeededSlots(bSize);
  let totalCreated = 0;

  // Premier round : matchs avec les vraies équipes (ou BYEs)
  const firstPhase      = phases[0];
  const firstRoundCount = bSize / 2;

  for (let pos = 1; pos <= firstRoundCount; pos++) {
    const slotA = slots[(pos - 1) * 2];
    const slotB = slots[(pos - 1) * 2 + 1];
    const team1 = seededTeams[slotA - 1] || null; // null = BYE
    const team2 = seededTeams[slotB - 1] || null;
    const isBye = !team1 || !team2;

    const matchData = {
      tournament: tournamentId,
      phase:      firstPhase,
      position:   pos,
      team1,
      team2,
      setFormat:  getSetFormat(firstPhase, tournament),
    };

    if (isBye) {
      // Victoire automatique pour l'équipe présente
      matchData.played = true;
      matchData.result = team1 ? 'team1' : 'team2';
      matchData.winner = team1 || team2;
      matchData.sets   = [];
    }

    await Match.create(matchData);
    totalCreated++;
  }

  // Rounds suivants : coquilles vides (teams remplies par propagation)
  for (let r = 1; r < phases.length; r++) {
    const phase      = phases[r];
    const matchCount = Math.pow(2, phases.length - 1 - r);
    for (let pos = 1; pos <= matchCount; pos++) {
      await Match.create({
        tournament: tournamentId,
        phase,
        position:   pos,
        setFormat:  getSetFormat(phase, tournament),
      });
      totalCreated++;
    }
  }

  // Propagation des BYEs vers le round suivant
  if (phases.length > 1) {
    const byeMatches = await Match.find({
      tournament: tournamentId,
      phase:      firstPhase,
      played:     true,
    });
    for (const m of byeMatches) {
      if (m.winner && m.position != null) {
        const nextPos  = Math.ceil(m.position / 2);
        const slot     = m.position % 2 === 1 ? 'team1' : 'team2';
        await Match.findOneAndUpdate(
          { tournament: tournamentId, phase: phases[1], position: nextPos },
          { $set: { [slot]: m.winner } }
        );
      }
    }
  }

  return totalCreated;
}

// ─── POST /api/bracket/generate ──────────────────────────────────────────────
// Clôture les poules → calcule les qualifiés → génère le bracket principal.
// Body : { bracketTarget?: 8|16|32|64, seedOrder?: [teamId1, ...] }
// bracketTarget détermine le nombre exact de qualifiés (0 BYE si réalisable).

router.post('/generate', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    // Vérifier qu'il n'y a pas déjà un bracket principal
    const existing = await Match.countDocuments({
      tournament: tournament._id,
      phase: { $in: ['r64', 'r32', 'r16', 'qf', 'sf', 'final'] },
    });
    if (existing > 0) {
      return res.status(409).json({
        error: 'Un bracket principal existe déjà. Supprimez les matchs knockout avant de regénérer.',
      });
    }

    // Valider et extraire bracketTarget
    const bracketTarget = parseInt(req.body.bracketTarget, 10) ||
      tournament.qualificationRules?.bracketTarget || 32;

    if (![8, 16, 32, 64].includes(bracketTarget)) {
      return res.status(400).json({ error: 'bracketTarget invalide — valeurs acceptées : 8, 16, 32, 64' });
    }

    const phases = MAIN_PHASES[bracketTarget];
    if (!phases) {
      return res.status(400).json({ error: `Taille de bracket non supportée : ${bracketTarget}` });
    }

    // Calculer la qualification avec la nouvelle logique basée sur bracketTarget
    const { qualified, consolante, qualifiedMeta } = await computeQualification(tournament, 'pool', bracketTarget);

    if (qualified.length < 4) {
      return res.status(400).json({
        error: `Pas assez d'équipes qualifiées (minimum 4, trouvé ${qualified.length})`,
      });
    }

    if (qualified.length !== bracketTarget) {
      return res.status(400).json({
        error: `Impossible d'atteindre ${bracketTarget} qualifiés : seulement ${qualified.length} équipes éligibles dans les poules. Réduisez le bracket cible.`,
      });
    }

    // Seeding : ordre manuel (seedOrder) ou algo automatique (snake + correcteur)
    let seededTeams;
    let seedingConflicts = [];
    if (Array.isArray(req.body.seedOrder) && req.body.seedOrder.length > 0) {
      seededTeams = req.body.seedOrder;
    } else {
      const result = computeSeeding(qualifiedMeta, bracketTarget);
      seededTeams      = result.seededIds;
      seedingConflicts = result.conflicts;
    }

    const totalCreated = await createFullBracket(tournament._id, seededTeams, phases, tournament);

    // Sauvegarder bracketTarget dans les règles du tournoi
    tournament.qualificationRules.bracketTarget = bracketTarget;

    // Mise à jour des chemins de tournoi.
    // Les qualifiés → 'main'. Les non-qualifiés restent à null — le wizard consolante
    // les prend en charge (Option A : poules, Option B : bracket direct).
    await Team.updateMany({ _id: { $in: qualified } }, { $set: { tournamentPath: 'main' } });

    // Mise à jour du statut du tournoi
    tournament.currentPhase = phases[0];
    tournament.status       = 'knockout';
    await tournament.save();

    const response = {
      message:        `Bracket principal généré : ${bracketTarget} équipes, ${phases[0]} → final`,
      bracketSize:    bracketTarget,
      firstPhase:     phases[0],
      qualified:      qualified.length,
      consolante:     consolante.length,
      matchesCreated: totalCreated,
    };
    if (seedingConflicts.length > 0) response.conflicts = seedingConflicts;
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── POST /api/bracket/consolante/generate ───────────────────────────────────
// Génère le bracket consolante. Deux modes :
//
// Option B — direct: true + bracketTarget
//   → Équipes éligibles : group != null && tournamentPath = null (non-qualifiés du bracket principal)
//   → Crée le bracket avec BYEs si teams.length < bracketTarget
//   → Assigne tournamentPath='consolante' aux équipes
//
// Option A — (pas de direct) après poules consolante
//   → Équipes éligibles : tournamentPath='consolante' (déjà assignées par groups/draw)
//   → Utilise les classements consolante_pool pour le seeding
//   → Si teams.length <= bracketTarget : toutes qualifiées + BYEs
//   → Si teams.length > bracketTarget : computeQualification consolante_pool, reste → 'eliminated'
//
// Body : { direct?: true, bracketTarget?: 4|8|16|32, seedOrder?: [teamId1, ...] }

router.post('/consolante/generate', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    // Vérifier qu'il n'y a pas déjà un bracket consolante
    const existing = await Match.countDocuments({
      tournament: tournament._id,
      phase: { $in: ['consolante_r32', 'consolante_r16', 'consolante_qf', 'consolante_sf', 'consolante_final'] },
    });
    if (existing > 0) {
      return res.status(409).json({ error: 'Un bracket consolante existe déjà.' });
    }

    // ── Détection du mode ────────────────────────────────────────────────────
    const isDirect = req.body.direct === true;

    let consolanteTeams;
    const poolPhaseForSeeding = isDirect ? 'pool' : 'consolante_pool';

    if (isDirect) {
      // Option B : équipes qui ont fait les poules principales mais n'ont pas été qualifiées
      consolanteTeams = await Team.find({ group: { $ne: null }, tournamentPath: null });
    } else {
      // Option A : équipes déjà assignées à la consolante via le tirage de poules consolante
      consolanteTeams = await Team.find({ tournamentPath: 'consolante' });
    }

    if (consolanteTeams.length < 4) {
      return res.status(400).json({
        error: `Pas assez d'équipes consolante (minimum 4, trouvé ${consolanteTeams.length}).`,
      });
    }

    // ── Taille du bracket ────────────────────────────────────────────────────
    const reqBracketTarget = req.body.bracketTarget
      ? parseInt(req.body.bracketTarget, 10)
      : null;
    const savedBracketTarget = tournament.consolanteQualificationRules?.bracketTarget;

    let bSize;
    if (reqBracketTarget) {
      if (![4, 8, 16, 32].includes(reqBracketTarget)) {
        return res.status(400).json({
          error: 'bracketTarget invalide — valeurs acceptées : 4, 8, 16, 32',
        });
      }
      bSize = reqBracketTarget;
    } else if (savedBracketTarget && [4, 8, 16, 32].includes(savedBracketTarget)) {
      bSize = savedBracketTarget;
    } else {
      bSize = getBracketSize(consolanteTeams.length);
    }

    const phases = CONSOLANTE_PHASES[bSize];
    if (!phases) {
      return res.status(400).json({ error: `Taille de bracket non supportée : ${bSize}` });
    }

    // ── Qualification si trop d'équipes pour le bracket ──────────────────────
    // Option A (!isDirect) : computeQualification depuis consolante_pool
    //   → identique au bracket principal, reste → 'eliminated'
    // Option B (isDirect) : impossible sans poules → erreur
    let meta;
    let eliminatedCount = 0;

    if (!isDirect && consolanteTeams.length > bSize) {
      // Qualification depuis les classements consolante_pool
      const { qualified, consolante: unqualified, qualifiedMeta } =
        await computeQualification(tournament, 'consolante_pool', bSize);

      if (qualified.length < 4) {
        return res.status(400).json({
          error: `Pas assez d'équipes qualifiées consolante (minimum 4, trouvé ${qualified.length})`,
        });
      }
      if (qualified.length !== bSize) {
        return res.status(400).json({
          error: `Impossible d'atteindre ${bSize} qualifiés consolante : seulement ${qualified.length} équipes éligibles.`,
        });
      }

      // Non-qualifiés : éliminés définitivement
      if (unqualified.length > 0) {
        await Team.updateMany({ _id: { $in: unqualified } }, { $set: { tournamentPath: 'eliminated' } });
        eliminatedCount = unqualified.length;
      }

      // Réduire consolanteTeams aux qualifiés seulement pour le seeding
      consolanteTeams = consolanteTeams.filter(t => qualified.includes(String(t._id)));
      meta = qualifiedMeta;

    } else if (consolanteTeams.length > bSize) {
      // isDirect + trop d'équipes : pas de qualification possible sans poules consolante
      return res.status(400).json({
        error: `Trop d'équipes (${consolanteTeams.length}) pour un bracket de ${bSize}. Augmentez bracketTarget.`,
      });

    } else {
      // consolanteTeams.length <= bSize : toutes qualifiées, BYEs automatiques si besoin
      const tiebreaker = tournament.qualificationRules?.tiebreaker ??
        ['wins', 'gameDiff', 'gamesWon', 'directConfrontation'];

      const groupIds = [...new Set(consolanteTeams.map(t => String(t.group)).filter(Boolean))];
      const poolGroupsForSeeding = await Group.find({
        _id:   { $in: groupIds },
        phase: poolPhaseForSeeding,
      });

      const rankByTeamId = {};
      for (const group of poolGroupsForSeeding) {
        const rawMatches = await Match.find({ _id: { $in: group.matches } });
        const standings  = computeStandings(group.teams, rawMatches, tiebreaker);
        for (const s of standings) {
          rankByTeamId[String(s.teamId)] = { rank: s.rank, groupName: group.name };
        }
      }

      meta = consolanteTeams.map(t => {
        const id   = String(t._id);
        const info = rankByTeamId[id] || { rank: 99, groupName: '?' };
        return { id, group: info.groupName, rank: info.rank, country: t.country || '' };
      });
    }

    // ── Seeding : ordre manuel ou algo automatique (snake + correcteur pays/groupe) ──
    let seededTeams;
    let seedingConflicts = [];
    if (Array.isArray(req.body.seedOrder) && req.body.seedOrder.length > 0) {
      seededTeams = req.body.seedOrder;
    } else {
      const result = computeSeeding(meta, bSize);
      seededTeams      = result.seededIds;
      seedingConflicts = result.conflicts;
    }

    const totalCreated = await createFullBracket(tournament._id, seededTeams, phases, tournament);

    // Assigner tournamentPath='consolante' (nécessaire pour Option B où c'était encore null)
    await Team.updateMany(
      { _id: { $in: consolanteTeams.map(t => t._id) } },
      { $set: { tournamentPath: 'consolante' } }
    );

    // La consolante se déroule en parallèle du knockout — pas de changement de statut
    tournament.currentPhase = phases[0];
    await tournament.save();

    const byes = bSize - consolanteTeams.length;

    const response = {
      message:        `Bracket consolante généré : ${consolanteTeams.length} équipes → bracket ${bSize}, ${phases[0]} → consolante_final`,
      bracketSize:    bSize,
      firstPhase:     phases[0],
      teams:          consolanteTeams.length,
      byes,
      eliminated:     eliminatedCount,
      matchesCreated: totalCreated,
    };
    if (seedingConflicts.length > 0) response.conflicts = seedingConflicts;
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', ...safeError(err) });
  }
});

// ─── GET /api/bracket ─────────────────────────────────────────────────────────
// Retourne les matchs du bracket principal groupés par phase.

router.get('/', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
    if (!tournament) return res.status(404).json({ error: 'Aucun tournoi configuré' });

    const phases = ['r32', 'r16', 'qf', 'sf', 'final'];
    const matches = await Match.find({
      tournament: tournament._id,
      phase:      { $in: phases },
    })
      .populate('team1',  'name player1 player2 country')
      .populate('team2',  'name player1 player2 country')
      .populate('winner', 'name')
      .sort({ position: 1 });

    // Grouper par phase dans l'ordre du bracket
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

// ─── GET /api/bracket/consolante ─────────────────────────────────────────────
// Retourne les matchs du bracket consolante groupés par phase.

router.get('/consolante', async (req, res) => {
  try {
    const tournament = await Tournament.findOne();
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
      .sort({ position: 1 });

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
