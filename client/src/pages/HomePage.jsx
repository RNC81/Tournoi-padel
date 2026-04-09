import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

// Motif SVG d'un court de padel vu de dessus — utilisé dans le hero
function PadelCourtSVG() {
  return (
    <svg
      viewBox="0 0 300 400"
      className="w-full h-full opacity-20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {/* Contour du court */}
      <rect x="20" y="20" width="260" height="360" rx="4" className="text-primary-400" strokeWidth="3"/>
      {/* Filet central */}
      <line x1="20" y1="200" x2="280" y2="200" className="text-white" strokeWidth="3"/>
      {/* Lignes de service */}
      <line x1="20" y1="100" x2="280" y2="100" className="text-white/60"/>
      <line x1="20" y1="300" x2="280" y2="300" className="text-white/60"/>
      {/* Ligne centrale verticale */}
      <line x1="150" y1="20" x2="150" y2="100" className="text-white/40"/>
      <line x1="150" y1="300" x2="150" y2="380" className="text-white/40"/>
      {/* Coins arrondis (parois en verre) */}
      <circle cx="20" cy="20" r="10" className="text-primary-400/40" fill="currentColor"/>
      <circle cx="280" cy="20" r="10" className="text-primary-400/40" fill="currentColor"/>
      <circle cx="20" cy="380" r="10" className="text-primary-400/40" fill="currentColor"/>
      <circle cx="280" cy="380" r="10" className="text-primary-400/40" fill="currentColor"/>
      {/* Balle de padel */}
      <circle cx="150" cy="200" r="12" className="text-gold-400" fill="currentColor" opacity="0.6"/>
      {/* Deco lignes diagonales */}
      <line x1="20" y1="20" x2="60" y2="60" className="text-primary-400/20" strokeDasharray="4 4"/>
      <line x1="280" y1="20" x2="240" y2="60" className="text-primary-400/20" strokeDasharray="4 4"/>
    </svg>
  );
}

