const { Schema, model } = require('mongoose');

// Sous-schéma réutilisé pour définir le format d'un set
// Utilisé dans poolStageFormat, knockoutFormat.*, consolante*.
const setFormatSchema = {
  target:          { type: Number }, // 4 ou 6 jeux pour gagner un set
  maxSets:         { type: Number }, // 1 ou 2 sets pour gagner le match
  tiebreakatDeuce: { type: Boolean }, // true = tie-break immédiat; false = on continue jusqu'à maxGames
  maxGames:        { type: Number }, // plafond absolu (5 si target=4, 7 si target=6)
};

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true },

    status: {
      type: String,
      enum: ['setup', 'registration', 'pool_stage', 'knockout', 'consolante', 'finished'],
      default: 'setup',
    },

    maxTeams: { type: Number, default: 100 },

    // Phase courante du bracket (ex: "r16", "consolante_qf")
    // Mis à jour par l'admin quand il lance un nouveau round
    currentPhase: { type: String, default: null },

    // ── Formats de set ───────────────────────────────────────────────────

    // Format utilisé pour tous les matchs de la phase de poule principale
    poolStageFormat: setFormatSchema,

    // Format par round du bracket principal.
    // r32 et r16 sont configurés au lancement de leur round (Option C),
    // donc pas stockés ici. qf/sf/final servent de mémoire pour pré-remplir
    // le formulaire admin — la source de vérité reste Match.setFormat.
    knockoutFormat: {
      qf:    setFormatSchema,
      sf:    setFormatSchema,
      final: setFormatSchema,
    },

    // Format pour la phase de poule de la consolante
    consolantePoolFormat: setFormatSchema,

    // Format par round du bracket consolante (même logique que knockoutFormat)
    consolanteKnockoutFormat: {
      qf:    setFormatSchema,
      sf:    setFormatSchema,
      final: setFormatSchema,
    },

    // ── Règles de qualification depuis les poules ────────────────────────

    qualificationRules: {
      // Taille cible du bracket principal (puissance de 2 : 8, 16, 32, 64).
      // Détermine automatiquement qualifiedPerGroup et wildcardSpots.
      bracketTarget: { type: Number, default: 32 },

      // Critères de départage en ordre de priorité
      tiebreaker: {
        type: [String],
        default: ['points', 'setDiff', 'setsWon', 'directConfrontation'],
      },
    },
  },
  { timestamps: true }
);

module.exports = model('Tournament', tournamentSchema);
