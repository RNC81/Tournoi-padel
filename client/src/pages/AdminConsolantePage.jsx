import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatTeamName } from '../utils/formatTeam';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ROUND_LABELS = {
  consolante_r32:   '32èmes',
  consolante_r16:   '16èmes',
  consolante_qf:    'Quarts',
  consolante_sf:    'Demis',
  consolante_final: 'Finale C',
};

const ALL_PHASES = [
  'consolante_r32',
  'consolante_r16',
  'consolante_qf',
  'consolante_sf',
  'consolante_final',
];

// ─── SCORE MODAL ──────────────────────────────────────────────────────────────

function ScoreModal({ match, onClose, onSaved }) {
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
    const filled = sets.filter(s => s.score1 !== '' && s.score2 !== '');
    if (!filled.length) { setError('Saisissez au moins un set joué'); return; }
    setLoading(true);
    setError('');
    try {
      await api.put(`/matches/${match._id}/score`, { sets: filled });
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
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
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
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white">
              Annuler
            </button>
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

function TeamSlot({ team, isBye, isWinner, isLoser }) {
  if (isBye) return <div className="px-3 py-1.5 text-xs text-white/20 italic">BYE</div>;
  if (!team)  return <div className="px-3 py-1.5 text-xs text-white/15">—</div>;
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
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isPlayed   = match.played && !isByeMatch;
  const isReady    = !match.played && match.team1 && match.team2;

  const winner = match.winner?._id || String(match.winner || '');
  const t1id   = match.team1?._id  || String(match.team1  || '');
  const t2id   = match.team2?._id  || String(match.team2  || '');
  const t1Win  = isPlayed && winner && winner === t1id;
  const t2Win  = isPlayed && winner && winner === t2id;

  const clickable = isReady || isPlayed;

  return (
    <div
      onClick={clickable ? () => onScoreClick(match) : undefined}
      className={`rounded-xl border overflow-hidden transition-all select-none ${
        isFinal
          ? 'border-violet-400/50 bg-violet-500/8'
          : isPlayed
          ? 'border-white/10 bg-white/3'
          : isReady
          ? 'border-violet-500/30 bg-dark-700 hover:border-violet-500/60 hover:bg-dark-600'
          : 'border-white/5 bg-dark-800/50 opacity-50'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`border-b ${isFinal ? 'border-violet-400/20' : 'border-white/8'}`}>
        <TeamSlot
          team={isByeMatch ? (match.team1 || null) : match.team1}
          isBye={isByeMatch && !match.team1}
          isWinner={t1Win}
          isLoser={isPlayed && !t1Win && !!match.team1}
        />
      </div>

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

      <div>
        <TeamSlot
          team={isByeMatch ? (match.team2 || null) : match.team2}
          isBye={isByeMatch && !match.team2}
          isWinner={t2Win}
          isLoser={isPlayed && !t2Win && !!match.team2}
        />
      </div>
    </div>
  );
}

// ─── BRACKET ROUND ────────────────────────────────────────────────────────────

function BracketRound({ phase, matches, onScoreClick, containerHeight }) {
  const isFinalRound = phase === 'consolante_final';
  return (
    <div className="flex flex-col w-52 flex-shrink-0">
      <div className={`text-center text-xs uppercase tracking-widest mb-3 font-medium ${
        isFinalRound ? 'text-violet-400' : 'text-white/30'
      }`}>
        {ROUND_LABELS[phase]}
        <span className="text-white/20 ml-1.5 font-normal normal-case tracking-normal">
          ({matches.length})
        </span>
      </div>
      <div className="flex flex-col justify-around flex-1" style={{ minHeight: containerHeight }}>
        {matches.map(match => (
          <div key={match._id} className="flex items-center px-1">
            <div className="w-full">
              <MatchCard match={match} onScoreClick={onScoreClick} isFinal={isFinalRound} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ÉTAT A : Génération ──────────────────────────────────────────────────────

function GenerateConsolante({ onGenerated }) {
  const [count,   setCount]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/teams')
      .then(res => {
        const c = res.data.filter(t => t.tournamentPath === 'consolante').length;
        setCount(c);
      })
      .catch(() => setCount(0));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/bracket/consolante/generate', { direct: true });
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  // Taille du bracket qui accueillera les équipes consolante
  const bracketSize = count != null
    ? count <= 4  ? 4
    : count <= 8  ? 8
    : count <= 16 ? 16
    : 32
    : null;

  const byes         = bracketSize != null ? bracketSize - count : 0;
  const noTeams      = count !== null && count === 0;
  const notEnough    = count !== null && count > 0 && count < 4;

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-dark-800 border border-white/10 rounded-2xl p-8 text-center">
        {/* Icône violet */}
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
          <span className="text-2xl font-bold text-violet-400">C</span>
        </div>

        <h2 className="font-display font-bold text-xl text-white mb-2">Bracket consolante</h2>

        {count === null ? (
          <p className="text-white/30 text-sm mb-6">Chargement...</p>
        ) : noTeams ? (
          <div className="text-white/40 text-sm mb-6">
            <p>Aucune équipe consolante.</p>
            <p className="text-white/25 text-xs mt-1">
              Générez d'abord le bracket principal pour identifier les équipes non-qualifiées.
            </p>
          </div>
        ) : notEnough ? (
          <p className="text-red-400/70 text-sm mb-6">
            Seulement {count} équipes consolante (minimum 4 requis).
          </p>
        ) : (
          <div className="mb-6">
            <p className="text-white/50 text-sm">
              <span className="text-white font-semibold text-lg">{count}</span>
              <span className="ml-1.5">équipes consolante</span>
            </p>
            {bracketSize && (
              <p className="text-violet-400/60 text-xs mt-1">
                → bracket {bracketSize}
                {byes > 0 && ` · ${byes} BYE${byes > 1 ? 's' : ''} auto-avancés`}
              </p>
            )}
            <p className="text-white/25 text-xs mt-2">
              Seeding automatique (même groupe + même pays séparés au R1)
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4 text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || noTeams || notEnough || count === null}
          className="w-full px-8 py-3 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Génération en cours...' : `Générer le bracket consolante →`}
        </button>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminConsolantePage() {
  const [byPhase,    setByPhase]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [scoreMatch, setScoreMatch] = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const phaseResults = await Promise.allSettled(
        ALL_PHASES.map(p => api.get(`/matches?phase=${p}`))
      );
      const newByPhase = {};
      ALL_PHASES.forEach((p, i) => {
        const r = phaseResults[i];
        newByPhase[p] = r.status === 'fulfilled' ? r.value.data : [];
      });
      setByPhase(newByPhase);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activePhases  = ALL_PHASES.filter(p => byPhase[p]?.length > 0);
  const hasBracket    = activePhases.length > 0;
  const firstPhase    = activePhases[0];
  const firstRoundCnt = byPhase[firstPhase]?.length || 1;
  const containerH    = firstRoundCnt * 88;

  if (loading) return <div className="p-8 text-white/30 text-sm">Chargement...</div>;

  return (
    <div className="p-6 lg:p-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
          toast.type === 'ok' ? 'bg-violet-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* En-tête violet ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-display font-bold text-white">Bracket consolante</h1>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
            Consolante
          </span>
        </div>
        <p className="text-white/40 text-sm">
          {hasBracket
            ? activePhases.map(p => ROUND_LABELS[p]).join(' → ')
            : 'Bracket non encore généré'}
        </p>
      </div>

      {/* ── État A : Génération ─────────────────────────────────────────────── */}
      {!hasBracket && (
        <GenerateConsolante
          onGenerated={() => {
            showToast('ok', 'Bracket consolante généré !');
            setLoading(true);
            fetchAll();
          }}
        />
      )}

      {/* ── État B : Affichage du bracket ───────────────────────────────────── */}
      {hasBracket && (
        <>
          {/* Barre de progression */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {activePhases.map(phase => {
              const matches = byPhase[phase] || [];
              const played  = matches.filter(m => m.played && m.sets?.length > 0).length;
              const isFinal = phase === 'consolante_final';
              return (
                <div key={phase} className={`text-xs px-3 py-1.5 rounded-lg border ${
                  isFinal
                    ? 'border-violet-500/30 text-violet-400 bg-violet-500/5'
                    : played === matches.length
                    ? 'border-violet-500/25 text-violet-400/70 bg-violet-500/5'
                    : 'border-white/10 text-white/40'
                }`}>
                  {ROUND_LABELS[phase]} · {played}/{matches.length}
                </div>
              );
            })}
          </div>

          {/* Bracket visuel — scroll horizontal sur mobile */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 items-stretch" style={{ minHeight: containerH + 40 }}>
              {activePhases.map(phase => (
                <BracketRound
                  key={phase}
                  phase={phase}
                  matches={byPhase[phase] || []}
                  onScoreClick={match => setScoreMatch(match)}
                  containerHeight={containerH}
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
