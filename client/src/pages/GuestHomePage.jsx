// GuestHomePage — Vue joueur, lecture seule, accessible sans connexion.
// Appelle /api/public/* avec la clé API depuis VITE_PUBLIC_API_KEY (env Render).
// Polling toutes les 30s sur tous les endpoints.

import { useState, useCallback } from 'react';
import publicApi from '../utils/publicApi';
import usePolling from '../hooks/usePolling';
import { formatTeamName } from '../utils/formatTeam';

// ─── Constantes bracket ───────────────────────────────────────────────────────

const ROUND_LABELS = {
  r64:              '64èmes',
  r32:              '32èmes',
  r16:              '16èmes',
  qf:               'Quarts',
  sf:               'Demis',
  final:            'Finale',
  consolante_r32:   '32èmes C',
  consolante_r16:   '16èmes C',
  consolante_qf:    'Quarts C',
  consolante_sf:    'Demis C',
  consolante_final: 'Finale C',
};

const MAIN_PHASES       = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];
const CONSOLANTE_PHASES = ['consolante_r32', 'consolante_r16', 'consolante_qf', 'consolante_sf', 'consolante_final'];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GuestHomePage() {
  const [activeTab,  setActiveTab]  = useState('groupes');
  const [config,     setConfig]     = useState(null);
  const [groups,     setGroups]     = useState([]);
  const [bracket,    setBracket]    = useState({});
  const [consolante, setConsolante] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [apiError,   setApiError]   = useState(false);

  // Charge les 4 endpoints en parallèle — allSettled pour ne pas tout bloquer
  // si un seul échoue (ex: bracket pas encore généré)
  const fetchAll = useCallback(async () => {
    // /config n'a pas besoin de clé API — on peut toujours l'appeler
    const [cfgRes, grpRes, bktRes, conRes] = await Promise.allSettled([
      publicApi.get('/config'),
      publicApi.get('/groups', { params: { phase: 'pool' } }),
      publicApi.get('/bracket'),
      publicApi.get('/bracket/consolante'),
    ]);

    if (cfgRes.status === 'fulfilled') setConfig(cfgRes.value.data);
    if (grpRes.status === 'fulfilled') setGroups(grpRes.value.data || []);
    if (bktRes.status === 'fulfilled') setBracket(bktRes.value.data || {});
    if (conRes.status === 'fulfilled') setConsolante(conRes.value.data || {});

    // Erreur API si même /config échoue (clé manquante ou serveur down)
    const allFailed = [cfgRes, grpRes, bktRes, conRes].every(r => r.status === 'rejected');
    setApiError(allFailed);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  usePolling(fetchAll, 30000, true);

  // Tournoi "démarré" si on a des groupes ou des matchs de bracket
  const hasGroups    = groups.length > 0;
  const hasBracket   = Object.keys(bracket).length > 0;
  const hasConsolante = Object.keys(consolante).length > 0;
  const hasStarted   = config?.status && config.status !== 'setup' && config.status !== 'registration';

  const tabs = [
    { id: 'groupes',    label: 'Poules',     active: hasGroups    },
    { id: 'bracket',    label: 'Bracket',    active: hasBracket   },
    { id: 'consolante', label: 'Consolante', active: hasConsolante },
  ];

  return (
    <div className="min-h-screen bg-dark-900 pt-16">

      {/* ── Barre d'onglets sticky ── */}
      <div className="border-b border-white/10 bg-dark-800/60 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">

            {/* Onglets */}
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                  {/* Point vert si données disponibles */}
                  {tab.active && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Indicateur "Mis à jour à HH:MM" */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-xs text-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse shrink-0" />
                <span>
                  Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <LoadingState />
        ) : apiError ? (
          <ErrorState />
        ) : activeTab === 'groupes' ? (
          hasGroups
            ? <GroupsTab groups={groups} />
            : <NotStartedState label="poules" config={config} hasStarted={hasStarted} />
        ) : activeTab === 'bracket' ? (
          hasBracket
            ? <BracketTab data={bracket} phases={MAIN_PHASES} isFinalPhase="final" />
            : <NotStartedState label="bracket principal" config={config} hasStarted={hasStarted} />
        ) : (
          hasConsolante
            ? <BracketTab data={consolante} phases={CONSOLANTE_PHASES} isFinalPhase="consolante_final" accent="violet" />
            : <NotStartedState label="bracket consolante" config={config} hasStarted={hasStarted} />
        )}
      </div>
    </div>
  );
}

// ─── États vides / erreurs ────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-white/30">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm">Chargement du tournoi...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-white/40 text-sm mb-2">Impossible de contacter le serveur.</p>
      <p className="text-white/20 text-xs">La page se rafraîchit automatiquement toutes les 30 secondes.</p>
    </div>
  );
}

