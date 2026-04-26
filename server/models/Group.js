const { Schema, model } = require('mongoose');

const groupSchema = new Schema(
  {
    name:       { type: String, required: true }, // "A", "B", "C"...
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },

    // "pool" → phase de poule principale
    // "consolante_pool" → phase de poule de la consolante
    phase: {
      type: String,
      enum: ['pool', 'consolante_pool'],
      required: true,
    },

    teams:   [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    matches: [{ type: Schema.Types.ObjectId, ref: 'Match' }],

    // standings n'est PAS stocké ici — calculé dynamiquement
    // depuis les Match joués à chaque lecture
  },
  { timestamps: true }
);

// Récupérer tous les groupes d'un tournoi pour une phase donnée
groupSchema.index({ tournament: 1, phase: 1 });

module.exports = model('Group', groupSchema);
