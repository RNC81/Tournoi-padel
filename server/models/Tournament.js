const mongoose = require('mongoose');

// Un set de padel : score de chaque équipe dans ce set (ex: 6-3)
const setSchema = new mongoose.Schema({
  score1: { type: Number, min: 0 },
  score2: { type: Number, min: 0 },
}, { _id: false });

// Un match de poule
const groupMatchSchema = new mongoose.Schema({
  team1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  team2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  // Scores par set : tableau de 1 à 3 sets (best of 3)
  sets: { type: [setSchema], default: [] },
  // Gagnant calculé automatiquement d'après les sets
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  played: { type: Boolean, default: false },
}, { _id: true });

// Un groupe (poule)
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "A", "B", "C"...
  teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  matches: [groupMatchSchema],
}, { _id: false });

// Un match de bracket (knockout ou consolante)
const bracketMatchSchema = new mongoose.Schema({
  round: { type: Number, required: true },      // 0 = 1er tour, 1 = quart, etc.
  position: { type: Number, required: true },    // Position dans le round (0, 1, 2...)
  team1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  team2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  sets: { type: [setSchema], default: [] },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  played: { type: Boolean, default: false },
  // Référence aux matchs dont viennent les gagnants (pour avancement auto)
  feeder1: { round: Number, position: Number },
  feeder2: { round: Number, position: Number },
}, { _id: true });

// Document principal : il n'y en a qu'UN seul par tournoi
const tournamentSchema = new mongoose.Schema({
  name: { type: String, default: 'Tournoi Paris Yaar Club' },

  // Phase actuelle du tournoi
  status: {
    type: String,
    enum: ['registration', 'group_stage', 'knockout', 'finished'],
    default: 'registration',
  },

  // Config
  maxTeams: { type: Number, default: 100 },

  // Phase de poule
  groups: [groupSchema],

  // Equipes qualifiées pour le bracket principal
  qualifiedTeamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],

  // Equipes dans la consolante (perdants de poule)
  consolationTeamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],

  // Bracket principal (knockout)
  knockoutMatches: [bracketMatchSchema],

  // Bracket consolante (même structure)
  consolationMatches: [bracketMatchSchema],

  // Résultats finaux
  championId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  consolationChampionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
