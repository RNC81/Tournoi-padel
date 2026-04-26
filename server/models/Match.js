const { Schema, model } = require('mongoose');

const matchSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },

    // Phase du tournoi à laquelle appartient ce match
    phase: {
      type: String,
      enum: [
        // Bracket principal
        'pool',
        'r32', 'r16', 'qf', 'sf', 'final',
        // Bracket consolante
        'consolante_pool',
        'consolante_r32', 'consolante_r16',
        'consolante_qf', 'consolante_sf', 'consolante_final',
      ],
      required: true,
    },

    team1: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    team2: { type: Schema.Types.ObjectId, ref: 'Team', default: null },

    // Scores par set : [{ score1: 6, score2: 3 }, ...]
    // _id: false car ces sous-docs n'ont pas besoin d'identifiant propre
    sets: [
      {
        score1: { type: Number, min: 0 },
        score2: { type: Number, min: 0 },
        _id: false,
      },
    ],

    // Résultat du match
    result: {
      type: String,
      enum: ['team1', 'team2', 'draw', null],
      default: null,
    },

    played: { type: Boolean, default: false },

    // Format de set appliqué à CE match — source de vérité.
    // Copié depuis la config tournament au moment de la création du match.
    // Reste stable même si la config du tournoi est modifiée ensuite.
    setFormat: {
      target:          { type: Number }, // 4 ou 6 jeux pour gagner un set
      maxSets:         { type: Number }, // 1 ou 2 sets pour gagner le match
      tiebreakatDeuce: { type: Boolean }, // tie-break immédiat à l'égalité (true) ou on continue (false)
      maxGames:        { type: Number }, // plafond absolu du set (5 si target=4, 7 si target=6)
    },

    winner: { type: Schema.Types.ObjectId, ref: 'Team', default: null },

    // Position dans le bracket knockout (1 = premier match, 2 = deuxième, etc.)
    // Permet de savoir vers quel match du round suivant propager le winner.
    // null pour les matchs de poule.
    position: { type: Number, default: null },

    scheduledAt: { type: Date, default: null },
    courtNumber: { type: Number, default: null },
  },
  { timestamps: true }
);

// Récupérer tous les matchs d'un tournoi pour une phase donnée
matchSchema.index({ tournament: 1, phase: 1 });

module.exports = model('Match', matchSchema);
