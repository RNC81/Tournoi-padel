import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatTeamName } from '../utils/formatTeam';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ROUND_LABELS = {
  r64: '64èmes', r32: '32èmes', r16: '16èmes', qf: 'Quarts', sf: 'Demis', final: 'Finale',
};

// Phases dans l'ordre du bracket (gauche → droite)
const ALL_PHASES = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];

// Options du sélecteur de bracket cible
const BRACKET_OPTIONS = [
  { label: '1/4',  size: 8,  desc: '8 équipes'  },
  { label: '1/8',  size: 16, desc: '16 équipes' },
  { label: '1/16', size: 32, desc: '32 équipes' },
  { label: '1/32', size: 64, desc: '64 équipes' },
];

// ─── SCORE MODAL ──────────────────────────────────────────────────────────────
// Même logique qu'AdminGroupsPage

function ScoreModal({ match, onClose, onSaved }) {
  // setFormat stocké sur le match (configuré à la génération du bracket)
  const maxSets = match.setFormat?.maxSets ?? 3;

  const initSets = () => {
    const existing = match.sets || [];
    return Array.from({ length: maxSets }, (_, i) => ({
      score1: existing[i]?.score1 ?? '',
      score2: existing[i]?.score2 ?? '',
    }));
  };

  const [sets,    setSets]    = useState(initSets);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const t1 = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || '?';
  const t2 = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || '?';

  const updateSet = (i, field, val) => {
    setSets(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val === '' ? '' : parseInt(val, 10) };
      return next;
    });
  };

  const handleSave = async () => {
    const filledSets = sets.filter(s => s.score1 !== '' && s.score2 !== '');
    if (!filledSets.length) { setError('Saisissez au moins un set joué'); return; }
    setLoading(true);
    setError('');
    try {
      await api.put(`/matches/${match._id}/score`, { sets: filledSets });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.delete(`/matches/${match._id}/score`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-dark-800 border border-white/15 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-display font-bold text-lg text-white mb-1">Saisie du score</h3>
        <p className="text-white/40 text-sm mb-5">
          {t1} <span className="text-white/20 mx-1">vs</span> {t2}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_2.5rem_1fr] gap-2 mb-2 text-xs text-white/30 text-center">
          <span className="text-right pr-2 truncate">{t1}</span>
          <span />
          <span className="text-left pl-2 truncate">{t2}</span>
        </div>

        <div className="space-y-2 mb-6">
          {sets.map((set, i) => (
            <div key={i} className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2">
              <input type="number" min="0" max="99" placeholder="—" value={set.score1}
                onChange={e => updateSet(i, 'score1', e.target.value)}
                className="input text-center text-lg font-bold py-2" />
              <div className="text-white/20 text-center text-sm font-bold">S{i + 1}</div>
              <input type="number" min="0" max="99" placeholder="—" value={set.score2}
                onChange={e => updateSet(i, 'score2', e.target.value)}
                className="input text-center text-lg font-bold py-2" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {match.played && match.sets?.length > 0 && (
            <button onClick={handleReset} disabled={loading}
              className="px-3 py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50">
              Réinitialiser
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white">Annuler</button>
            <button onClick={handleSave} disabled={loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
              {loading ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TEAM SLOT ────────────────────────────────────────────────────────────────
// Affiche un côté du match : équipe, BYE, ou slot vide en attente

function TeamSlot({ team, isBye, isWinner, isLoser }) {
  if (isBye) {
    return (
      <div className="px-3 py-1.5 text-xs text-white/20 italic">BYE</div>
    );
  }
  if (!team) {
    return (
      <div className="px-3 py-1.5 text-xs text-white/15">—</div>
    );
  }

  const label = formatTeamName(team.player1, team.player2) || team.name;

  return (
    <div className={`px-3 py-1.5 text-xs truncate transition-colors ${
      isWinner ? 'text-white font-semibold'
      : isLoser ? 'text-white/30 line-through'
      : 'text-white/70'
    }`}>
      {label}
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────

function MatchCard({ match, onScoreClick, isFinal }) {
  // Déterminer l'état du match
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isPlayed   = match.played && !isByeMatch;
  const isReady    = !match.played && match.team1 && match.team2;
  const isPending  = !match.played && (!match.team1 || !match.team2);

  const winner = match.winner?._id || String(match.winner || '');
  const t1id   = match.team1?._id  || String(match.team1  || '');
  const t2id   = match.team2?._id  || String(match.team2  || '');

  const t1IsWinner = isPlayed && winner && winner === t1id;
  const t2IsWinner = isPlayed && winner && winner === t2id;

  const clickable = isReady || isPlayed;

  return (
    <div
      onClick={clickable ? () => onScoreClick(match) : undefined}
      className={`rounded-xl border overflow-hidden transition-all select-none ${
        isFinal
          ? 'border-yellow-500/40 bg-yellow-500/5'
          : isPlayed
          ? 'border-white/10 bg-white/3'
          : isReady
          ? 'border-primary-500/30 bg-dark-700 hover:border-primary-500/60 hover:bg-dark-600'
          : 'border-white/5 bg-dark-800/50 opacity-50'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Équipe 1 */}
      <div className={`border-b ${isFinal ? 'border-yellow-500/20' : 'border-white/8'}`}>
        <TeamSlot
          team={isByeMatch ? (match.team1 || null) : match.team1}
          isBye={isByeMatch && !match.team1}
          isWinner={t1IsWinner}
          isLoser={isPlayed && !t1IsWinner && !!match.team1}
        />
      </div>

      {/* Scores (si joué et pas BYE) */}
      {isPlayed && match.sets?.length > 0 && (
        <div className="px-3 py-1 flex items-center gap-1.5 border-b border-white/5 bg-white/3">
          {match.sets.map((s, i) => (
            <span key={i} className="text-xs font-mono text-white/40">
              {i > 0 && <span className="text-white/15 mr-1.5">·</span>}
              <span className={s.score1 > s.score2 ? 'text-white/70' : ''}>{s.score1}</span>
              <span className="text-white/20">-</span>
              <span className={s.score2 > s.score1 ? 'text-white/70' : ''}>{s.score2}</span>
            </span>
          ))}
        </div>
      )}

      {/* Équipe 2 */}
      <div>
        <TeamSlot
          team={isByeMatch ? (match.team2 || null) : match.team2}
          isBye={isByeMatch && !match.team2}
          isWinner={t2IsWinner}
          isLoser={isPlayed && !t2IsWinner && !!match.team2}
        />
      </div>
    </div>
  );
}

// ─── BRACKET ROUND ────────────────────────────────────────────────────────────
// Une colonne du bracket (une phase)

function BracketRound({ phase, matches, onScoreClick, containerHeight }) {
  const isFinalRound = phase === 'final';
  return (
    <div className="flex flex-col w-52 flex-shrink-0">
      {/* Label de la phase */}
      <div className={`text-center text-xs uppercase tracking-widest mb-3 font-medium ${
        isFinalRound ? 'text-yellow-400' : 'text-white/30'
      }`}>
        {ROUND_LABELS[phase]}
        <span className="text-white/20 ml-1.5 font-normal normal-case tracking-normal">
          ({matches.length})
        </span>
      </div>

      {/* Matches distribués verticalement avec espacement égal */}
      <div
        className="flex flex-col justify-around flex-1"
        style={{ minHeight: containerHeight }}
      >
        {matches.map(match => (
          <div key={match._id} className="flex items-center px-1">
            <div className="w-full">
              <MatchCard
                match={match}
                onScoreClick={onScoreClick}
                isFinal={isFinalRound}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ÉTAT A : Formulaire de génération ───────────────────────────────────────

function GenerateBracket({ onGenerated }) {
  const [bracketTarget, setBracketTarget] = useState(32);
  const [groupCount,    setGroupCount]    = useState(0);
  const [totalTeams,    setTotalTeams]    = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [fetching,      setFetching]      = useState(true);
  const [error,         setError]         = useState('');

  // Charger le nombre de poules et le total d'équipes pour le preview
  useEffect(() => {
    Promise.all([
      api.get('/groups?phase=pool'),
      api.get('/teams'),
    ]).then(([groupsRes, teamsRes]) => {
      setGroupCount(groupsRes.data.length);
      setTotalTeams(teamsRes.data.length);
    }).catch(() => {}).finally(() => setFetching(false));
  }, []);

  // Calcul du preview en temps réel
  const qualPerGroup  = groupCount > 0 ? Math.floor(bracketTarget / groupCount) : 0;
  const wildcardSpots = groupCount > 0 ? bracketTarget - (qualPerGroup * groupCount) : 0;
  const wildcardRank  = qualPerGroup + 1;
  const isImpossible  = bracketTarget > totalTeams || (groupCount > 0 && qualPerGroup === 0);

  // Texte du preview
  const previewText = () => {
    if (isImpossible) {
      return `⚠ Impossible : ${bracketTarget} qualifiés pour seulement ${totalTeams} équipes`;
    }
    if (wildcardSpots > 0) {
      return `→ ${qualPerGroup} qualifiés par poule + ${wildcardSpots} meilleur${wildcardSpots > 1 ? 's' : ''} ${wildcardRank}ème${wildcardSpots > 1 ? 's' : ''}`;
    }
    return `→ ${qualPerGroup} qualifiés par poule, 0 wild card`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/bracket/generate', { bracketTarget });
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-dark-800 border border-white/10 rounded-2xl p-8">
        <h2 className="font-display font-bold text-xl text-white mb-1 text-center">Générer le bracket</h2>
        <p className="text-white/30 text-sm mb-7 text-center">
          Les poules doivent être terminées avant de continuer.
        </p>

        {/* ── Sélecteur bracket cible ── */}
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
          Bracket cible après les poules :
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {BRACKET_OPTIONS.map(({ label, size, desc }) => (
            <button
              key={size}
              onClick={() => setBracketTarget(size)}
              className={`px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                bracketTarget === size
                  ? 'border-primary-500 bg-primary-500/15 text-white'
                  : 'border-white/10 bg-dark-700 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
            >
              <span className="font-bold">{label}</span>
              <span className="text-white/40 ml-2 text-xs">({desc})</span>
            </button>
          ))}
        </div>

        {/* ── Preview ── */}
        {!fetching && groupCount > 0 && (
          <div className={`rounded-xl px-4 py-3 mb-5 text-sm ${
            isImpossible
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-primary-500/8 border border-primary-500/20 text-primary-300'
          }`}>
            {previewText()}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || isImpossible || fetching}
          className="btn-primary px-8 py-3 w-full disabled:opacity-50"
        >
          {loading ? 'Génération en cours...' : `Générer le bracket ${bracketTarget} →`}
        </button>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminBracketPage() {
  const [byPhase,        setByPhase]        = useState({});  // { qf: [...], sf: [...], final: [...] }
  const [loading,        setLoading]        = useState(true);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [scoreMatch,     setScoreMatch]     = useState(null);
  const [toast,          setToast]          = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      // Requêtes parallèles : une par phase knockout + équipes qualifiées
      const [phaseResults, teamsRes] = await Promise.all([
        Promise.allSettled(ALL_PHASES.map(p => api.get(`/matches?phase=${p}`))),
        api.get('/teams').catch(() => ({ data: [] })),
      ]);

      const newByPhase = {};
      ALL_PHASES.forEach((p, i) => {
        const r = phaseResults[i];
        newByPhase[p] = r.status === 'fulfilled' ? r.value.data : [];
      });
      setByPhase(newByPhase);

      // Compter les équipes avec tournamentPath = 'main' (bracket principal)
      const mainTeams = teamsRes.data.filter(t => t.tournamentPath === 'main');
      setQualifiedCount(mainTeams.length || teamsRes.data.filter(t => t.group).length);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Phases non vides (phases du bracket réellement créées)
  const activePhases = ALL_PHASES.filter(p => byPhase[p]?.length > 0);
  const hasBracket   = activePhases.length > 0;

  // Hauteur du conteneur = nombre de matchs du premier round × hauteur par slot
  const firstPhase      = activePhases[0];
  const firstRoundCount = byPhase[firstPhase]?.length || 1;
  const SLOT_H          = 88;  // px par match dans la première colonne
  const containerHeight = firstRoundCount * SLOT_H;

  if (loading) return <div className="p-8 text-white/30 text-sm">Chargement...</div>;

  return (
    <div className="p-6 lg:p-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
          toast.type === 'ok' ? 'bg-primary-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-white">Bracket principal</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {hasBracket
            ? `${activePhases.map(p => ROUND_LABELS[p]).join(' → ')}`
            : 'Bracket non encore généré'}
        </p>
      </div>

      {/* ── État A : Génération ── */}
      {!hasBracket && (
        <GenerateBracket
          onGenerated={() => {
            showToast('ok', 'Bracket généré !');
            setLoading(true);
            fetchAll();
          }}
        />
      )}

      {/* ── État B : Affichage du bracket ── */}
      {hasBracket && (
        <>
          {/* Barre de progression */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            {activePhases.map((phase) => {
              const matches  = byPhase[phase] || [];
              const played   = matches.filter(m => m.played && m.sets?.length > 0).length;
              const total    = matches.filter(m => !m.played || m.sets?.length > 0 || m.team1).length;
              const isFinal  = phase === 'final';
              return (
                <div key={phase} className={`text-xs px-3 py-1.5 rounded-lg border ${
                  isFinal ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5'
                  : played === matches.length ? 'border-primary-500/30 text-primary-400 bg-primary-500/5'
                  : 'border-white/10 text-white/40'
                }`}>
                  {ROUND_LABELS[phase]} · {played}/{matches.length}
                </div>
              );
            })}
          </div>

          {/* Bracket visuel — scroll horizontal sur mobile */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 items-stretch" style={{ minHeight: containerHeight + 40 }}>
              {activePhases.map(phase => (
                <BracketRound
                  key={phase}
                  phase={phase}
                  matches={byPhase[phase] || []}
                  onScoreClick={match => setScoreMatch(match)}
                  containerHeight={containerHeight}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal saisie score */}
      {scoreMatch && (
        <ScoreModal
          match={scoreMatch}
          onClose={() => setScoreMatch(null)}
          onSaved={() => {
            showToast('ok', 'Score enregistré');
            fetchAll();
          }}
        />
      )}
    </div>
  );
}
