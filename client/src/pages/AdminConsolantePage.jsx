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

const BRACKET_PHASES = [
  'consolante_r32',
  'consolante_r16',
  'consolante_qf',
  'consolante_sf',
  'consolante_final',
];

const BRACKET_TARGETS = [4, 8, 16, 32];

// ─── SCORE MODAL ──────────────────────────────────────────────────────────────

function ScoreModal({ match, onClose, onSaved }) {
  const setsToWin    = match.setFormat?.maxSets ?? 2;
  const maxTotalSets = setsToWin * 2 - 1;

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

  const t1 = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || '?';
  const t2 = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || '?';

  const decisiveSets = sets.slice(0, setsToWin).filter(s => s.score1 !== '' && s.score2 !== '');
  let t1Wins = 0, t2Wins = 0;
  for (const s of decisiveSets) {
    if (Number(s.score1) > Number(s.score2)) t1Wins++;
    else if (Number(s.score2) > Number(s.score1)) t2Wins++;
  }
  const hasDeciderData = sets[setsToWin]?.score1 !== '' || sets[setsToWin]?.score2 !== '';
  const isTied = decisiveSets.length === setsToWin && t1Wins === t2Wins;
  const showDecider = maxTotalSets > setsToWin && (hasDeciderData || isTied);
  const visibleCount = showDecider ? maxTotalSets : setsToWin;

  const updateSet = (i, field, val) => {
    setSets(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val === '' ? '' : parseInt(val, 10) };
      return next;
    });
  };

  const handleSave = async () => {
    const filled = sets.slice(0, visibleCount).filter(s => s.score1 !== '' && s.score2 !== '');
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

// ─── BRACKET : TeamSlot ───────────────────────────────────────────────────────

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

// ─── BRACKET : MatchCard ──────────────────────────────────────────────────────

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

// ─── BRACKET : BracketRound ───────────────────────────────────────────────────

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

// ─── WIZARD : Étape 1 — Choix du format ──────────────────────────────────────

function WizardStep1({ eligibleCount, format, setFormat, bracketTarget, setBracketTarget,
                       numGroups, setNumGroups, onNext }) {
  const byes = eligibleCount !== null ? bracketTarget - eligibleCount : null;
  const notEnough = eligibleCount !== null && eligibleCount < 4;
  const tooMany   = eligibleCount !== null && eligibleCount > bracketTarget && format === 'direct';

  // Suggestions de nombre de groupes pour Option A
  const suggestedGroups = eligibleCount
    ? Math.max(2, Math.round(eligibleCount / 4))
    : 2;

  return (
    <div className="max-w-lg mx-auto mt-6 space-y-5">

      {/* Compteur d'équipes */}
      <div className="bg-dark-700 border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between">
        <span className="text-white/50 text-sm">Équipes éligibles</span>
        {eligibleCount === null ? (
          <span className="text-white/30 text-sm">Chargement...</span>
        ) : (
          <span className="text-white font-bold text-xl">{eligibleCount}</span>
        )}
      </div>

      {notEnough && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
          Minimum 4 équipes requises. Générez d'abord le bracket principal pour identifier les non-qualifiés.
        </div>
      )}

      {/* Choix du format */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-widest">Format de la consolante</p>

        {/* Option A — Poules + bracket */}
        <label className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
          format === 'pool'
            ? 'border-violet-500/60 bg-violet-500/8'
            : 'border-white/10 bg-dark-700 hover:border-white/20'
        }`}>
          <input
            type="radio"
            name="format"
            value="pool"
            checked={format === 'pool'}
            onChange={() => setFormat('pool')}
            className="mt-0.5 accent-violet-500"
          />
          <div className="flex-1">
            <div className="text-white font-semibold text-sm mb-0.5">Option A — Poules puis bracket</div>
            <div className="text-white/40 text-xs">
              Tirage en poules round-robin, puis bracket depuis les classements.
              Même fonctionnement que la phase principale.
            </div>
            {format === 'pool' && eligibleCount >= 4 && (
              <div className="mt-3 space-y-3 pt-3 border-t border-violet-500/20">
                <div className="flex items-center gap-3">
                  <label className="text-white/50 text-xs w-28 shrink-0">Nombre de poules</label>
                  <div className="flex gap-1.5">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumGroups(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          numGroups === n
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-white/60'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-white/25 text-xs">
                    (suggéré : {suggestedGroups})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-white/50 text-xs w-28 shrink-0">Bracket cible</label>
                  <div className="flex gap-1.5">
                    {BRACKET_TARGETS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBracketTarget(t)}
                        className={`px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          bracketTarget === t
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-white/60'
                        }`}
                      >
                        1/{t / 2}
                      </button>
                    ))}
                  </div>
                </div>
                {eligibleCount !== null && (
                  <div className="text-violet-400/70 text-xs">
                    {Math.floor(eligibleCount / numGroups)} équipes/groupe · bracket {bracketTarget}
                    {eligibleCount > bracketTarget && (
                      <span className="text-yellow-400/80 ml-2">
                        ⚠ {eligibleCount - bracketTarget} équipes éliminées en poules
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </label>

        {/* Option B — Bracket direct */}
        <label className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
          format === 'direct'
            ? 'border-violet-500/60 bg-violet-500/8'
            : 'border-white/10 bg-dark-700 hover:border-white/20'
        }`}>
          <input
            type="radio"
            name="format"
            value="direct"
            checked={format === 'direct'}
            onChange={() => setFormat('direct')}
            className="mt-0.5 accent-violet-500"
          />
          <div className="flex-1">
            <div className="text-white font-semibold text-sm mb-0.5">Option B — Bracket direct</div>
            <div className="text-white/40 text-xs">
              Toutes les équipes entrent directement dans le bracket.
              Les places manquantes sont remplies par des BYEs.
            </div>
            {format === 'direct' && eligibleCount >= 4 && (
              <div className="mt-3 pt-3 border-t border-violet-500/20 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-white/50 text-xs w-28 shrink-0">Taille du bracket</label>
                  <div className="flex gap-1.5">
                    {BRACKET_TARGETS.map(t => {
                      const disabled = eligibleCount > t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => !disabled && setBracketTarget(t)}
                          disabled={disabled}
                          className={`px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors ${
                            bracketTarget === t && !disabled
                              ? 'bg-violet-500 text-white'
                              : disabled
                              ? 'bg-white/3 text-white/20 cursor-not-allowed'
                              : 'bg-white/5 hover:bg-white/10 text-white/60'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {byes !== null && byes >= 0 && (
                  <div className="text-violet-400/70 text-xs">
                    {eligibleCount} équipes → bracket {bracketTarget}
                    {byes > 0
                      ? ` · ${byes} BYE${byes > 1 ? 's' : ''} auto-avancés`
                      : ' · 0 BYE (bracket plein)'}
                  </div>
                )}
                {tooMany && (
                  <div className="text-red-400/80 text-xs">
                    {eligibleCount} équipes ne tiennent pas dans un bracket {bracketTarget}. Choisissez une taille plus grande.
                  </div>
                )}
              </div>
            )}
          </div>
        </label>
      </div>

      <button
        onClick={onNext}
        disabled={notEnough || eligibleCount === null || tooMany}
        className="w-full py-3 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Suivant →
      </button>
    </div>
  );
}

// ─── WIZARD : Étape 2 — Confirmation ──────────────────────────────────────────

function WizardStep2({ eligibleCount, format, bracketTarget, numGroups,
                       onBack, onConfirm, loading, error }) {
  const byes = bracketTarget - eligibleCount;

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="bg-dark-700 border border-violet-500/20 rounded-2xl p-6 mb-4">
        <h3 className="text-white font-semibold mb-4">Récapitulatif</h3>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-white/40">Format</dt>
            <dd className="text-white font-medium">
              {format === 'pool' ? 'Poules puis bracket' : 'Bracket direct'}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-white/40">Équipes</dt>
            <dd className="text-white font-medium">{eligibleCount}</dd>
          </div>
          {format === 'pool' && (
            <div className="flex justify-between text-sm">
              <dt className="text-white/40">Nombre de poules</dt>
              <dd className="text-white font-medium">{numGroups}</dd>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <dt className="text-white/40">Bracket cible</dt>
            <dd className="text-white font-medium">{bracketTarget} équipes</dd>
          </div>
          {format === 'direct' && byes > 0 && (
            <div className="flex justify-between text-sm">
              <dt className="text-white/40">BYEs</dt>
              <dd className="text-violet-400 font-medium">{byes} (auto-avancés)</dd>
            </div>
          )}
        </dl>
        {format === 'pool' && (
          <p className="text-white/30 text-xs mt-4 pt-4 border-t border-white/8">
            Le bracket consolante sera généré après la saisie des scores de poules.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-medium text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
        >
          ← Retour
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'Lancement...' : 'Lancer la consolante'}
        </button>
      </div>
    </div>
  );
}

// ─── VUE POULES CONSOLANTE ────────────────────────────────────────────────────

function ConsolantePoolsView({ tournament, onBracketGenerated, onScoreClick, onRefresh }) {
  const [groups,     setGroups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const listRes = await api.get('/groups?phase=consolante_pool');
      const details = await Promise.all(
        listRes.data.map(g => api.get(`/groups/${g._id}`))
      );
      setGroups(details.map(r => r.data));
    } catch (_) {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const totalMatches  = groups.reduce((s, g) => s + (g.matches?.length || 0), 0);
  const playedMatches = groups.reduce((s, g) =>
    s + (g.matches?.filter(m => m.played && m.sets?.length > 0).length || 0), 0
  );
  const totalTeams = groups.reduce((s, g) => s + (g.teams?.length || 0), 0);

  const savedBracketTarget = tournament?.consolanteQualificationRules?.bracketTarget;

  // Calcul de la qualification (même logique que le bracket principal)
  const qualPreview = savedBracketTarget && groups.length > 0 ? (() => {
    const qualPerGroup  = Math.floor(savedBracketTarget / groups.length);
    const wildcards     = savedBracketTarget - (qualPerGroup * groups.length);
    const willQualify   = Math.min(savedBracketTarget, totalTeams);
    const willEliminate = Math.max(0, totalTeams - savedBracketTarget);
    const needsQual     = totalTeams > savedBracketTarget;
    return { qualPerGroup, wildcards, willQualify, willEliminate, needsQual };
  })() : null;

  const handleGenerateBracket = async () => {
    setGenerating(true);
    setError('');
    try {
      // Option A : pas de direct:true → bracket depuis poules consolante
      await api.post('/bracket/consolante/generate', {});
      onBracketGenerated();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la génération du bracket');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-white/30 text-sm">Chargement des poules...</div>;

  return (
    <div className="space-y-6">
      {/* En-tête poules + bouton génération */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-white/40 text-sm">
            {groups.length} poule{groups.length > 1 ? 's' : ''} · {playedMatches}/{totalMatches} matchs joués
          </p>
          {savedBracketTarget && (
            <p className="text-violet-400/60 text-xs mt-0.5">
              Bracket cible : {savedBracketTarget} équipes
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleGenerateBracket}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Génération...' : 'Générer le bracket consolante →'}
          </button>
          {playedMatches < totalMatches && (
            <p className="text-yellow-400/60 text-xs text-right">
              {totalMatches - playedMatches} match{totalMatches - playedMatches > 1 ? 's' : ''} non joué{totalMatches - playedMatches > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Panneau qualification (si trop d'équipes pour le bracket) ── */}
      {qualPreview?.needsQual && (
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3 text-sm space-y-1">
          <p className="text-violet-300 font-semibold">
            Qualification pour le bracket consolante de {savedBracketTarget}
          </p>
          <p className="text-white/50">
            {totalTeams} équipes · {qualPreview.qualPerGroup} qualifiée{qualPreview.qualPerGroup > 1 ? 's' : ''}/groupe
            {qualPreview.wildcards > 0 && ` + ${qualPreview.wildcards} wildcard${qualPreview.wildcards > 1 ? 's' : ''}`}
            {' '}→ {qualPreview.willQualify} retenues, {qualPreview.willEliminate} éliminées
          </p>
          <p className="text-white/30 text-xs">
            La qualification est calculée automatiquement lors de la génération du bracket.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Grille des groupes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => (
          <ConsolanteGroupCard
            key={group._id}
            group={group}
            onScoreClick={onScoreClick}
            onRefresh={() => { fetchGroups(); onRefresh(); }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── CARTE DE GROUPE CONSOLANTE ───────────────────────────────────────────────

function ConsolanteGroupCard({ group, onScoreClick }) {
  const standings = group.standings || [];
  const matches   = (group.matches || []).filter(m => m.team1 && m.team2);

  return (
    <div className="bg-dark-800 border border-violet-500/15 rounded-xl overflow-hidden">
      {/* En-tête groupe */}
      <div className="px-4 py-3 bg-violet-500/8 border-b border-violet-500/15 flex items-center justify-between">
        <span className="font-display font-bold text-violet-300">Poule {group.name}</span>
        <span className="text-xs text-white/30">
          {matches.filter(m => m.played && m.sets?.length > 0).length}/{matches.length} matchs
        </span>
      </div>

      {/* Classement */}
      <div className="px-4 py-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/25 border-b border-white/5">
              <th className="text-left pb-1.5 font-normal">Équipe</th>
              <th className="text-center pb-1.5 font-normal w-6">J</th>
              <th className="text-center pb-1.5 font-normal w-6">V</th>
              <th className="text-center pb-1.5 font-normal w-8">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const team = s.team;
              const label = team
                ? formatTeamName(team.player1, team.player2) || team.name
                : '?';
              return (
                <tr key={String(s.teamId)} className="border-b border-white/5 last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className="text-white/30 mr-1.5">{i + 1}.</span>
                    <span className="text-white/70 truncate">{label}</span>
                  </td>
                  <td className="text-center text-white/30">{s.played}</td>
                  <td className="text-center text-white/30">{s.won}</td>
                  <td className="text-center font-bold text-white/80">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Matchs cliquables */}
      {matches.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3 space-y-1.5">
          {matches.map(m => {
            const t1 = m.team1 ? (formatTeamName(m.team1.player1, m.team1.player2) || m.team1.name) : '?';
            const t2 = m.team2 ? (formatTeamName(m.team2.player1, m.team2.player2) || m.team2.name) : '?';
            const isPlayed = m.played && m.sets?.length > 0;
            return (
              <button
                key={m._id}
                onClick={() => onScoreClick(m)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  isPlayed
                    ? 'bg-violet-500/8 border border-violet-500/20 hover:border-violet-500/40'
                    : 'bg-white/3 border border-white/8 hover:bg-white/5'
                }`}
              >
                <span className={`truncate max-w-[38%] text-left ${isPlayed ? 'text-white/60' : 'text-white/50'}`}>{t1}</span>
                <span className="text-white/20 mx-1">vs</span>
                <span className={`truncate max-w-[38%] text-right ${isPlayed ? 'text-white/60' : 'text-white/50'}`}>{t2}</span>
                {isPlayed && m.sets && (
                  <span className="ml-2 shrink-0 font-mono text-white/35">
                    {m.sets.map(s => `${s.score1}-${s.score2}`).join(' ')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminConsolantePage() {
  // Vue active : 'loading' | 'wizard' | 'pools' | 'bracket'
  const [pageView, setPageView] = useState('loading');

  // Données bracket
  const [byPhase, setByPhase] = useState({});

  // Données tournoi (pour consolanteQualificationRules)
  const [tournament, setTournament] = useState(null);

  // Score modal
  const [scoreMatch, setScoreMatch] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  // Wizard
  const [wizardStep,    setWizardStep]    = useState(1);
  const [format,        setFormat]        = useState('direct');
  const [bracketTarget, setBracketTarget] = useState(8);
  const [numGroups,     setNumGroups]     = useState(3);
  const [eligibleCount, setEligibleCount] = useState(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError,   setWizardError]   = useState('');

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Chargement principal ──────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      // 1. Bracket consolante
      const phaseResults = await Promise.allSettled(
        BRACKET_PHASES.map(p => api.get(`/matches?phase=${p}`))
      );
      const newByPhase = {};
      BRACKET_PHASES.forEach((p, i) => {
        const r = phaseResults[i];
        newByPhase[p] = r.status === 'fulfilled' ? r.value.data : [];
      });

      const hasBracket = BRACKET_PHASES.some(p => newByPhase[p]?.length > 0);

      // 2. Poules consolante
      let hasPools = false;
      try {
        const poolsRes = await api.get('/groups?phase=consolante_pool');
        hasPools = poolsRes.data.length > 0;
      } catch (_) {}

      // 3. Tournoi (pour consolanteQualificationRules)
      let t = null;
      try {
        const tRes = await api.get('/tournament');
        t = tRes.data;
      } catch (_) {}

      // 4. Équipes éligibles (group != null && tournamentPath = null)
      let eligible = 0;
      try {
        const teamsRes = await api.get('/teams');
        eligible = teamsRes.data.filter(tm => tm.group && tm.tournamentPath === null).length;
      } catch (_) {}

      setByPhase(newByPhase);
      setTournament(t);
      setEligibleCount(eligible);

      if (hasBracket) {
        setPageView('bracket');
      } else if (hasPools) {
        setPageView('pools');
      } else {
        // Pré-sélectionner une taille de bracket sensée
        const suggested = eligible <= 4 ? 4 : eligible <= 8 ? 8 : eligible <= 16 ? 16 : 32;
        setBracketTarget(suggested);
        setPageView('wizard');
      }
    } catch (_) {
      setPageView('wizard');
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Wizard : confirmation ─────────────────────────────────────────────────

  const handleWizardConfirm = async () => {
    setWizardLoading(true);
    setWizardError('');
    try {
      if (format === 'direct') {
        await api.post('/bracket/consolante/generate', {
          direct: true,
          bracketTarget,
        });
        showToast('ok', 'Bracket consolante généré !');
      } else {
        // Option A : tirage des poules consolante
        await api.post('/groups/draw', {
          phase: 'consolante_pool',
          numGroups,
          bracketTarget,
        });
        showToast('ok', 'Poules consolante tirées — saisissez les scores puis générez le bracket.');
      }
      await fetchAll();
    } catch (err) {
      setWizardError(err.response?.data?.error || 'Erreur lors du lancement');
    } finally {
      setWizardLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const activePhases  = BRACKET_PHASES.filter(p => byPhase[p]?.length > 0);
  const firstPhase    = activePhases[0];
  const firstRoundCnt = byPhase[firstPhase]?.length || 1;
  const containerH    = firstRoundCnt * 88;

  if (pageView === 'loading') {
    return <div className="p-8 text-white/30 text-sm">Chargement...</div>;
  }

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

      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-display font-bold text-white">Bracket consolante</h1>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
            Consolante
          </span>
        </div>
        <p className="text-white/40 text-sm">
          {pageView === 'wizard'  && 'Configuration de la consolante'}
          {pageView === 'pools'   && 'Phase de poules consolante'}
          {pageView === 'bracket' && activePhases.map(p => ROUND_LABELS[p]).join(' → ')}
        </p>
      </div>

      {/* ── WIZARD ────────────────────────────────────────────────────────── */}
      {pageView === 'wizard' && (
        <div>
          {/* Étapes */}
          <div className="flex items-center gap-3 mb-6">
            {[1, 2].map(n => (
              <div key={n} className={`flex items-center gap-2 text-sm ${
                wizardStep === n ? 'text-violet-400' : 'text-white/25'
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                  wizardStep === n
                    ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                    : wizardStep > n
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-400/50'
                    : 'border-white/15 text-white/25'
                }`}>
                  {n}
                </span>
                {n === 1 ? 'Format' : 'Confirmation'}
                {n < 2 && <span className="text-white/15">→</span>}
              </div>
            ))}
          </div>

          {wizardStep === 1 && (
            <WizardStep1
              eligibleCount={eligibleCount}
              format={format}
              setFormat={setFormat}
              bracketTarget={bracketTarget}
              setBracketTarget={setBracketTarget}
              numGroups={numGroups}
              setNumGroups={setNumGroups}
              onNext={() => setWizardStep(2)}
            />
          )}

          {wizardStep === 2 && (
            <WizardStep2
              eligibleCount={eligibleCount}
              format={format}
              bracketTarget={bracketTarget}
              numGroups={numGroups}
              onBack={() => setWizardStep(1)}
              onConfirm={handleWizardConfirm}
              loading={wizardLoading}
              error={wizardError}
            />
          )}
        </div>
      )}

      {/* ── POULES CONSOLANTE ─────────────────────────────────────────────── */}
      {pageView === 'pools' && (
        <ConsolantePoolsView
          tournament={tournament}
          onBracketGenerated={() => {
            showToast('ok', 'Bracket consolante généré !');
            fetchAll();
          }}
          onScoreClick={match => setScoreMatch(match)}
          onRefresh={fetchAll}
        />
      )}

      {/* ── BRACKET ───────────────────────────────────────────────────────── */}
      {pageView === 'bracket' && (
        <>
          {/* Progression */}
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

          {/* Bracket visuel */}
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