function NotStartedState({ label, config, hasStarted }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="text-5xl mb-5">🎾</div>
      <h2 className="font-display font-black text-2xl text-white mb-3">
        {hasStarted ? `Les ${label} ne sont pas encore disponibles` : 'Le tournoi n\'a pas encore commencé'}
      </h2>
      {config?.date && (
        <p className="text-white/40 text-sm mb-2">
          Date : <span className="text-primary-400 font-semibold">
            {new Date(config.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </p>
      )}
      {config?.location && (
        <p className="text-white/40 text-sm mb-6">{config.location}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-white/20 mt-4">
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
        Cette page se rafraîchit automatiquement
      </div>
    </div>
  );
}

// ─── Onglet Groupes ───────────────────────────────────────────────────────────

function GroupsTab({ groups }) {
  // Tri alphabétique
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <p className="text-white/40 text-sm">{groups.length} groupes · Classements en temps réel</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {sorted.map(group => (
          <GroupCard key={group._id} group={group} />
        ))}
      </div>
    </div>
  );
}

// ─── GroupCard : classement + matchs lazy-loaded ──────────────────────────────

function GroupCard({ group }) {
  const [showMatches, setShowMatches] = useState(false);
  const [matches,     setMatches]     = useState(null);  // null = pas encore chargé
  const [loadingM,    setLoadingM]    = useState(false);

  // Total matchs joués (depuis standings — approximation : 1 match = 2 équipes)
  const totalTeams  = group.teams?.length || 0;
  const maxMatches  = (totalTeams * (totalTeams - 1)) / 2;
  const playedCount = group.standings?.reduce((acc, s) => acc + (s.played || 0), 0) / 2 | 0;

  const handleToggleMatches = async () => {
    if (showMatches) { setShowMatches(false); return; }
    if (matches !== null) { setShowMatches(true); return; }

    // Chargement lazy : détail du groupe avec les matchs
    setLoadingM(true);
    try {
      const res = await publicApi.get(`/groups/${group._id}`);
      setMatches(res.data.matches || []);
    } catch {
      setMatches([]);
    } finally {
      setLoadingM(false);
      setShowMatches(true);
    }
  };

  return (
    <div className="bg-dark-800 border border-white/10 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
        <div className="w-9 h-9 bg-primary-500/15 rounded-xl flex items-center justify-center font-display font-black text-primary-400 text-lg shrink-0">
          {group.name}
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Groupe {group.name}</p>
          <p className="text-white/30 text-xs">{totalTeams} équipes · {playedCount}/{maxMatches} matchs joués</p>
        </div>
      </div>

      {/* Classement */}
      <div className="px-3 py-2 space-y-1">
        {group.standings?.map((s, i) => {
          const teamName = formatTeamName(s.team?.player1, s.team?.player2) || s.team?.name || '—';
          const isQual   = i < 2; // indicatif — l'admin décide du nombre réel de qualifiés

          return (
            <div
              key={s.teamId}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm ${
                isQual ? 'bg-primary-500/8 border border-primary-500/15' : 'bg-white/3'
              }`}
            >
              {/* Rang */}
              <span className={`w-4 text-center text-xs font-bold shrink-0 ${isQual ? 'text-primary-400' : 'text-white/25'}`}>
                {i + 1}
              </span>

              {/* Nom de l'équipe */}
              <span className="flex-1 font-medium text-white text-xs truncate">{teamName}</span>

              {/* Stats */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-white/30 text-xs font-mono" title="Sets pour/contre">
                  {s.setsFor ?? 0}/{s.setsAgainst ?? 0}
                </span>
                <span className={`text-xs font-bold tabular-nums w-8 text-right ${isQual ? 'text-primary-400' : 'text-white/60'}`}>
                  {s.points ?? 0} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toggle matchs */}
      <button
        onClick={handleToggleMatches}
        disabled={loadingM}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 border-t border-white/8 text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
      >
        {loadingM ? (
          <span>Chargement...</span>
        ) : (
          <>
            <span>{showMatches ? 'Masquer les matchs' : 'Voir les matchs'}</span>
            <svg
              className={`w-3 h-3 transition-transform ${showMatches ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Liste des matchs */}
      {showMatches && matches !== null && (
        <div className="border-t border-white/8 px-3 py-2 space-y-1.5">
          {matches.length === 0 ? (
            <p className="text-white/25 text-xs text-center py-2">Aucun match enregistré</p>
          ) : (
            matches.map(match => <MatchRow key={match._id} match={match} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── MatchRow : une ligne de résultat de match ────────────────────────────────

function MatchRow({ match }) {
  const t1Name = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || '—';
  const t2Name = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || '—';

  const t1Wins = match.sets?.filter(s => s.score1 > s.score2).length || 0;
  const t2Wins = match.sets?.filter(s => s.score2 > s.score1).length || 0;

  if (!match.played) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/3 text-xs">
        <span className="text-white/40 truncate">{t1Name}</span>
        <span className="text-white/15 font-mono">vs</span>
        <span className="text-white/40 truncate text-right">{t2Name}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 text-xs">
      <span className={`truncate font-medium ${t1Wins > t2Wins ? 'text-white' : 'text-white/35'}`}>{t1Name}</span>
      <div className="text-center shrink-0 px-1">
        {match.sets?.map((s, i) => (
          <span key={i} className="font-mono text-white/40">
            {i > 0 && <span className="text-white/15 mx-0.5">·</span>}
            <span className={s.score1 > s.score2 ? 'text-white/80' : ''}>{s.score1}</span>
            <span className="text-white/20">-</span>
            <span className={s.score2 > s.score1 ? 'text-white/80' : ''}>{s.score2}</span>
          </span>
        ))}
      </div>
      <span className={`truncate text-right font-medium ${t2Wins > t1Wins ? 'text-white' : 'text-white/35'}`}>{t2Name}</span>
    </div>
  );
}

// ─── Onglet Bracket (principal ou consolante) ─────────────────────────────────

function BracketTab({ data, phases, isFinalPhase, accent = 'primary' }) {
  // Ne garder que les phases qui ont des matchs
  const activePhases = phases.filter(p => data[p]?.length > 0);

  if (activePhases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-white/40 text-sm">Le bracket n'est pas encore disponible.</p>
      </div>
    );
  }

  // Hauteur minimale basée sur le plus grand round (premier round)
  const firstPhase  = activePhases[0];
  const maxMatches  = data[firstPhase]?.length || 1;
  const minHeight   = Math.max(maxMatches * 72, 300);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {activePhases.map(phase => (
          <BracketRound
            key={phase}
            phase={phase}
            matches={data[phase] || []}
            isFinalPhase={phase === isFinalPhase}
            accent={accent}
            containerHeight={minHeight}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BracketRound : une colonne de matchs ─────────────────────────────────────

function BracketRound({ phase, matches, isFinalPhase, accent, containerHeight }) {
  const accentColor = isFinalPhase
    ? (accent === 'violet' ? 'text-violet-400' : 'text-yellow-400')
    : 'text-white/30';

  return (
    <div className="flex flex-col w-52 shrink-0">
      {/* Label de la phase */}
      <div className={`text-center text-xs uppercase tracking-widest mb-3 font-medium ${accentColor}`}>
        {ROUND_LABELS[phase]}
        <span className="text-white/20 ml-1.5 font-normal normal-case tracking-normal">
          ({matches.length})
        </span>
      </div>

      {/* Matchs distribués verticalement */}
      <div
        className="flex flex-col justify-around flex-1"
        style={{ minHeight: containerHeight }}
      >
        {matches.map(match => (
          <div key={match._id} className="flex items-center px-1">
            <div className="w-full">
              <ReadOnlyMatchCard match={match} isFinal={isFinalPhase} accent={accent} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ReadOnlyMatchCard : carte de match sans interaction ──────────────────────

function ReadOnlyMatchCard({ match, isFinal, accent = 'primary' }) {
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isPlayed   = match.played && !isByeMatch;
  const isPending  = !match.played && (!match.team1 || !match.team2);

  const winner = String(match.winner?._id || match.winner || '');
  const t1id   = String(match.team1?._id  || match.team1  || '');
  const t2id   = String(match.team2?._id  || match.team2  || '');
  const t1Win  = isPlayed && winner && winner === t1id;
  const t2Win  = isPlayed && winner && winner === t2id;

  const finalBorder  = accent === 'violet' ? 'border-violet-500/40 bg-violet-500/5' : 'border-yellow-500/40 bg-yellow-500/5';

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isFinal    ? finalBorder
      : isPlayed ? 'border-white/10 bg-white/3'
      : isPending? 'border-white/5 bg-dark-800/50 opacity-50'
                 : 'border-primary-500/20 bg-dark-700'
    }`}>
      <TeamSlot match={match} side={1} isWinner={t1Win} isLoser={isPlayed && !t1Win && !!match.team1} />
      {isPlayed && match.sets?.length > 0 && (
        <div className="px-3 py-1 flex items-center gap-1.5 border-y border-white/5 bg-white/3">
          {match.sets.map((s, i) => (
            <span key={i} className="text-xs font-mono text-white/40">
              {i > 0 && <span className="text-white/15 mr-1.5">·</span>}
              <span className={s.score1 > s.score2 ? 'text-white/80' : ''}>{s.score1}</span>
              <span className="text-white/20">-</span>
              <span className={s.score2 > s.score1 ? 'text-white/80' : ''}>{s.score2}</span>
            </span>
          ))}
        </div>
      )}
      <TeamSlot match={match} side={2} isWinner={t2Win} isLoser={isPlayed && !t2Win && !!match.team2} />
    </div>
  );
}

// ─── TeamSlot : un côté d'un match de bracket ────────────────────────────────

function TeamSlot({ match, side, isWinner, isLoser }) {
  const team = side === 1 ? match.team1 : match.team2;
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isBye = isByeMatch && !team;

  if (isBye) {
    return <div className="px-3 py-1.5 text-xs text-white/20 italic">BYE</div>;
  }
  if (!team) {
    return <div className="px-3 py-1.5 text-xs text-white/15">—</div>;
  }

  const label = formatTeamName(team.player1, team.player2) || team.name;

  return (
    <div className={`px-3 py-1.5 text-xs truncate ${
      isWinner ? 'text-white font-semibold'
      : isLoser ? 'text-white/30 line-through'
      : 'text-white/70'
    }`}>
      {label}
    </div>
  );
}
