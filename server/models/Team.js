const { Schema, model } = require('mongoose');

const teamSchema = new Schema(
  {
    // Nom d'équipe — optionnel : auto-généré "[NomJoueur1] / [NomJoueur2]" si absent
    name:    { type: String, default: '', trim: true, maxlength: 100 },
    player1: { type: String, required: true, trim: true, maxlength: 100 },
    player2: { type: String, required: true, trim: true, maxlength: 100 },

    // Pays ou ville en texte libre (ex: "Paris", "London", "Île de La Réunion")
    // La contrainte de doublon dans les poules compare en toLowerCase().trim()
    country: { type: String, default: '', trim: true, maxlength: 100 },

    // Parcours de l'équipe dans le tournoi
    // null     → pas encore placée (poules en cours ou terminées sans qualification)
    // "main"   → qualifiée pour le bracket principal
    // "consolante" → redirigée vers la consolante
    // "eliminated" → éliminée définitivement (perdante en consolante)
    tournamentPath: {
      type: String,
      enum: ['main', 'consolante', 'eliminated', null],
      default: null,
    },

    // Référence à la poule dans laquelle l'équipe est placée
    group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },

    registeredAt: { type: Date, default: Date.now },

    // Notes libres pour l'admin (forfaits, remplacement, contexte)
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('Team', teamSchema);
