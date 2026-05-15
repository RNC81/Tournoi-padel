import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatTeamLabel } from '../utils/formatTeam';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ROUND_LABELS = {
  r64:   '32ème de finale',
  r32:   '16ème de finale',
  r16:   '8ème de finale',
  qf:    'Quarts de finale',
  sf:    'Demi-finales',
  final: 'Finale',
};

const ALL_PHASES = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];

const BRACKET_OPTIONS = [
  { label: '1/4',  size: 8,  desc: '8 équipes'  },
  { label: '1/8',  size: 16, desc: '16 équipes' },
  { label: '1/16', size: 32, desc: '32 équipes' },
  { label: '1/32', size: 64, desc: '64 équipes' },
];

const SEL = 'w-full bg-dark-700 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-primary-500/50';

// ─── BRACKET MATCH MODAL ──────────────────────────────────────────────────────
// Modal universelle : édition d'équipes + saisie score, pour toutes les phases.
// Si match.played → score reset + re-saisie. Si !match.played → sélecteurs d'équipes + score.

function BracketMatchModal({ match, mainTeams, onClose, onSaved }) {
  const setsToWin    = match.setFormat?.maxSets ?? 2;
  const maxTotalSets = setsToWin * 2 - 1;

  const [team1Id, setTeam1Id] = useState(String(match.team1?._id || match.team1 || ''));
  const [team2Id, setTeam2Id] = useState(String(match.team2?._id || match.team2 || ''));
  const [teamsError,  setTeamsError]  = useState('');
  const [teamsSaved,  setTeamsSaved]  = useState(false);

  const initSets = () => {
    const existing = match.sets || [];
    return Array.from({ length: maxTotalSets }, (_, i) => ({
      score1: existing[i]?.score1 ?? '',
      score2: existing[i]?.score2 ?? '',
    }));
  };
  const [sets,    setSets]    = useState(initSets);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const origT1 = String(match.team1?._id || match.team1 || '');
  const origT2 = String(match.team2?._id || match.team2 || '');
  const teamsChanged = team1Id !== origT1 || team2Id !== origT2;

  // Labels pour affichage dans la section score
  const findLabel = (id) => {
    const t = mainTeams.find(t => String(t._id) === id);
    return t ? formatTeamLabel(t) : (id ? '...' : '?');
  };
  const t1Label = match.played ? (match.team1 ? formatTeamLabel(match.team1) : '?') : findLabel(team1Id);
  const t2Label = match.played ? (match.team2 ? formatTeamLabel(match.team2) : '?') : findLabel(team2Id);

  // Logique set décisif
  const decisiveSets = sets.slice(0, setsToWin).filter(s => s.score1 !== '' && s.score2 !== '');
  let w1 = 0, w2 = 0;
  for (const s of decisiveSets) {
    if (Number(s.score1) > Number(s.score2)) w1++;
    else if (Number(s.score2) > Number(s.score1)) w2++;
  }
  const hasDecider   = sets[setsToWin]?.score1 !== '' || sets[setsToWin]?.score2 !== '';
  const isTied       = decisiveSets.length === setsToWin && w1 === w2;
  const showDecider  = maxTotalSets > setsToWin && (hasDecider || isTied);
  const visibleCount = showDecider ? maxTotalSets : setsToWin;

  const updateSet = (i, field, val) => {
    setSets(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val === '' ? '' : parseInt(val, 10) };
      return next;
    });
  };

  const handleSaveTeams = async () => {
    if (!team1Id || !team2Id) { setTeamsError('Sélectionnez les deux équipes'); return; }
    if (team1Id === team2Id)  { setTeamsError('Les deux équipes doivent être différentes'); return; }
    setLoading(true);
    setTeamsError('');
    try {
      await api.put(`/matches/${match._id}/teams`, { team1: team1Id, team2: team2Id });
      setTeamsSaved(true);
      onSaved();
    } catch (err) {
      setTeamsError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScore = async () => {
    const filledSets = sets.slice(0, visibleCount).filter(s => s.score1 !== '' && s.score2 !== '');
    if (!filledSets.length) { setError('Saisissez au moins un set joué'); return; }
    setLoading(true);
    setError('');
    try {
      if (!match.played && teamsChanged && !teamsSaved) {
        if (!team1Id || !team2Id || team1Id === team2Id) {
          setError('Sélectionnez deux équipes différentes');
          setLoading(false);
          return;
        }
        await api.put(`/matches/${match._id}/teams`, { team1: team1Id, team2: team2Id });
      }
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

  const canShowScore = match.played || (team1Id && team2Id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-dark-800 border border-white/15 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-lg text-white">
              {ROUND_LABELS[match.phase] || match.phase}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">Match #{match.position}</p>
          </div>
          <button onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors text-2xl leading-none mt-0.5">
            &times;
          </button>
        </div>

        {/* ── Section équipes (uniquement si match non joué) ── */}
        {!match.played && (
          <div className="mb-5">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Équipes</p>
            <div className="space-y-2">
              <select value={team1Id}
                onChange={e => { setTeam1Id(e.target.value); setTeamsSaved(false); setTeamsError(''); }}
                className={SEL}>
                <option value="">-- Équipe 1 --</option>
                {mainTeams.map(t => (
                  <option key={t._id} value={String(t._id)}>{formatTeamLabel(t)}</option>
                ))}
              </select>
              <select value={team2Id}
                onChange={e => { setTeam2Id(e.target.value); setTeamsSaved(false); setTeamsError(''); }}
                className={SEL}>
                <option value="">-- Équipe 2 --</option>
                {mainTeams.map(t => (
                  <option key={t._id} value={String(t._id)}>{formatTeamLabel(t)}</option>
                ))}
              </select>
            </div>
            {teamsError && <p className="text-red-400 text-xs mt-1.5">{teamsError}</p>}
            {teamsSaved && <p className="text-primary-400 text-xs mt-1.5">Équipes mises à jour</p>}
            {teamsChanged && !teamsSaved && team1Id && team2Id && (
              <button onClick={handleSaveTeams} disabled={loading}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-500/40 text-primary-400 hover:bg-primary-500/10 transition-colors disabled:opacity-50">
                {loading ? 'Sauvegarde...' : 'Enregistrer les équipes seules'}
              </button>
            )}
          </div>
        )}

        {/* ── Affichage des équipes si match joué ── */}
        {match.played && (
          <p className="text-white/40 text-sm mb-5">
            {t1Label} <span className="text-white/20 mx-1">vs</span> {t2Label}
          </p>
        )}

        {/* ── Section score ── */}
        {canShowScore && (
          <>
            <div className={`${!match.played ? 'border-t border-white/8 pt-4' : ''} mb-4`}>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Score</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-[1fr_2.5rem_1fr] gap-2 mb-2 text-xs text-white/30 text-center">
                <span className="text-right pr-2 truncate">{t1Label}</span>
                <span />
                <span className="text-left pl-2 truncate">{t2Label}</span>
              </div>

              <div className="space-y-2 mb-6">
                {sets.slice(0, visibleCount).map((set, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2">
                    <input type="number" min="0" max="99" placeholder="—" value={set.score1}
                      onChange={e => updateSet(i, 'score1', e.target.value)}
                      className="input text-center text-lg font-bold py-2" />
                    <div className={`text-center text-sm font-bold ${i === setsToWin ? 'text-primary-400' : 'text-white/20'}`}>
                      S{i + 1}
                    </div>
                    <input type="number" min="0" max="99" placeholder="—" value={set.score2}
                      onChange={e => updateSet(i, 'score2', e.target.value)}
                      className="input text-center text-lg font-bold py-2" />
                  </div>
                ))}
              </div>
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
                <button onClick={handleSaveScore} disabled={loading}
                  className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
                  {loading ? 'Sauvegarde...' : 'Enregistrer le score'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Si aucune équipe sélectionnée et match non joué */}
        {!canShowScore && (
          <div className="flex justify-end mt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MANUAL DRAW MODAL ────────────────────────────────────────────────────────
// Mission 2 : recomposer toutes les paires d'un round manuellement.

function ManualDrawModal({ phase, matches, mainTeams, onClose, onSaved }) {
  const [pairs, setPairs] = useState(
    matches
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(m => ({
        matchId:  String(m._id),
        position: m.position,
        team1Id:  String(m.team1?._id || m.team1 || ''),
        team2Id:  String(m.team2?._id || m.team2 || ''),
      }))
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  const updatePair = (matchId, field, val) => {
    setPairs(prev => prev.map(p => p.matchId === matchId ? { ...p, [field]: val } : p));
  };

  const handleConfirm = async () => {
    for (const p of pairs) {
      if (!p.team1Id || !p.team2Id) {
        setError('Toutes les paires doivent avoir deux équipes'); return;
      }
      if (p.team1Id === p.team2Id) {
        setError('Chaque paire doit avoir deux équipes différentes'); return;
      }
    }
    setLoading(true);
    setError('');
    try {
      await Promise.all(
        pairs.map(p => api.put(`/matches/${p.matchId}/teams`, { team1: p.team1Id, team2: p.team2Id }))
      );
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-dark-800 border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-lg text-white">
              Tirage manuel — {ROUND_LABELS[phase] || phase}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              Composez les {matches.length} paire{matches.length > 1 ? 's' : ''} de ce round
            </p>
          </div>
          <button onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors text-2xl leading-none mt-0.5">
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-primary-500/10 border border-primary-500/30 text-primary-300 text-sm rounded-lg px-3 py-2 mb-4">
            Paires enregistrées
          </div>
        )}

        <div className="space-y-3">
          {pairs.map((p) => (
            <div key={p.matchId} className="bg-dark-700/50 border border-white/8 rounded-xl p-3">
              <p className="text-white/25 text-xs mb-2 font-mono">Match {p.position}</p>
              <div className="space-y-2">
                <select value={p.team1Id} onChange={e => updatePair(p.matchId, 'team1Id', e.target.value)}
                  className={SEL}>
                  <option value="">-- Équipe 1 --</option>
                  {mainTeams.map(t => (
                    <option key={t._id} value={String(t._id)}>{formatTeamLabel(t)}</option>
                  ))}
                </select>
                <select value={p.team2Id} onChange={e => updatePair(p.matchId, 'team2Id', e.target.value)}
                  className={SEL}>
                  <option value="">-- Équipe 2 --</option>
                  {mainTeams.map(t => (
                    <option key={t._id} value={String(t._id)}>{formatTeamLabel(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white">
            {saved ? 'Fermer' : 'Annuler'}
          </button>
          {!saved && (
            <button onClick={handleConfirm} disabled={loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Confirmer les paires'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TEAM SLOT ────────────────────────────────────────────────────────────────

function TeamSlot({ team, isBye, isWinner, isLoser }) {
  if (isBye) return <div className="px-3 py-1.5 text-xs text-white/20 italic">BYE</div>;
  if (!team)  return <div className="px-3 py-1.5 text-xs text-white/15 italic">—</div>;

  return (
    <div className={`px-3 py-1.5 text-xs truncate transition-colors ${
      isWinner ? 'text-white font-semibold'
      : isLoser ? 'text-white/30 line-through'
      : 'text-white/70'
    }`}>
      {formatTeamLabel(team)}
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────

function MatchCard({ match, onEditClick, isFinal }) {
  const isByeMatch = match.played && (!match.team1 || !match.team2);
  const isPlayed   = match.played && !isByeMatch;
  const isReady    = !match.played && match.team1 && match.team2;
  const isPending  = !match.played && (!match.team1 || !match.team2);

  const winner = match.winner?._id || String(match.winner || '');
  const t1id   = match.team1?._id  || String(match.team1  || '');
  const t2id   = match.team2?._id  || String(match.team2  || '');

  const t1IsWinner = isPlayed && winner && winner === t1id;
  const t2IsWinner = isPlayed && winner && winner === t2id;

  // Toutes les cartes sont cliquables sauf les BYEs
  const clickable = !isByeMatch;

  return (
    <div
      onClick={clickable ? () => onEditClick(match) : undefined}
      className={`rounded-xl border overflow-hidden transition-all select-none ${
        isFinal     ? 'border-yellow-500/40 bg-yellow-500/5'
        : isPlayed  ? 'border-white/10 bg-white/3'
        : isReady   ? 'border-primary-500/30 bg-dark-700 hover:border-primary-500/60 hover:bg-dark-600'
        : isPending ? 'border-white/10 bg-dark-800/70 hover:border-white/20'
        :             'border-white/5 bg-dark-800/50 opacity-50'
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

      {/* Scores si joué */}
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

      {/* Hint "assigner" sur les matchs en attente */}
      {isPending && (
        <div className="px-3 py-0.5 text-white/15 text-xs italic border-b border-white/5">
          cliquer pour assigner
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

// ─── SET FORMAT PANEL ─────────────────────────────────────────────────────────

function SetFormatPanel({ nextPhase, nextPhaseName, onApply, onSkip }) {
  const [target,   setTarget]   = useState(6);
  const [maxSets,  setMaxSets]  = useState(2);
  const [tiebreak, setTiebreak] = useState(true);
  const [loading,  setLoading]  = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try { await onApply({ target, maxSets, tiebreakatDeuce: tiebreak }); }
    finally { setLoading(false); }
  };

  const S = 'bg-dark-700 border border-white/10 rounded-lg text-white text-sm px-2 py-1.5 focus:outline-none focus:border-primary-500/50';

  return (
    <div className="mb-4 bg-primary-500/8 border border-primary-500/25 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-primary-300 font-semibold text-sm mb-0.5">
            Phase suivante : {nextPhaseName}
          </p>
          <p className="text-white/40 text-xs">Configurez le format de set avant que les matchs commencent.</p>
        </div>
        <button onClick={onSkip} className="text-white/25 hover:text-white/50 text-xs transition-colors shrink-0">
          Passer →
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">Cible</span>
          <select value={target} onChange={e => setTarget(Number(e.target.value))} className={S}>
            {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} jeux</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">Sets</span>
          <select value={maxSets} onChange={e => setMaxSets(Number(e.target.value))} className={S}>
            {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Best of {n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">Égalité</span>
          <select value={String(tiebreak)} onChange={e => setTiebreak(e.target.value === 'true')} className={S}>
            <option value="true">Tie-break</option>
            <option value="false">Continue</option>
          </select>
        </div>
        <button onClick={handleApply} disabled={loading}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary-500 hover:bg-primary-400 text-white transition-colors disabled:opacity-50">
          {loading ? 'Application...' : 'Appliquer'}
        </button>
      </div>
    </div>
  );
}

// ─── BRACKET ROUND ────────────────────────────────────────────────────────────

function BracketRound({ phase, matches, onEditClick, containerHeight }) {
  const isFinalRound = phase === 'final';
  return (
    <div className="flex flex-col w-52 flex-shrink-0">
      <div className={`text-center text-xs uppercase tracking-widest mb-3 font-medium ${
        isFinalRound ? 'text-yellow-400' : 'text-white/30'
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
              <MatchCard
                match={match}
                onEditClick={onEditClick}
                isFinal={isFinalRound}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GENERATE BRACKET ─────────────────────────────────────────────────────────

function GenerateBracket({ onGenerated }) {
  const [bracketTarget, setBracketTarget] = useState(32);
  const [groupCount,    setGroupCount]    = useState(0);
  const [totalTeams,    setTotalTeams]    = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [fetching,      setFetching]      = useState(true);
  const [error,         setError]         = useState('');

  useEffect(() => {
    Promise.all([api.get('/groups?phase=pool'), api.get('/teams')])
      .then(([gRes, tRes]) => {
        setGroupCount(gRes.data.length);
        setTotalTeams(tRes.data.length);
      }).catch(() => {}).finally(() => setFetching(false));
  }, []);

  const qualPerGroup  = groupCount > 0 ? Math.floor(bracketTarget / groupCount) : 0;
  const wildcardSpots = groupCount > 0 ? bracketTarget - (qualPerGroup * groupCount) : 0;
  const wildcardRank  = qualPerGroup + 1;
  const isImpossible  = bracketTarget > totalTeams || (groupCount > 0 && qualPerGroup === 0);

  const previewText = () => {
    if (isImpossible) return `Impossible : ${bracketTarget} qualifiés pour seulement ${totalTeams} équipes`;
    if (wildcardSpots > 0) return `→ ${qualPerGroup} qualifiés par poule + ${wildcardSpots} meilleur${wildcardSpots > 1 ? 's' : ''} ${wildcardRank}ème${wildcardSpots > 1 ? 's' : ''}`;
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
        <p className="text-white/30 text-sm mb-7 text-center">Les poules doivent être terminées avant de continuer.</p>

        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Bracket cible :</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {BRACKET_OPTIONS.map(({ label, size, desc }) => (
            <button key={size} onClick={() => setBracketTarget(size)}
              className={`px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                bracketTarget === size
                  ? 'border-primary-500 bg-primary-500/15 text-white'
                  : 'border-white/10 bg-dark-700 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}>
              <span className="font-bold">{label}</span>
              <span className="text-white/40 ml-2 text-xs">({desc})</span>
            </button>
          ))}
        </div>

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
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading || isImpossible || fetching}
          className="btn-primary px-8 py-3 w-full disabled:opacity-50">
          {loading ? 'Génération en cours...' : `Générer le bracket ${bracketTarget} →`}
        </button>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminBracketPage() {
  const [byPhase,         setByPhase]         = useState({});
  const [mainTeams,       setMainTeams]        = useState([]);
  const [loading,         setLoading]          = useState(true);
  const [editMatch,       setEditMatch]        = useState(null);   // Mission 1 : édition d'un match
  const [manualDrawPhase, setManualDrawPhase]  = useState(null);   // Mission 2 : tirage manuel d'un round
  const [toast,           setToast]            = useState(null);
  const [formatDismissed, setFormatDismissed]  = useState(new Set());

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
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

      // Stocker la liste complète des équipes du bracket principal
      const all = teamsRes.data || [];
      setMainTeams(all.filter(t => t.tournamentPath === 'main'));
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activePhases    = ALL_PHASES.filter(p => byPhase[p]?.length > 0);
  const hasBracket      = activePhases.length > 0;
  const firstPhase      = activePhases[0];
  const firstRoundCount = byPhase[firstPhase]?.length || 1;
  const SLOT_H          = 88;
  const containerHeight = firstRoundCount * SLOT_H;

  // ── Détection phase à formater ────────────────────────────────────────────
  let formatPanelPhase = null;
  for (let i = 0; i < activePhases.length - 1; i++) {
    const phase      = activePhases[i];
    const matches    = byPhase[phase] || [];
    const allDone    = matches.length > 0 && matches.every(m => m.played);
    const nextPhase  = activePhases[i + 1];
    const nextHasScores = (byPhase[nextPhase] || []).some(m => m.played);
    if (allDone && !nextHasScores && !formatDismissed.has(nextPhase)) {
      formatPanelPhase = nextPhase;
      break;
    }
  }
  if (!formatPanelPhase && activePhases.length > 0) {
    const fp = activePhases[0];
    if (['r64', 'r32', 'r16'].includes(fp)) {
      const fpMatches = byPhase[fp] || [];
      if (fpMatches.length > 0 && !fpMatches.some(m => m.played) && !formatDismissed.has(fp)) {
        formatPanelPhase = fp;
      }
    }
  }

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
        <GenerateBracket onGenerated={() => { showToast('ok', 'Bracket généré !'); setLoading(true); fetchAll(); }} />
      )}

      {/* ── État B : Bracket affiché ── */}
      {hasBracket && (
        <>
          {/* Barre de progression + bouton Tirage manuel par round */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {activePhases.map((phase) => {
              const matches  = byPhase[phase] || [];
              const played   = matches.filter(m => m.played && m.sets?.length > 0).length;
              const isFinal  = phase === 'final';
              const phaseMatches = byPhase[phase] || [];
              const noneStarted  = phaseMatches.length > 0 && !phaseMatches.some(m => m.played);

              return (
                <div key={phase} className="flex items-center gap-1.5">
                  <div className={`text-xs px-3 py-1.5 rounded-lg border ${
                    isFinal           ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5'
                    : played === matches.length && matches.length > 0
                                      ? 'border-primary-500/30 text-primary-400 bg-primary-500/5'
                    : 'border-white/10 text-white/40'
                  }`}>
                    {ROUND_LABELS[phase]} · {played}/{matches.length}
                  </div>
                  {/* Bouton Mission 2 : tirage manuel disponible si round pas encore commencé */}
                  {noneStarted && (
                    <button
                      onClick={() => setManualDrawPhase(phase)}
                      title="Recomposer les paires manuellement"
                      className="text-xs px-2 py-1.5 rounded-lg border border-white/10 text-white/30 hover:border-primary-500/40 hover:text-primary-400 transition-colors">
                      Recomposer
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel format round suivant */}
          {formatPanelPhase && (
            <SetFormatPanel
              nextPhase={formatPanelPhase}
              nextPhaseName={ROUND_LABELS[formatPanelPhase]}
              onSkip={() => setFormatDismissed(s => new Set([...s, formatPanelPhase]))}
              onApply={async (setFormat) => {
                try {
                  await api.patch('/bracket/phase-format', { phase: formatPanelPhase, setFormat });
                  showToast('ok', `Format appliqué aux ${ROUND_LABELS[formatPanelPhase]}`);
                  setFormatDismissed(s => new Set([...s, formatPanelPhase]));
                } catch (err) {
                  showToast('err', err.response?.data?.error || 'Erreur');
                }
              }}
            />
          )}

          {/* Bracket visuel */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 items-stretch" style={{ minHeight: containerHeight + 40 }}>
              {activePhases.map(phase => (
                <BracketRound
                  key={phase}
                  phase={phase}
                  matches={byPhase[phase] || []}
                  onEditClick={match => setEditMatch(match)}
                  containerHeight={containerHeight}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal Mission 1 : édition équipes + score */}
      {editMatch && (
        <BracketMatchModal
          match={editMatch}
          mainTeams={mainTeams}
          onClose={() => setEditMatch(null)}
          onSaved={() => {
            showToast('ok', 'Mis à jour');
            fetchAll();
          }}
        />
      )}

      {/* Modal Mission 2 : tirage manuel d'un round */}
      {manualDrawPhase && (
        <ManualDrawModal
          phase={manualDrawPhase}
          matches={byPhase[manualDrawPhase] || []}
          mainTeams={mainTeams}
          onClose={() => setManualDrawPhase(null)}
          onSaved={() => {
            showToast('ok', 'Paires enregistrées');
            fetchAll();
          }}
        />
      )}
    </div>
  );
}
