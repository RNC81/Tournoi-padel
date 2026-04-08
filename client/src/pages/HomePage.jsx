import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

// Page d'accueil publique — présentation du tournoi Paris Yaar Club
export default function HomePage() {
  const [teamCount, setTeamCount] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    // Charger le nombre d'équipes et le statut du tournoi
    api.get('/teams/count').then(r => setTeamCount(r.data)).catch(() => {});
    api.get('/tournament').then(r => setTournamentStatus(r.data.status)).catch(() => {});
    api.get('/qrcode').then(r => setQrCode(r.data.qr)).catch(() => {});
  }, []);

  const statusLabel = {
    registration: { text: 'Inscriptions ouvertes', color: 'bg-primary-500' },
    group_stage:  { text: 'Phase de poules en cours', color: 'bg-gold-500' },
    knockout:     { text: 'Phase finale en cours', color: 'bg-orange-500' },
    finished:     { text: 'Tournoi terminé', color: 'bg-gray-500' },
  };

  const currentStatus = statusLabel[tournamentStatus];

  return (
    <div className="min-h-screen bg-dark-900">
      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Fond avec gradient vert */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-800 via-dark-900 to-primary-900 opacity-90" />
        <div className="absolute inset-0 bg-[url('/court-pattern.svg')] opacity-5" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center">
          {/* Badge club */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-sm text-white/80 font-medium">Paris Yaar Club</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-black text-white mb-4 leading-tight">
            TOURNOI DE<br />
            <span className="text-primary-400">PADEL</span>
          </h1>

          <p className="text-xl text-white/60 mb-8 max-w-xl mx-auto">
            Le grand tournoi de padel organisé par le Paris Yaar Club.
            Équipes, poules, élimination directe — tout en temps réel.
          </p>

          {/* Statut du tournoi */}
          {currentStatus && (
            <div className={`inline-flex items-center gap-2 ${currentStatus.color} text-dark-900 font-bold px-4 py-2 rounded-full text-sm mb-8`}>
              <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              {currentStatus.text}
            </div>
          )}

          {/* Compteur d'équipes */}
          {teamCount && (
            <div className="text-white/60 mb-10 text-sm">
              <span className="text-white font-bold text-2xl">{teamCount.count}</span>
              <span className="mx-1">/</span>
              <span>{teamCount.max} équipes inscrites</span>
            </div>
          )}

          {/* Actions principales */}
          <div className="flex flex-wrap gap-4 justify-center">
            {tournamentStatus === 'registration' && (
              <Link to="/inscription" className="btn-gold text-lg px-8 py-4">
                Inscrire mon équipe →
              </Link>
            )}
            <Link to="/groupes" className="btn-outline text-lg px-8 py-4">
              Voir les matchs
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CONTENU PRINCIPAL ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">

        {/* Navigation rapide */}
        <div className="md:col-span-2 grid sm:grid-cols-2 gap-4">
          <NavCard
            to="/groupes"
            icon="🎾"
            title="Poules"
            desc="Résultats et classements de la phase de poule"
            color="from-primary-800 to-primary-900"
          />
          <NavCard
            to="/bracket"
            icon="🏆"
            title="Bracket principal"
            desc="Tableau d'élimination directe"
            color="from-gold-600 to-yellow-900"
          />
          <NavCard
            to="/consolante"
            icon="🎖️"
            title="Bracket consolante"
            desc="Tournoi pour les équipes éliminées en poule"
            color="from-blue-800 to-blue-900"
          />
          <NavCard
            to="/inscription"
            icon="📝"
            title="Inscription"
            desc="Inscrire votre équipe au tournoi"
            color="from-purple-800 to-purple-900"
          />
        </div>

        {/* QR Code + Instagram */}
        <div className="space-y-6">
          {/* QR Code */}
          {qrCode && (
            <div className="card text-center">
              <h3 className="font-display font-bold text-lg mb-3">Suivre le tournoi</h3>
              <img src={qrCode} alt="QR code du site" className="mx-auto w-40 h-40 rounded-lg" />
              <p className="text-white/50 text-xs mt-2">Scanner pour accéder depuis votre téléphone</p>
            </div>
          )}

          {/* Instagram */}
          <div className="card text-center">
            <h3 className="font-display font-bold text-lg mb-2">Nous suivre</h3>
            <a
              href="https://www.instagram.com/paris.yaar.club"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              @paris.yaar.club
            </a>
          </div>
        </div>
      </div>

      {/* ─── RÈGLEMENT ─────────────────────────────────────────────────────── */}
      <section className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="font-display text-3xl font-bold text-center mb-10">
            Règlement du tournoi
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <RuleCard
              number="01"
              title="Format"
              text="Tournoi en double (2v2). Phase de poules puis élimination directe. Un bracket consolante est organisé pour tous les perdants de poule."
            />
            <RuleCard
              number="02"
              title="Scoring"
              text="Les matchs se jouent en best of 3 sets. Chaque set se joue en 6 jeux, avec tie-break à 6-6. En cas d'égalité de sets, un super tie-break (10 points) décide."
            />
            <RuleCard
              number="03"
              title="Classement"
              text="En poule : victoire = 3 pts, défaite = 0 pts. Départage par différence de sets, puis jeux. Les 2 premiers (ou plus selon le format) sont qualifiés."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Carte de navigation rapide
function NavCard({ to, icon, title, desc, color }) {
  return (
    <Link to={to} className={`bg-gradient-to-br ${color} border border-white/10 rounded-xl p-5 hover:border-white/30 transition-all hover:-translate-y-0.5 group`}>
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-display font-bold text-lg text-white mb-1 group-hover:text-primary-400 transition-colors">{title}</h3>
      <p className="text-white/50 text-sm">{desc}</p>
    </Link>
  );
}

// Carte règlement
function RuleCard({ number, title, text }) {
  return (
    <div className="card">
      <span className="text-primary-500 font-display font-black text-4xl">{number}</span>
      <h3 className="font-bold text-lg mt-2 mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
