// GuestHomePage — Vue joueur, lecture seule, accessible sans connexion.
// Appelle /api/public/* avec la clé API depuis VITE_PUBLIC_API_KEY (env Render).
// Polling toutes les 30s sur tous les endpoints.
// Thème : sports editorial clair (beige / forest / lime).

import { useState, useCallback, useEffect } from 'react';
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
  const [activeTab,   setActiveTab]   = useState('groupes');
  const [config,      setConfig]      = useState(null);
  const [tournament,  setTournament]  = useState(null); // pour qualificationRules
  const [groups,      setGroups]      = useState([]);
  const [bracket,     setBracket]     = useState({});
  const [consolante,  setConsolante]  = useState({});
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState(false);

  // Charge les 5 endpoints en parallèle — allSettled pour ne pas tout bloquer
  // si un seul échoue (ex: bracket pas encore généré)
  const fetchAll = useCallback(async () => {
    const [cfgRes, trnRes, grpRes, bktRes, conRes] = await Promise.allSettled([
      publicApi.get('/config'),
      publicApi.get('/tournament'),
      publicApi.get('/groups', { params: { phase: 'pool' } }),
      publicApi.get('/bracket'),
      publicApi.get('/bracket/consolante'),
    ]);

    if (cfgRes.status === 'fulfilled') setConfig(cfgRes.value.data);
    if (trnRes.status === 'fulfilled') setTournament(trnRes.value.data);
    if (grpRes.status === 'fulfilled') setGroups(grpRes.value.data || []);
    if (bktRes.status === 'fulfilled') setBracket(bktRes.value.data || {});
    if (conRes.status === 'fulfilled') setConsolante(conRes.value.data || {});

    // Erreur totale si /config et /tournament échouent tous les deux
    const allFailed = [cfgRes, trnRes, grpRes, bktRes, conRes].every(r => r.status === 'rejected');
    setApiError(allFailed);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  // Polling toutes les 15s — le tournoi c'est du live
  usePolling(fetchAll, 15000, true);

  // Rafraîchissement immédiat quand le spectateur revient sur l'onglet
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAll]);

  const hasGroups     = groups.length > 0;
  const hasBracket    = Object.keys(bracket).length > 0;
  const hasConsolante = Object.keys(consolante).length > 0;
  const hasStarted    = config?.status && config.status !== 'setup' && config.status !== 'registration';

  // Nombre de qualifiés par groupe : Math.floor(bracketTarget / nbGroupes)
  // Défaut : 2 si les données ne sont pas encore chargées
  const bracketTarget = tournament?.qualificationRules?.bracketTarget ?? 32;
  const qualPerGroup  = hasGroups ? Math.max(1, Math.floor(bracketTarget / groups.length)) : 2;

  const tabs = [
    { id: 'groupes',    label: 'Poules',     active: hasGroups    },
    { id: 'bracket',    label: 'Bracket',    active: hasBracket   },
    { id: 'consolante', label: 'Consolante', active: hasConsolante },
  ];

  return (
    <div className="min-h-screen bg-beige pt-16">

      {/* ── Barre d'onglets sticky ── */}
      <div className="border-b border-forest/10 bg-beige/90 backdrop-blur-sm sticky top-16 z-40">
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
                      ? 'bg-forest/10 text-forest'
                      : 'text-forest/40 hover:text-forest/70'
                  }`}
                >
                  {tab.label}
                  {/* Point vert si données disponibles */}
                  {tab.active && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-lime" />
                  )}
                </button>
              ))}
            </div>

            {/* Indicateur "Mis à jour à HH:MM" */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-xs text-forest/40">
                <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse shrink-0" />
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
            ? <GroupsTab groups={groups} qualPerGroup={qualPerGroup} />
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
    <div className="flex flex-col items-center justify-center py-32 text-forest/30">
      <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm">Chargement du tournoi...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-forest/40 text-sm mb-2">Impossible de contacter le serveur.</p>
      <p className="text-forest/25 text-xs">La page se rafraîchit automatiquement toutes les 30 secondes.</p>
    </div>
  );
}

function NotStartedState({ label, config, hasStarted }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      {/* Balle padel stylisée en SVG */}
      <div
        className="w-14 h-14 rounded-full mb-5 flex items-center justify-center"
        style={{ background: '#c8e832' }}
      >
        <svg className="w-8 h-8 text-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
          <path d="M3.5 8.5 Q12 5 20.5 8.5" strokeWidth="1.5" fill="none"/>
          <path d="M3.5 15.5 Q12 19 20.5 15.5" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
      <h2 className="font-display font-black text-2xl text-forest mb-3">
        {hasStarted ? `Les ${label} ne sont pas encore disponibles` : 'Le tournoi n\'a pas encore commencé'}
      </h2>
      {config?.date && (
        <p className="text-forest/50 text-sm mb-2">
          Date : <span className="text-forest font-semibold">
            {new Date(config.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </p>
      )}
      {config?.location && (
        <p className="text-forest/50 text-sm mb-6">{config.location}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-forest/30 mt-4">
        <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
        Cette page se rafraîchit automatiquement
      </div>
    </div>
  );
}

// ─── Onglet Groupes ───────────────────────────────────────────────────────────

function GroupsTab({ groups, qualPerGroup }) {
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-forest/50 text-sm">
          {groups.length} groupes · {qualPerGroup} qualifié{qualPerGroup > 1 ? 's' : ''} par groupe
        </p>
        <div className="flex items-center gap-3 text-xs text-forest/40">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-forest/10 border border-forest/20" />
            Qualifié
          </span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(group => (
          <GroupCard key={group._id} group={group} qualPerGroup={qualPerGroup} />
        ))}
      </div>
    </div>
  );
}

// ─── GroupCard : classement + matchs lazy-loaded ──────────────────────────────

function GroupCard({ group, qualPerGroup }) {
  const [showMatches, setShowMatches] = useState(false);
  const [matches,     setMatches]     = useState(null);
  const [loadingM,    setLoadingM]    = useState(false);

  const totalTeams  = group.teams?.length || 0;
  const maxMatches  = (totalTeams * (totalTeams - 1)) / 2;
  const playedCount = group.standings?.reduce((acc, s) => acc + (s.played || 0), 0) / 2 | 0;

  const handleToggleMatches = async () => {
    if (showMatches) { setShowMatches(false); return; }
    if (matches !== null) { setShowMatches(true); return; }

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
    <div className="bg-white border border-forest/12 rounded-2xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-forest/8 bg-forest-50">
        <div className="w-9 h-9 bg-forest/10 rounded-xl flex items-center justify-center font-display font-black text-forest text-lg shrink-0">
          {group.name}
        </div>
        <div>
          <p className="font-semibold text-forest text-sm">Groupe {group.name}</p>
          <p className="text-forest/40 text-xs">{totalTeams} équipes · {playedCount}/{maxMatches} matchs joués</p>
        </div>
      </div>

      {/* Classement */}
      <div className="px-3 py-2 space-y-1">
        {group.standings?.map((s, i) => {
          const teamName = formatTeamName(s.team?.player1, s.team?.player2) || s.team?.name || '—';
          // Les `qualPerGroup` premières équipes sont surlignées comme qualifiées
          const isQual   = i < qualPerGroup;

          return (
            <div
              key={s.teamId}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isQual
                  ? 'bg-forest/8 border border-forest/15'
                  : 'bg-forest/3 hover:bg-forest/5'
              }`}
            >
              {/* Rang */}
              <span className={`w-4 text-center text-xs font-bold shrink-0 ${isQual ? 'text-forest' : 'text-forest/25'}`}>
                {i + 1}
              </span>

              {/* Barre lime pour les qualifiés */}
              {isQual && (
                <span
                  className="w-0.5 h-4 rounded-full shrink-0"
                  style={{ background: '#c8e832' }}
                />
              )}

              {/* Nom de l'équipe */}
              <span className={`flex-1 font-medium text-xs truncate ${isQual ? 'text-forest' : 'text-forest/60'}`}>
                {teamName}
              </span>

              {/* Stats */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-forest/35 text-xs font-mono" title="Sets pour/contre">
                  {s.setsFor ?? 0}/{s.setsAgainst ?? 0}
                </span>
                <span className={`text-xs font-bold tabular-nums w-8 text-right ${isQual ? 'text-forest' : 'text-forest/50'}`}>
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
        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 border-t border-forest/8 text-xs text-forest/35 hover:text-forest/60 hover:bg-forest-50 transition-colors disabled:opacity-50"
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </>
        )}
      </button>

      {/* Liste des matchs */}
      {showMatches && matches !== null && (
        <div className="border-t border-forest/8 px-3 py-2 space-y-1.5 bg-forest-50">
          {matches.length === 0 ? (
            <p className="text-forest/30 text-xs text-center py-2">Aucun match enregistré</p>
          ) : (
            matches.map(match => <MatchRow key={match._id} match={match} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── MatchRow ─────────────────────────────────────────────────────────────────

function MatchRow({ match }) {
  const t1Name = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || '—';
  const t2Name = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || '—';

  const t1Wins = match.sets?.filter(s => s.score1 > s.score2).length || 0;
  const t2Wins = match.sets?.filter(s => s.score2 > s.score1).length || 0;

  if (!match.played) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 rounded-lg bg-forest/3 text-xs">
        <span className="text-forest/40 truncate">{t1Name}</span>
        <span className="text-forest/20 font-mono">vs</span>
        <span className="text-forest/40 truncate text-right">{t2Name}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white text-xs border border-forest/8">
      <span className={`truncate font-medium ${t1Wins > t2Wins ? 'text-forest font-semibold' : 'text-forest/35'}`}>
        {t1Name}
      </span>
      <div className="text-center shrink-0 px-1">
        {match.sets?.map((s, i) => (
          <span key={i} className="font-mono text-forest/40">
            {i > 0 && <span className="text-forest/20 mx-0.5">·</span>}
            <span className={s.score1 > s.score2 ? 'text-forest/80' : ''}>{s.score1}</span>
            <span className="text-forest/20">-</span>
            <span className={s.score2 > s.score1 ? 'text-forest/80' : ''}>{s.score2}</span>
          </span>
        ))}
      </div>
      <span className={`truncate text-right font-medium ${t2Wins > t1Wins ? 'text-forest font-semibold' : 'text-forest/35'}`}>
        {t2Name}
      </span>
    </div>
  );
}

// ─── Onglet Bracket ───────────────────────────────────────────────────────────

function BracketTab({ data, phases, isFinalPhase, accent = 'primary' }) {
  const activePhases = phases.filter(p => data[p]?.length > 0);

  if (activePhases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-forest/40 text-sm">Le bracket n'est pas encore disponible.</p>
      </div>
    );
  }

  const firstPhase = activePhases[0];
  const maxMatches = data[firstPhase]?.length || 1;
  const minHeight  = Math.max(maxMatches * 72, 300);

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
  const labelColor = isFinalPhase
    ? (accent === 'violet' ? 'text-violet-600' : 'text-lime-dark font-bold')
    : 'text-forest/40';

  return (
    <div className="flex flex-col w-52 shrink-0">
      <div className={`text-center text-xs uppercase tracking-widest mb-3 font-medium ${labelColor}`}>
        {ROUND_LABELS[phase]}
        <span className="text-forest/25 ml-1.5 font-normal normal-case tracking-normal">
          ({matches.length})
        </span>
      </div>

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

// ─── ReadOnlyMatchCard ────────────────────────────────────────────────────────

function ReadOnlyMatchCard({ match, isFinal, accent = 'primary' }) {
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isPlayed   = match.played && !isByeMatch;
  const isPending  = !match.played && (!match.team1 || !match.team2);

  const winner = String(match.winner?._id || match.winner || '');
  const t1id   = String(match.team1?._id  || match.team1  || '');
  const t2id   = String(match.team2?._id  || match.team2  || '');
  const t1Win  = isPlayed && winner && winner === t1id;
  const t2Win  = isPlayed && winner && winner === t2id;

  // Bordures spéciales pour les finales
  const finalBorder = accent === 'violet'
    ? 'border-violet-300 bg-violet-50'
    : 'border-lime/60 bg-lime/5';

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isFinal    ? finalBorder
      : isPlayed ? 'border-forest/12 bg-white'
      : isPending? 'border-forest/6 bg-beige opacity-50'
                 : 'border-forest/20 bg-forest-50'
    }`}>
      <TeamSlot match={match} side={1} isWinner={t1Win} isLoser={isPlayed && !t1Win && !!match.team1} />
      {isPlayed && match.sets?.length > 0 && (
        <div className="px-3 py-1 flex items-center gap-1.5 border-y border-forest/8 bg-forest/3">
          {match.sets.map((s, i) => (
            <span key={i} className="text-xs font-mono text-forest/40">
              {i > 0 && <span className="text-forest/20 mr-1.5">·</span>}
              <span className={s.score1 > s.score2 ? 'text-forest/80' : ''}>{s.score1}</span>
              <span className="text-forest/20">-</span>
              <span className={s.score2 > s.score1 ? 'text-forest/80' : ''}>{s.score2}</span>
            </span>
          ))}
        </div>
      )}
      <TeamSlot match={match} side={2} isWinner={t2Win} isLoser={isPlayed && !t2Win && !!match.team2} />
    </div>
  );
}

// ─── TeamSlot ─────────────────────────────────────────────────────────────────

function TeamSlot({ match, side, isWinner, isLoser }) {
  const team       = side === 1 ? match.team1 : match.team2;
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isBye      = isByeMatch && !team;

  if (isBye)   return <div className="px-3 py-1.5 text-xs text-forest/20 italic">BYE</div>;
  if (!team)   return <div className="px-3 py-1.5 text-xs text-forest/20">—</div>;

  const label = formatTeamName(team.player1, team.player2) || team.name;

  return (
    <div className={`px-3 py-1.5 text-xs truncate ${
      isWinner ? 'text-forest font-semibold'
      : isLoser ? 'text-forest/30 line-through'
      : 'text-forest/65'
    }`}>
      {label}
    </div>
  );
}
