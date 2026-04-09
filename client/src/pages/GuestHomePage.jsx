import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import usePolling from '../hooks/usePolling';

// Vue joueur — lecture seule, accessible sans connexion
// Polling automatique toutes les 30s pour les scores en live
export default function GuestHomePage() {
  const [activeTab, setActiveTab] = useState('groupes');
  const [tournament, setTournament] = useState(null);
  const [groups, setGroups] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, gRes] = await Promise.all([
        api.get('/tournament').catch(() => ({ data: null })),
        api.get('/tournament/groups').catch(() => ({ data: [] })),
      ]);
      setTournament(tRes.data);
      setGroups(gRes.data || []);
      setLastUpdate(new Date());
    } catch (err) {
      // Silencieux — le tournoi n'est pas encore lancé
    } finally {
      setLoading(false);
    }
  }, []);

  // Premier chargement + polling toutes les 30s
  usePolling(fetchData, 30000, true);

  const tournamentStarted = tournament && tournament.status !== 'registration';

  const tabs = [
    { id: 'groupes', label: 'Poules', icon: '🎾' },
    { id: 'bracket', label: 'Bracket', icon: '🏆' },
    { id: 'consolante', label: 'Consolante', icon: '🎖️' },
  ];

  return (
    <div className="min-h-screen bg-dark-900 pt-16">
      {/* Header de la vue joueur */}
      <div className="border-b border-white/10 bg-dark-800/50 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            {/* Onglets */}
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Indicateur de live */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-xs text-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                <span className="hidden sm:inline">
                  Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="sm:hidden">Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <LoadingState />
        ) : !tournamentStarted ? (
          <PreTournamentState />
        ) : (
          <>
            {activeTab === 'groupes' && <GroupsTab groups={groups} />}
            {activeTab === 'bracket' && <BracketPlaceholder type="principal" />}
            {activeTab === 'consolante' && <BracketPlaceholder type="consolante" />}
          </>
        )}
      </div>
    </div>
  );
}

// État de chargement
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-white/30">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm">Chargement du tournoi...</p>
    </div>
  );
}

// État avant le début du tournoi
function PreTournamentState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-6xl mb-6">🎾</div>
      <h2 className="font-display font-black text-3xl text-white mb-3">
        Le tournoi n'a pas encore commencé
      </h2>
      <p className="text-white/40 max-w-md leading-relaxed mb-8">
        Les poules seront disponibles ici dès que le tirage au sort sera effectué par les organisateurs.
        Reviens le <span className="text-primary-400 font-semibold">14 Mai 2026</span> !
      </p>
      <div className="flex items-center gap-2 text-sm text-white/20">
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
        Cette page se rafraîchit automatiquement toutes les 30 secondes
      </div>
    </div>
  );
}

// Onglet Groupes / Poules
function GroupsTab({ groups }) {
  if (!groups || groups.length === 0) {
    return <PreTournamentState />;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display font-black text-2xl text-white">
        Phase de poules — {groups.length} groupes
      </h2>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {groups.map(group => (
          <GroupCard key={group.name} group={group} />
        ))}
      </div>
    </div>
  );
}

// Carte d'un groupe avec classement et matchs
function GroupCard({ group }) {
  const [showMatches, setShowMatches] = useState(false);
  const playedMatches = group.matches?.filter(m => m.played) || [];
  const totalMatches = group.matches?.length || 0;

  return (
    <div className="card space-y-4">
      {/* Header groupe */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center font-display font-black text-primary-400 text-xl">
            {group.name}
          </div>
          <div>
            <div className="font-bold text-white">Groupe {group.name}</div>
            <div className="text-white/30 text-xs">{group.teams?.length} équipes · {playedMatches.length}/{totalMatches} matchs</div>
          </div>
        </div>
      </div>

      {/* Classement */}
      <div className="space-y-1">
        {group.standings?.map((s, i) => (
          <div
            key={s.team?._id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              i < 2 ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-white/5'
            }`}
          >
            <span className={`w-5 text-center font-bold ${i < 2 ? 'text-primary-400' : 'text-white/30'}`}>
              {i + 1}
            </span>
            <span className="flex-1 font-medium text-white truncate">{s.team?.name || '—'}</span>
            <div className="flex items-center gap-3 text-white/50 shrink-0">
              <span title="Sets gagnés/perdus" className="text-xs">{s.setsFor}/{s.setsAgainst}</span>
              <span className={`font-bold ${i < 2 ? 'text-primary-400' : 'text-white'}`}>{s.points} pts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Matchs (toggle) */}
      {totalMatches > 0 && (
        <button
          onClick={() => setShowMatches(!showMatches)}
          className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1 border-t border-white/10 pt-3 flex items-center justify-center gap-1"
        >
          {showMatches ? 'Masquer' : 'Voir'} les matchs
          <svg className={`w-3 h-3 transition-transform ${showMatches ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {showMatches && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          {group.matches?.map(match => (
            <MatchRow key={match._id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

// Ligne d'un match
function MatchRow({ match }) {
  if (!match.played) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3 text-sm">
        <span className="flex-1 text-white/50 truncate">{match.team1?.name}</span>
        <span className="text-white/20 text-xs font-mono">vs</span>
        <span className="flex-1 text-right text-white/50 truncate">{match.team2?.name}</span>
      </div>
    );
  }

  // Scores des sets
  const setsStr = match.sets?.map(s => `${s.score1}-${s.score2}`).join('  ') || '';
  const t1Wins = match.sets?.filter(s => s.score1 > s.score2).length || 0;
  const t2Wins = match.sets?.filter(s => s.score2 > s.score1).length || 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-sm">
      <span className={`flex-1 truncate font-medium ${t1Wins > t2Wins ? 'text-white' : 'text-white/40'}`}>
        {match.team1?.name}
      </span>
      <div className="text-center shrink-0">
        <div className="font-mono text-xs text-white/40">{setsStr}</div>
        <div className="font-bold text-white text-xs">{t1Wins} — {t2Wins}</div>
      </div>
      <span className={`flex-1 text-right truncate font-medium ${t2Wins > t1Wins ? 'text-white' : 'text-white/40'}`}>
        {match.team2?.name}
      </span>
    </div>
  );
}

// Placeholder bracket (à implémenter dans une prochaine session)
function BracketPlaceholder({ type }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">{type === 'principal' ? '🏆' : '🎖️'}</div>
      <h2 className="font-display font-black text-2xl text-white mb-2">
        {type === 'principal' ? 'Bracket principal' : 'Bracket consolante'}
      </h2>
      <p className="text-white/40 text-sm max-w-sm">
        Le bracket sera disponible une fois la phase de poules terminée.
      </p>
    </div>
  );
}
