const mongoose = require('mongoose');

// Sous-schéma pour chaque joueur d'une équipe (padel = 2 joueurs)
const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, default: '' },
}, { _id: false });

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 50,
  },
  player1: { type: playerSchema, required: true },
  player2: { type: playerSchema, required: true },

  // Groupe auquel l'équipe est affectée (ex: "A", "B", ...) - null avant le tirage
  groupName: { type: String, default: null },

  // Position finale dans le groupe (1er, 2ème, etc.)
  groupPosition: { type: Number, default: null },

  // Stats de phase de poule
  stats: {
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    setsFor: { type: Number, default: 0 },
    setsAgainst: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
  },

  // Où va l'équipe après les poules
  phase: {
    type: String,
    enum: ['registered', 'group', 'knockout', 'consolation', 'eliminated'],
    default: 'registered',
  },
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