// Page d'accueil — vitrine du tournoi Paris Yaar Club
// Style : sports editorial, layout asymétrique, typo massive
export default function HomePage() {
  const [teamCount, setTeamCount] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [openRule, setOpenRule] = useState(null);

  useEffect(() => {
    api.get('/teams/count').then(r => setTeamCount(r.data)).catch(() => {});
    api.get('/tournament').then(r => setTournamentStatus(r.data.status)).catch(() => {});
    api.get('/qrcode').then(r => setQrCode(r.data.qr)).catch(() => {});
  }, []);

  const registrationOpen = tournamentStatus === 'registration' || tournamentStatus === null;
  const progression = teamCount ? Math.round((teamCount.count / teamCount.max) * 100) : 0;

  return (
    <div className="min-h-screen bg-dark-900">

      {/* ─── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Fond gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900/30" />

        {/* Grille de fond subtile */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="grid lg:grid-cols-5 gap-8 items-center">

            {/* Colonne texte (60%) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Badge statut */}
              <div className="inline-flex items-center gap-2 border border-primary-500/40 bg-primary-500/10 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                <span className="text-primary-400 text-xs font-semibold uppercase tracking-widest">
                  {tournamentStatus === 'registration' || !tournamentStatus
                    ? 'Inscriptions ouvertes'
                    : tournamentStatus === 'group_stage'
                    ? 'Phase de poules en cours'
                    : tournamentStatus === 'knockout'
                    ? 'Phase finale en cours'
                    : 'Tournoi terminé'}
                </span>
              </div>

              {/* Titre massif — style sports editorial */}
              <div className="space-y-0">
                <h1 className="font-display font-black leading-none text-white" style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)' }}>
                  TOURNOI
                </h1>
                <h1 className="font-display font-black leading-none text-primary-400" style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)' }}>
                  PARIS
                </h1>
                <h1 className="font-display font-black leading-none text-white" style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)' }}>
                  YAAR
                </h1>
                <h1 className="font-display font-black leading-none" style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)', WebkitTextStroke: '2px #22c55e', color: 'transparent' }}>
                  CLUB
                </h1>
              </div>

              {/* Infos date / format */}
              <div className="flex flex-wrap gap-4 text-white/50 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  14 & 16 Mai 2026
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Paris
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Format 2v2
                </span>
              </div>

              {/* Barre de progression des inscriptions */}
              {teamCount && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Équipes inscrites</span>
                    <span className="text-white font-bold">{teamCount.count} <span className="text-white/30">/ {teamCount.max}</span></span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-700"
                      style={{ width: `${progression}%` }}
                    />
                  </div>
                  <p className="text-white/30 text-xs">{100 - (teamCount.count || 0)} places restantes</p>
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-wrap gap-3 pt-2">
                {registrationOpen ? (
                  <Link to="/inscription" className="btn-gold text-base px-7 py-3.5 inline-flex items-center gap-2">
                    S'inscrire maintenant
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </Link>
                ) : null}
                <Link to="/tournoi" className="btn-outline text-base px-7 py-3.5 inline-flex items-center gap-2">
                  Suivre le tournoi
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </Link>
              </div>
            </div>

            {/* Colonne court padel SVG (40%) — masquée sur mobile */}
            <div className="lg:col-span-2 hidden lg:flex items-center justify-center h-96 relative">
              <div className="text-primary-400 w-56 h-80">
                <PadelCourtSVG />
              </div>
              {/* Halos */}
              <div className="absolute inset-0 bg-primary-500/5 rounded-3xl blur-3xl" />
            </div>
          </div>
        </div>

        {/* Flèche scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ─── STATS CLÉS ─────────────────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <StatItem value="100" label="Équipes max" sub="2 joueurs par équipe" />
            <StatItem value="3" label="Phases" sub="Poules · Knockout · Consolante" />
            <StatItem value="2" label="Jours" sub="14 & 16 Mai 2026" />
          </div>
        </div>
      </section>

      {/* ─── DÉROULEMENT ────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="mb-12">
          <p className="text-primary-400 text-sm font-semibold uppercase tracking-widest mb-2">Programme</p>
          <h2 className="font-display font-black text-4xl md:text-5xl text-white">Déroulement</h2>
        </div>

        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary-500 via-white/20 to-transparent" />

          <div className="space-y-0">
            {[
              {
                phase: '01',
                titre: 'Inscriptions',
                desc: 'Les équipes de 2 joueurs s\'inscrivent en ligne. Maximum 100 équipes. Première arrivée, première servie.',
                status: tournamentStatus === 'registration' ? 'current' : tournamentStatus ? 'done' : 'current',
                date: 'Avant le 14 Mai',
              },
              {
                phase: '02',
                titre: 'Phase de poules',
                desc: 'Tirage au sort. Chaque équipe joue contre toutes les autres de son groupe (round-robin). Les meilleurs se qualifient.',
                status: tournamentStatus === 'group_stage' ? 'current' : tournamentStatus === 'knockout' || tournamentStatus === 'finished' ? 'done' : 'upcoming',
                date: '14 Mai 2026',
              },
              {
                phase: '03',
                titre: 'Bracket principal',
                desc: 'Élimination directe pour les équipes qualifiées. Best of 3 sets. Chaque match est décisif.',
                status: tournamentStatus === 'knockout' ? 'current' : tournamentStatus === 'finished' ? 'done' : 'upcoming',
                date: '16 Mai 2026',
              },
              {
                phase: '04',
                titre: 'Bracket consolante',
                desc: 'Les équipes éliminées en poule ne sont pas oubliées. Un deuxième tournoi parallèle leur est dédié.',
                status: tournamentStatus === 'knockout' ? 'current' : tournamentStatus === 'finished' ? 'done' : 'upcoming',
                date: '16 Mai 2026',
              },
            ].map((item, i) => (
              <TimelineItem key={i} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── RÈGLEMENT ──────────────────────────────────────────────────────── */}
      <section className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-primary-400 text-sm font-semibold uppercase tracking-widest mb-2">À savoir</p>
              <h2 className="font-display font-black text-4xl md:text-5xl text-white mb-6">Règlement</h2>
              <p className="text-white/50 leading-relaxed">
                Le tournoi suit les règles officielles du padel de la World Padel Tour.
                Les scores sont saisis par set — on enregistre le score final de chaque set,
                pas chaque point individuel.
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  titre: 'Format des matchs',
                  contenu: 'Les matchs se jouent en best of 3 sets (le premier à gagner 2 sets gagne). Chaque set se gagne à 6 jeux avec 2 jeux d\'écart, ou par tie-break à 6-6. En phase de poule selon le temps disponible, un match peut se jouer en 1 set + super tie-break.',
                },
                {
                  titre: 'Classement en poule',
                  contenu: 'Victoire = 3 points. Défaite = 0 point. Pas de match nul en padel (le tie-break désigne toujours un gagnant). En cas d\'égalité de points entre équipes : 1) différence de sets, 2) sets gagnés, 3) confrontation directe.',
                },
                {
                  titre: 'Qualification pour le bracket',
                  contenu: 'Le nombre de qualifiés dépend du nombre total d\'équipes inscrites. Le système est automatique : avec moins de 40 équipes → bracket de 16, au-dessus → bracket de 32. Les meilleurs de chaque groupe sont qualifiés, complétés par les meilleurs deuxièmes.',
                },
                {
                  titre: 'Bracket consolante',
                  contenu: 'Toutes les équipes éliminées en phase de poule participent automatiquement à un bracket consolante. Même format que le bracket principal. Le vainqueur est sacré champion de la consolante.',
                },
              ].map((rule, i) => (
                <RuleAccordion
                  key={i}
                  titre={rule.titre}
                  contenu={rule.contenu}
                  isOpen={openRule === i}
                  onToggle={() => setOpenRule(openRule === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── QR CODE + INSTAGRAM ────────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">

            {/* QR Code */}
            <div className="card text-center hover:border-primary-500/30 transition-colors">
              <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest mb-4">Accès rapide</p>
              {qrCode ? (
                <img src={qrCode} alt="QR code du tournoi" className="mx-auto w-36 h-36 rounded-xl mb-4" />
              ) : (
                <div className="mx-auto w-36 h-36 bg-white/5 rounded-xl mb-4 flex items-center justify-center text-white/20 text-sm">
                  QR code
                </div>
              )}
              <h3 className="font-bold text-white mb-1">Scanner pour suivre</h3>
              <p className="text-white/40 text-xs">Accès direct aux scores et résultats depuis ton téléphone</p>
            </div>

            {/* Instagram */}
            <div className="card text-center hover:border-pink-500/30 transition-colors">
              <p className="text-pink-400 text-xs font-semibold uppercase tracking-widest mb-4">Réseau social</p>
              <div className="mx-auto w-36 h-36 rounded-xl mb-4 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">@paris.yaar.club</h3>
              <a
                href="https://www.instagram.com/paris.yaar.club"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition mt-2"
              >
                Nous suivre sur Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/20 text-sm">© 2026 Paris Yaar Club · Tournoi de Padel</p>
          <div className="flex items-center gap-4 text-sm text-white/30">
            <Link to="/inscription" className="hover:text-white/60 transition-colors">S'inscrire</Link>
            <Link to="/tournoi" className="hover:text-white/60 transition-colors">Suivre le tournoi</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Composant ligne de timeline
function TimelineItem({ phase, titre, desc, status, date }) {
  const colors = {
    done:     { dot: 'bg-primary-500', text: 'text-primary-400', label: 'Terminé' },
    current:  { dot: 'bg-gold-400 animate-pulse', text: 'text-gold-400', label: 'En cours' },
    upcoming: { dot: 'bg-white/20', text: 'text-white/30', label: '' },
  };
  const c = colors[status] || colors.upcoming;

  return (
    <div className="relative pl-16 pb-10 last:pb-0">
      {/* Point sur la timeline */}
      <div className={`absolute left-4 top-1 w-4 h-4 rounded-full ${c.dot} -translate-x-1/2 ring-4 ring-dark-900`} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-white/20 text-xs font-mono">{phase}</span>
            <h3 className="font-display font-bold text-xl text-white">{titre}</h3>
            {c.label && (
              <span className={`text-xs font-semibold ${c.text} uppercase tracking-widest`}>{c.label}</span>
            )}
          </div>
          <p className="text-white/50 text-sm leading-relaxed max-w-xl">{desc}</p>
        </div>
        <span className="text-white/30 text-xs shrink-0 mt-1">{date}</span>
      </div>
    </div>
  );
}

// Composant accordéon pour le règlement
function RuleAccordion({ titre, contenu, isOpen, onToggle }) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-semibold text-white">{titre}</span>
        <svg
          className={`w-4 h-4 text-white/40 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-4 text-white/50 text-sm leading-relaxed border-t border-white/10">
          <p className="pt-4">{contenu}</p>
        </div>
      )}
    </div>
  );
}

// Stat simple
function StatItem({ value, label, sub }) {
  return (
    <div className="text-center px-4 py-2">
      <div className="font-display font-black text-3xl md:text-4xl text-primary-400">{value}</div>
      <div className="font-semibold text-white text-sm mt-1">{label}</div>
      <div className="text-white/30 text-xs mt-0.5">{sub}</div>
    </div>
  );
}
