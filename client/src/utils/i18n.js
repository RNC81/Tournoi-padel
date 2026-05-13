// ─── i18n.js — Traductions FR/EN centralisées ─────────────────────────────────
// Clé localStorage partagée entre toutes les pages.
// Usage : const t = i18n[lang];   puis t.home.deroulement, t.guest.qualified, etc.

export const LANG_KEY = 'padel_lang';

export const i18n = {

  // ─── FRANÇAIS ──────────────────────────────────────────────────────────────
  fr: {

    // Navbar
    nav: {
      programme:  'Programme',
      reglement:  'Règlement',
      scores:     'Scores live',
      langToggle: 'EN',
    },

    // HomePage
    home: {
      subtitle:         'Tournoi de padel 2v2 · Paris',
      equipesInscrites: 'Équipes inscrites',
      sur:              'sur',
      placesRestantes:  (n) => `${n} places restantes`,
      sInscrire:        "S'inscrire maintenant",
      suivreTournoi:    'Suivre le tournoi',

      // Stats bar
      statFormat: 'Format',
      statJours:  'Jours',
      statFinale: 'Finale',
      statDoublettes: 'doublettes',
      statBracket: 'bracket principal',

      // Programme / Timeline
      calendrier:  'Calendrier',
      deroulement: 'Déroulement',

      timeline: [
        {
          titre: 'Inscriptions',
          desc:  (max) => `Les équipes de 2 joueurs s'inscrivent en ligne. Maximum ${max} équipes. Première arrivée, première servie.`,
          date:  'Avant le 13 Mai',
        },
        {
          titre: 'Phase de poules',
          desc:  () => 'Tirage au sort. Chaque équipe joue contre toutes les autres de son groupe (round-robin). Les meilleurs se qualifient.',
          date:  '14 Mai 2026',
        },
        {
          titre: 'Bracket principal',
          desc:  () => 'Élimination directe pour les équipes qualifiées. Best of 3 sets. Chaque match est décisif.',
          date:  '16 Mai 2026',
        },
        {
          titre: 'Bracket consolante',
          desc:  () => "Les équipes éliminées en poule disputent un deuxième tournoi parallèle. Aucune équipe sans match le 16 Mai.",
          date:  '16 Mai 2026',
        },
      ],

      // Règlement
      aSavoir:            'À savoir',
      reglement:          'Règlement',
      reglementOfficiel:  'Règlement officiel',
      consulterReglement: 'Consulter le règlement',

      // QR / Instagram
      scannerPourSuivre: 'Scanner pour suivre',
      accesDirect:       'Accès direct aux scores depuis ton téléphone',
      accesRapide:       'Accès rapide',
      reseauSocial:      'Réseau social',
      nousPartagerBtn:   'Nous suivre',

      // Timeline status labels
      statusDone:     'Terminé',
      statusCurrent:  'En cours',

      // Statut tournoi (badge navbar/footer optionnel)
      status: {
        registration: 'Inscriptions ouvertes',
        pool_stage:   'Phase de poules',
        knockout:     'Phase finale',
        finished:     'Terminé',
      },

      // Footer
      copyright:     '© 2026 Paris Yaar Club · Tournoi de Padel',
      footerScores:  'Scores live',
    },

    // GuestHomePage
    guest: {
      tabs:        { groupes: 'Poules', bracket: 'Bracket', consolante: 'Consolante', horaires: 'Horaires' },
      updatedAt:   (t) => `Mis à jour à ${t}`,
      loading:     'Chargement du tournoi…',
      errorMain:   'Impossible de contacter le serveur.',
      errorSub:    'La page se rafraîchit automatiquement toutes les 15 secondes.',
      notStarted:  "Le tournoi n'a pas encore commencé",
      notAvail:    (l) => `Les ${l} ne sont pas encore disponibles`,
      autoRefresh: 'Cette page se rafraîchit automatiquement',
      groups:      (n, q) => `${n} groupe${n > 1 ? 's' : ''} · ${q} qualifié${q > 1 ? 's' : ''} par groupe`,
      qualified:   'Qualifié',
      groupLabel:  (n) => `Groupe ${n}`,
      teams:       (n) => `${n} équipe${n > 1 ? 's' : ''}`,
      matches:     (p, t) => `${p}/${t} matchs joués`,
      showMatches: 'Voir les matchs',
      hideMatches: 'Masquer les matchs',
      loadingM:    'Chargement…',
      noMatches:   'Aucun match enregistré',
      noBracket:   "Le bracket n'est pas encore disponible.",
      langToggle:  'EN',
      // Horaires
      scheduleDl:       'Télécharger les horaires',
      scheduleNotReady: 'Les horaires ne sont pas encore disponibles.',
    },
  },

  // ─── ENGLISH ───────────────────────────────────────────────────────────────
  en: {

    // Navbar
    nav: {
      programme:  'Programme',
      reglement:  'Regulations',
      scores:     'Live scores',
      langToggle: 'FR',
    },

    // HomePage
    home: {
      subtitle:         'Padel Tournament 2v2 · Paris',
      equipesInscrites: 'Teams registered',
      sur:              'of',
      placesRestantes:  (n) => `${n} spots left`,
      sInscrire:        'Register now',
      suivreTournoi:    'Follow the tournament',

      // Stats bar
      statFormat: 'Format',
      statJours:  'Days',
      statFinale: 'Final',
      statDoublettes: 'doubles',
      statBracket: 'main bracket',

      // Programme / Timeline
      calendrier:  'Schedule',
      deroulement: 'Schedule',

      timeline: [
        {
          titre: 'Registration',
          desc:  (max) => `Teams of 2 register online. Maximum ${max} teams. First come, first served.`,
          date:  'Before May 13',
        },
        {
          titre: 'Group Stage',
          desc:  () => 'Random draw. Each team plays against all others in their group (round-robin). Top teams qualify.',
          date:  'May 14, 2026',
        },
        {
          titre: 'Main Bracket',
          desc:  () => 'Direct elimination for qualified teams. Best of 3 sets. Every match is decisive.',
          date:  'May 16, 2026',
        },
        {
          titre: 'Consolation Bracket',
          desc:  () => 'Teams eliminated in the group stage compete in a parallel tournament. No team without a match on May 16.',
          date:  'May 16, 2026',
        },
      ],

      // Règlement
      aSavoir:            'Key info',
      reglement:          'Regulations',
      reglementOfficiel:  'Official Regulations',
      consulterReglement: 'View regulations',

      // QR / Instagram
      scannerPourSuivre: 'Scan to follow',
      accesDirect:       'Direct access to live scores from your phone',
      accesRapide:       'Quick access',
      reseauSocial:      'Social media',
      nousPartagerBtn:   'Follow us',

      // Timeline status labels
      statusDone:     'Done',
      statusCurrent:  'In progress',

      // Statut tournoi
      status: {
        registration: 'Registrations open',
        pool_stage:   'Group Stage',
        knockout:     'Knockout Stage',
        finished:     'Finished',
      },

      // Footer
      copyright:     '© 2026 Paris Yaar Club · Padel Tournament',
      footerScores:  'Live scores',
    },

    // GuestHomePage
    guest: {
      tabs:        { groupes: 'Groups', bracket: 'Bracket', consolante: 'Consolation', horaires: 'Schedule' },
      updatedAt:   (t) => `Updated at ${t}`,
      loading:     'Loading tournament…',
      errorMain:   'Cannot reach the server.',
      errorSub:    'The page refreshes automatically every 15 seconds.',
      notStarted:  "The tournament hasn't started yet",
      notAvail:    (l) => `${l} not yet available`,
      autoRefresh: 'This page refreshes automatically',
      groups:      (n, q) => `${n} group${n > 1 ? 's' : ''} · ${q} qualifier${q > 1 ? 's' : ''} per group`,
      qualified:   'Qualified',
      groupLabel:  (n) => `Group ${n}`,
      teams:       (n) => `${n} team${n > 1 ? 's' : ''}`,
      matches:     (p, t) => `${p}/${t} matches played`,
      showMatches: 'Show matches',
      hideMatches: 'Hide matches',
      loadingM:    'Loading…',
      noMatches:   'No matches recorded',
      noBracket:   'Bracket not yet available.',
      langToggle:  'FR',
      // Horaires
      scheduleDl:       'Download schedule',
      scheduleNotReady: 'Schedule not yet available.',
    },
  },
};
